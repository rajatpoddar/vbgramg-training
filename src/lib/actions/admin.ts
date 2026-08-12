"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
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
import { EXAM_DURATION_SECONDS } from "@/lib/examConfig";
import { extractDocxParagraphs, parseDocxQuestions } from "@/lib/docxParser";

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

/* ---------------- Resume a candidate's exam ---------------- */

/**
 * One universal admin “Resume” action, used for any candidate whose exam
 * did not end cleanly (a call interrupted them, the display turned off,
 * the browser closed, an anti-cheat auto-submit fired by mistake, …):
 *
 *  - Exam still in progress (started, not submitted) → simply approves the
 *    resume so the candidate continues with their genuine remaining time
 *    and saved answers (no request from the candidate needed).
 *  - Exam was submitted (by mistake) → re-opens it: the saved answers and
 *    question set are kept, the score is cleared. If the original deadline
 *    has not yet passed the candidate continues with the time genuinely
 *    left; only when the deadline already passed do they get a fresh
 *    full-duration clock.
 */
export async function resumeUserExam(
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, submittedAt: true, startedAt: true },
  });
  if (!user) {
    return { ok: false, message: "Candidate not found." };
  }

  const data: {
    resumeApprovedAt: Date;
    resumeRequestedAt: null;
    submittedAt?: Date | null;
    score?: number;
    liveScore?: number;
    startedAt?: Date;
  } = {
    // Skip the candidate-side resume gate: they can continue immediately.
    resumeApprovedAt: new Date(),
    resumeRequestedAt: null,
  };

  if (user.submittedAt) {
    data.submittedAt = null;
    data.score = 0;
    data.liveScore = 0;
    const elapsed = user.startedAt
      ? Math.floor((Date.now() - user.startedAt.getTime()) / 1000)
      : 0;
    // Keep the original anchor while genuine time remains — the exam page
    // computes the remaining clock from `startedAt`. Only a genuinely
    // expired deadline gets a fresh full-duration clock.
    if (!user.startedAt || elapsed >= EXAM_DURATION_SECONDS) {
      data.startedAt = new Date();
    }
  }

  await prisma.user.update({ where: { id: userId }, data });

  revalidatePath("/admin");
  revalidatePath("/exam");
  revalidatePath("/result");
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
    select: {
      id: true,
      submittedAt: true,
      answers: true,
      sessionQuestions: true,
    },
  });
  if (!user) {
    return { ok: false, message: "Candidate not found." };
  }
  if (user.submittedAt) {
    return { ok: false, message: "This exam has already been submitted." };
  }

  // Score from the candidate's last-known saved answers (server-computed),
  // against the exact question set they were asked (session set, or the whole
  // bank for legacy sessions created before session sets were stored).
  const sessionIds = user.sessionQuestions as string[] | null;
  const questions =
    Array.isArray(sessionIds) && sessionIds.length > 0
      ? await prisma.question.findMany({ where: { id: { in: sessionIds } } })
      : await prisma.question.findMany();
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

/* ---------------- Delete a completed exam ---------------- */

/**
 * Admin deletes a candidate's record entirely. Once deleted, the candidate
 * can register again (same email) and take the exam fresh — used to let a
 * candidate whose exam is complete appear again.
 */
export async function deleteUserExam(
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, message: "Candidate not found." };
  }

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin");
  revalidatePath("/admin/report");
  return { ok: true };
}

/* ---------------- Question Manager CRUD ---------------- */

export type QuestionInput = {
  text: string;
  options: string[];
  correctAnswer: string;
};

type ActionResult = {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
};

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

/**
 * Empty the entire question bank. Existing candidates' saved question sets
 * (`sessionQuestions`) are also cleared so the next time they (re)start the
 * exam, a fresh random set is picked from the new bank instead of pointing
 * at deleted questions.
 */
