"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getAdminConfigError,
  getAdminPassword,
  setAdminSession,
  clearAdminSession,
  isAdminAuthenticated,
} from "@/lib/admin";
import { validateQuestion } from "@/lib/validation";
import { setExamOpenState } from "@/lib/queries";

/**
 * Server actions for the Admin Portal
 * (authentication + Question Manager CRUD).
 */

/* ---------------- Authentication ---------------- */

// Simple in-memory brute-force throttle (per server process — sufficient
// for a single-instance NAS deployment). After 5 failed attempts, logins
// are locked for 5 minutes.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
let failedAttempts = 0;
let lockedUntil = 0;

function isLockedOut(): boolean {
  return Date.now() < lockedUntil;
}

function recordFailure(): void {
  failedAttempts += 1;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_MS;
    failedAttempts = 0;
  }
}

export async function adminLogin(
  password: string
): Promise<{ ok: boolean; error?: string }> {
  // Fail closed on unconfigured / weak credentials in production.
  const configError = getAdminConfigError();
  if (configError) {
    return { ok: false, error: configError };
  }

  if (isLockedOut()) {
    const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${minutes} minute(s).`,
    };
  }

  if (!password || password !== getAdminPassword()) {
    recordFailure();
    return { ok: false, error: "Incorrect admin password." };
  }

  failedAttempts = 0;
  setAdminSession();
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  clearAdminSession();
  // Immediately bounce out of the admin area (middleware does not re-run on
  // the post-action RSC refresh).
  redirect("/admin/login");
}

/* ---------------- Exam window control ---------------- */

/**
 * Open or close the exam window. Called from the Exam Control panel on the
 * admin dashboard.
 *
 *  - OPEN   → candidates can register and start the exam.
 *  - CLOSED → new registrations are blocked; participants already inside
 *             the exam may finish their session.
 */
export async function setExamOpen(open: boolean): Promise<{ ok: boolean }> {
  // The middleware protects /admin/* pages, but server actions must be
  // guarded individually (they can be invoked directly).
  if (!isAdminAuthenticated()) {
    return { ok: false };
  }

  await setExamOpenState(open);

  revalidatePath("/");
  revalidatePath("/register");
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------------- Interrupted-session resume approvals ---------------- */

/**
 * Admin approves a candidate's request to resume an interrupted exam.
 * Once approved, the candidate's interrupted-session screen automatically
 * continues into the exam (restoring their saved answers).
 */
export async function approveExamResume(
  userId: string
): Promise<{ ok: boolean }> {
  if (!isAdminAuthenticated()) {
    return { ok: false };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.submittedAt) {
    return { ok: false };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { resumeApprovedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/exam");
  return { ok: true };
}

/* ---------------- Force-end a live exam session ---------------- */

/**
 * Admin ends a candidate's live exam session immediately. The candidate's
 * last-known saved answers are scored server-side and the exam is marked
 * submitted — the candidate is then redirected to their result page on the
 * next heartbeat / page visit.
 */
export async function forceEndExam(
  userId: string
): Promise<{ ok: boolean; message?: string; score?: number; total?: number }> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, submittedAt: true, answers: true },
  });
  if (!user) {
    return { ok: false, message: "Candidate not found." };
  }
  if (user.submittedAt) {
    return { ok: false, message: "This exam has already been submitted." };
  }

  // Score from the candidate's last-known saved answers (server-computed).
  const questions = await prisma.question.findMany();
  const saved = (user.answers ?? {}) as Record<string, unknown>;
  let score = 0;
  for (const question of questions) {
    const given = saved[question.id];
    if (
      typeof given === "string" &&
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
      resumeRequestedAt: null,
      resumeApprovedAt: null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/report");
  return { ok: true, score, total: questions.length };
}

/* ---------------- Question Manager CRUD ---------------- */

export type QuestionInput = {
  text: string;
  options: string[];
  correctAnswer: string;
};

type ActionResult = { ok: boolean; errors?: Record<string, string> };

export async function createQuestion(
  input: QuestionInput
): Promise<ActionResult> {
  const errors = validateQuestion(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  await prisma.question.create({
    data: {
      text: input.text.trim(),
      options: input.options.map((o) => o.trim()),
      correctAnswer: input.correctAnswer.trim(),
    },
  });

  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function updateQuestion(
  id: string,
  input: QuestionInput
): Promise<ActionResult> {
  const errors = validateQuestion(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  await prisma.question.update({
    where: { id },
    data: {
      text: input.text.trim(),
      options: input.options.map((o) => o.trim()),
      correctAnswer: input.correctAnswer.trim(),
    },
  });

  revalidatePath("/admin/questions");
  return { ok: true };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  await prisma.question.delete({ where: { id } });
  revalidatePath("/admin/questions");
  return { ok: true };
}
