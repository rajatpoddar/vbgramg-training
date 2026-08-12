"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateRegistration } from "@/lib/validation";
import { isExamOpen } from "@/lib/queries";

/**
 * Server actions used by the participant-facing flow
 * (Registration → Exam → Result).
 */

export type RegisterState = {
  ok?: boolean;
  userId?: string;
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Register a participant and create their exam session.
 * Called from the Registration form via `useFormState`.
 */
export async function registerUser(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const input = {
    name: String(formData.get("name") ?? "").trim(),
    designation: String(formData.get("designation") ?? "").trim(),
    block: String(formData.get("block") ?? "").trim(),
    mobile: String(formData.get("mobile") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };

  // Server-side validation (mirrors the client-side checks).
  const errors = validateRegistration(input);
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Duplicate handling:
  //  - Already registered AND submitted → reject (single attempt per participant).
  //  - Already registered but never submitted (e.g. browser crashed mid-exam)
  //    → reuse the same record so the participant can resume the exam instead
  //    of being stranded (even if the window is temporarily closed, the exam
  //    page still permits in-progress sessions to continue).
  const existing = await prisma.user.findFirst({
    where: { email: input.email },
  });
  if (existing) {
    if (existing.submittedAt) {
      return {
        errors: {
          email: "This email has already registered and submitted the exam.",
        },
      };
    }
    return { ok: true, userId: existing.id };
  }

  // The exam window must be open (admin-controlled) before brand-new
  // candidates can register.
  const examOpen = await isExamOpen();
  if (!examOpen) {
    return {
      message:
        "The examination has not started yet. It will open automatically once the administrator starts the exam window. Please try again later.",
    };
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        designation: input.designation,
        block: input.block,
        mobile: input.mobile,
        email: input.email,
      },
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    console.error("[registerUser] failed:", error);
    return { message: "Registration failed. Please try again after some time." };
  }
}

/* ---------------- Exam session helpers (live status + resume) ---------------- */

/**
 * Sanitise the answer payload before persisting it (protects the DB from
 * oversized / malformed client payloads).
 */
function sanitizeAnswers(
  answers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!answers || typeof answers !== "object") return undefined;
  const keys = Object.keys(answers);
  if (keys.length === 0 || keys.length > 500) return undefined;

  const clean: Record<string, string> = {};
  for (const key of keys) {
    if (key.length > 100) continue;
    const value = answers[key];
    if (typeof value === "string" && value.length > 0 && value.length <= 2000) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Heartbeat sent by the exam client while the exam is in progress.
 * Updates `lastActiveAt` (for the admin "in exam / online" indicator) and
 * the participant-reported `liveScore` (informational only — the FINAL
 * score is always recomputed server-side at submission).
 *
 * Also persists the candidate's selected answers (`answers`) so a session
 * interrupted by a network failure can be resumed from where it stopped.
 * Once the candidate is actively back inside the exam, any earlier resume
 * flags are cleared — a future interruption needs fresh admin approval.
 */
export async function heartbeat(
  userId: string,
  liveScore: number,
  answers?: Record<string, string>
): Promise<{ ended: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, startedAt: true, submittedAt: true },
  });
  // `ended` tells the exam client that the session is over (e.g. the admin
  // force-ended it) so it can redirect the candidate to their result page.
  if (!user || user.submittedAt) return { ended: true };

  const cleanAnswers = sanitizeAnswers(answers);

  await prisma.user.update({
    where: { id: userId },
    data: {
      startedAt: user.startedAt ?? new Date(),
      lastActiveAt: new Date(),
      liveScore: Number.isFinite(liveScore)
        ? Math.max(0, Math.floor(liveScore))
        : 0,
      ...(cleanAnswers ? { answers: cleanAnswers } : {}),
      // Candidate is actively in the exam again → clear stale resume flags
      // so a FUTURE interruption requires a fresh admin approval.
      resumeRequestedAt: null,
      resumeApprovedAt: null,
    },
  });

  return { ended: false };
}

/**
 * Candidate-side: request permission to resume an interrupted exam.
 * Marks the request so it appears in the admin dashboard's Resume
 * Approvals panel.
 */
export async function requestExamResume(userId: string): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, submittedAt: true },
  });
  if (!user || user.submittedAt) return { ok: false };

  await prisma.user.update({
    where: { id: userId },
    data: { resumeRequestedAt: new Date() },
  });

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Candidate-side: poll whether the admin has approved the resume.
 * The interrupted-session screen checks this periodically and continues
 * automatically once approved.
 */
export async function getResumeStatus(
  userId: string
): Promise<{ approved: boolean; ok: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, resumeApprovedAt: true },
  });
  if (!user) return { ok: false, approved: false };
  return { ok: true, approved: user.resumeApprovedAt !== null };
}

/**
 * Finalise the exam: recompute the score *server-side* from the stored
 * questions (never trusts the client-computed value) and stamp
 * `submittedAt` so the exam cannot be re-taken.
 */
export async function submitExam(
  userId: string,
  answers: Record<string, string>
): Promise<{ ok: boolean; score?: number; total?: number; message?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { ok: false, message: "Participant not found." };
  }
  if (user.submittedAt) {
    return { ok: false, message: "This exam has already been submitted." };
  }

  // Sanity cap on the answers payload (protects against oversized requests).
  if (!answers || typeof answers !== "object" || Object.keys(answers).length > 1000) {
    return { ok: false, message: "Invalid answer payload." };
  }

  // Score against the exact question set this candidate was asked. For legacy
  // sessions created before per-session sets were stored, fall back to the
  // whole question bank.
  const sessionIds = user.sessionQuestions as string[] | null;
  const questions =
    Array.isArray(sessionIds) && sessionIds.length > 0
      ? await prisma.question.findMany({ where: { id: { in: sessionIds } } })
      : await prisma.question.findMany();

  // Recompute the score from the database copy of the answers.
  let score = 0;
  for (const question of questions) {
    const given = answers[question.id];
    if (
      given &&
      given.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
    ) {
      score += 1;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      score,
      submittedAt: new Date(),
      // A submitted exam no longer needs resume requests.
      resumeRequestedAt: null,
      resumeApprovedAt: null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/report");

  return { ok: true, score, total: questions.length };
}
