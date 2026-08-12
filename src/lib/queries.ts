import "server-only";
import { prisma } from "@/lib/prisma";
import { EXAM_QUESTION_COUNT } from "@/lib/examConfig";

/**
 * Server-only query layer. Pages (server components) use these functions
 * instead of touching `prisma` directly, keeping a single place for
 * shaping the data returned to the UI.
 */

/** Passing score threshold — 40% of total questions. */
export const PASS_PERCENTAGE = 40;

/** Shape of a question served to the exam interface. */
export type ExamQuestion = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
};

/** Shape of a question row used in the admin Question Manager. */
export type AdminQuestionRow = ExamQuestion & {
  createdAt: Date;
};

/** Map a raw DB row to the shape the exam interface expects. */
function toExamQuestion(q: {
  id: string;
  text: string;
  options: unknown;
  correctAnswer: string;
}): ExamQuestion {
  return {
    id: q.id,
    text: q.text,
    options: q.options as string[], // options is a JSON column
    correctAnswer: q.correctAnswer,
  };
}

/** Fisher–Yates shuffle — returns a new array in random order. */
function shuffleArray<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Return (and on first visit, create) the candidate's exam session.
 *
 * The exam is fixed at EXAM_QUESTION_COUNT questions: when the question bank
 * holds more questions than that, a random subset is chosen once and stored
 * on the candidate (`sessionQuestions`), so every later visit — including a
 * resumed session — serves exactly the same question set. This keeps scoring
 * consistent and prevents a candidate from seeing extra questions by simply
 * reloading the page.
 */
export async function getOrCreateExamSession(
  userId: string
): Promise<ExamQuestion[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionQuestions: true },
  });
  if (!user) return [];

  // Session already created (resume / revisit) → serve the same questions.
  const storedIds = user.sessionQuestions as string[] | null;
  if (Array.isArray(storedIds) && storedIds.length > 0) {
    const rows = await prisma.question.findMany({
      where: { id: { in: storedIds } },
    });
    return rows.map(toExamQuestion);
  }

  // First visit → pick a random subset of up to EXAM_QUESTION_COUNT and
  // persist the selection for this session.
  const bank = await prisma.question.findMany({
    orderBy: { createdAt: "asc" },
  });
  const selected = shuffleArray(bank).slice(0, EXAM_QUESTION_COUNT);
  await prisma.user.update({
    where: { id: userId },
    data: { sessionQuestions: selected.map((q) => q.id) },
  });
  return selected.map(toExamQuestion);
}

/** All questions for the admin Question Manager (with timestamps). */
export async function getAdminQuestions(): Promise<AdminQuestionRow[]> {
  const rows = await prisma.question.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options as string[],
    correctAnswer: q.correctAnswer,
    createdAt: q.createdAt,
  }));
}

export async function getQuestionCount(): Promise<number> {
  return prisma.question.count();
}

/**
 * How many questions each candidate actually faces in one exam — the fixed
 * EXAM_QUESTION_COUNT, unless the question bank holds fewer questions than
 * that (the exam can only ask the questions that exist).
 */
export async function getExamLength(): Promise<number> {
  const bank = await prisma.question.count();
  return Math.min(EXAM_QUESTION_COUNT, bank);
}

/**
 * Total questions a specific candidate was examined on — the length of their
 * persisted session set, falling back to the bank-wide exam length for legacy
 * sessions created before per-session sets were stored.
 */
export async function getUserExamTotal(user: {
  sessionQuestions?: unknown;
}): Promise<number> {
  const stored = user.sessionQuestions;
  if (Array.isArray(stored) && stored.length > 0) {
    // Defensive: if an admin deleted a question that was part of this
    // candidate's session, the session actually has fewer questions — report
    // the real count so the result totals always match server-side scoring.
    const existing = await prisma.question.count({
      where: { id: { in: stored as string[] } },
    });
    return Math.min(stored.length, existing);
  }
  return getExamLength();
}

/* ---------------- Exam window control (admin start/stop) ---------------- */

/** Setting key that stores whether the exam window is open. */
export const EXAM_OPEN_SETTING_KEY = "exam_open";

/**
 * How old a heartbeat may be before a started-but-unsubmitted candidate is
 * treated as interrupted. While a heartbeat is fresher than this, a page
 * reload continues seamlessly; after it goes stale, resuming requires the
 * admin's approval.
 */
export const RESUME_GRACE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Is the exam window currently open? (Admin controls this from the
 * dashboard.) When closed, new registrations and new exam sessions are
 * blocked; candidates already inside the exam are allowed to finish.
 */
export async function isExamOpen(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: EXAM_OPEN_SETTING_KEY },
  });
  return row?.value === "true";
}

/** Set the exam window open/closed state. */
export async function setExamOpenState(open: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: EXAM_OPEN_SETTING_KEY },
    update: { value: open ? "true" : "false" },
    create: { key: EXAM_OPEN_SETTING_KEY, value: open ? "true" : "false" },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/** Data bundle for the admin dashboard (includes LIVE session status). */
export async function getDashboardData() {
  const [users, totalQuestions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.question.count(),
  ]);

  // The exam is 25 questions — live scores and the pass threshold are all
  // relative to the per-candidate exam length, not the full question bank.
  const examLength = Math.min(EXAM_QUESTION_COUNT, totalQuestions);
  const now = Date.now();
  // "Active" = has begun the exam (startedAt set) and not yet submitted.
  const activeUsers = users.filter(
    (u) => u.startedAt !== null && u.submittedAt === null
  );
  // "Online" = a heartbeat was received in the last 2 minutes.
  const onlineUsers = activeUsers.filter(
    (u) =>
      u.lastActiveAt !== null && now - u.lastActiveAt.getTime() < 2 * 60 * 1000
  );

  const submittedUsers = users.filter((u) => u.submittedAt !== null);
  const averageScore =
    submittedUsers.length > 0
      ? Math.round(
          (submittedUsers.reduce((sum, u) => sum + u.score, 0) /
            submittedUsers.length) *
            100
        ) / 100
      : 0;
  const passThreshold = Math.ceil((examLength * PASS_PERCENTAGE) / 100);
  const passCount = submittedUsers.filter(
    (u) => u.score >= passThreshold
  ).length;

  return {
    users,
    totalRegistered: users.length,
    submitted: submittedUsers.length,
    activeInExam: activeUsers.length,
    onlineNow: onlineUsers.length,
    averageScore,
    passCount,
    totalQuestions,
    examLength,
    passThreshold,
  };
}

/** Data bundle for the print-ready analytics report. */
export async function getReportData() {
  const [users, totalQuestions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.question.count(),
  ]);

  const examLength = Math.min(EXAM_QUESTION_COUNT, totalQuestions);
  const passThreshold = Math.ceil((examLength * PASS_PERCENTAGE) / 100);

  return {
    users,
    totalRegistered: users.length,
    submitted: users.filter((u) => u.submittedAt !== null).length,
    totalQuestions,
    examLength,
    passThreshold,
    generatedAt: new Date(),
  };
}