export async function deleteAllQuestions(): Promise<ActionResult> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany();
    await tx.user.updateMany({ data: { sessionQuestions: Prisma.DbNull } });
  });

  revalidatePath("/admin/questions");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Database cleanup: remove every registered participant. Used to reset the
 * portal between exam rounds. Candidate sessions, answers and scores are
 * all wiped; the question bank is untouched.
 */
export async function deleteAllUsers(): Promise<ActionResult> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  await prisma.user.deleteMany();

  revalidatePath("/admin");
  revalidatePath("/admin/report");
  return { ok: true };
}

/* ---------------- Import questions from a Word (.docx) file ---------------- */

export type DocxImportResult = {
  ok: boolean;
  imported?: number;
  /** Questions already present in the bank that were skipped (append mode). */
  skippedDuplicates?: number;
  errors?: string[];
  message?: string;
};

/** Max accepted upload size — the official question banks are tiny. */
const MAX_DOCX_BYTES = 5 * 1024 * 1024;

/**
 * Import MCQs straight from an uploaded .docx file (same format as
 * `scripts/import_mcqs.py`): parse, validate, then insert. When
 * `replace` is checked the bank is cleared first.
 */
export async function importQuestionsFromDocx(
  formData: FormData
): Promise<DocxImportResult> {
  if (!isAdminAuthenticated()) {
    return { ok: false, message: "Unauthorised." };
  }

  const file = formData.get("docx") as File | null;
  const replace = formData.get("replace") === "true";

  if (!file) {
    return { ok: false, message: "No file selected." };
  }
  if (!/\.docx$/i.test(file.name)) {
    return { ok: false, message: "Please upload a .docx (Word) file." };
  }
  if (file.size > MAX_DOCX_BYTES) {
    return { ok: false, message: "File is too large (maximum 5 MB)." };
  }

  let paragraphs: string[];
  try {
    paragraphs = await extractDocxParagraphs(await file.arrayBuffer());
  } catch {
    return {
      ok: false,
      message: "Could not read the file — is it a valid .docx document?",
    };
  }
  if (paragraphs.length === 0) {
    return {
      ok: false,
      message: "No text found in the document. Is it a valid Word file?",
    };
  }
  // Cheap decompression guard: a real question bank is a few hundred KB of
  // text at most — anything much larger is corrupt or a zip bomb.
  if (paragraphs.join("").length > 2_000_000) {
    return { ok: false, message: "The document is too large to import." };
  }

  const { questions, errors } = parseDocxQuestions(paragraphs);
  if (errors.length > 0) {
    return {
      ok: false,
      message: `${errors.length} question(s) could not be read — nothing was imported.`,
      errors,
    };
  }
  if (questions.length === 0) {
    return { ok: false, message: "No questions found in the document." };
  }

  // In append mode, skip questions whose text already exists in the bank so
  // re-uploading the same file cannot silently duplicate the bank.
  let toInsert = questions;
  let skippedDuplicates = 0;
  if (!replace) {
    const existing = await prisma.question.findMany({ select: { text: true } });
    const seen = new Set(existing.map((q) => q.text.trim().toLowerCase()));
    toInsert = [];
    for (const q of questions) {
      const key = q.text.trim().toLowerCase();
      if (seen.has(key)) {
        skippedDuplicates += 1;
      } else {
        seen.add(key);
        toInsert.push(q);
      }
    }
  }
  if (toInsert.length === 0) {
    return {
      ok: false,
      message:
        "Every question in the file already exists in the bank — nothing to import.",
      skippedDuplicates,
    };
  }

  // Replace + insert run atomically so a failure can never leave an empty
  // bank behind.
  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.question.deleteMany();
      await tx.user.updateMany({ data: { sessionQuestions: Prisma.DbNull } });
    }
    await tx.question.createMany({
      data: toInsert.map((q) => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
    });
  });

  revalidatePath("/admin/questions");
  return { ok: true, imported: toInsert.length, skippedDuplicates };
}
