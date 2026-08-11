import "server-only";
import { prisma } from "@/lib/prisma";

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

/** All questions for the exam, in the order they were added. */
export async function getExamQuestions(): Promise<ExamQuestion[]> {
  const rows = await prisma.question.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options as string[], // options is a JSON column
    correctAnswer: q.correctAnswer,
  }));
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
  const passThreshold = Math.ceil((totalQuestions * PASS_PERCENTAGE) / 100);
  const passCount = submittedUsers.filter(
    (u) => u.score >= passThreshold
  ).length;

  // Candidates whose session broke (no fresh heartbeat) and who asked to
  // resume — waiting for the admin's approval.
  const pendingResumes = users.filter(
    (u) =>
      u.startedAt !== null &&
      u.submittedAt === null &&
      u.resumeApprovedAt === null &&
      u.resumeRequestedAt !== null
  );

  return {
    users,
    totalRegistered: users.length,
    submitted: submittedUsers.length,
    activeInExam: activeUsers.length,
    onlineNow: onlineUsers.length,
    averageScore,
    passCount,
    totalQuestions,
    passThreshold,
    pendingResumes,
  };
}

/** Data bundle for the print-ready analytics report. */
export async function getReportData() {
  const [users, totalQuestions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.question.count(),
  ]);

  const passThreshold = Math.ceil((totalQuestions * PASS_PERCENTAGE) / 100);

  return {
    users,
    totalRegistered: users.length,
    submitted: users.filter((u) => u.submittedAt !== null).length,
    totalQuestions,
    passThreshold,
    generatedAt: new Date(),
  };
}
