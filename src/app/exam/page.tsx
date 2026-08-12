import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import ExamInterface from "@/components/ExamInterface";
import ResumeGate from "@/components/ResumeGate";
import { EXAM_DURATION_SECONDS } from "@/lib/examConfig";
import {
  getUserById,
  getOrCreateExamSession,
  isExamOpen,
  RESUME_GRACE_MS,
} from "@/lib/queries";

export const metadata: Metadata = {
  title: "Examination",
};

export const dynamic = "force-dynamic";

/**
 * Exam page.
 *
 * Server-side guards:
 *  - A valid `userId` is required (else → /register).
 *  - If the participant already submitted, they are sent straight to
 *    their result page (no re-taking).
 *  - If the exam window is closed and the participant has NOT started
 *    yet, they see a notice (they can start once the admin reopens).
 *    Participants already inside the exam are allowed to continue.
 *  - If no questions are published yet, the participant sees a notice
 *    instead of an empty exam.
 */
export default async function ExamPage({
  searchParams,
}: {
  searchParams: { userId?: string };
}) {
  const userId = searchParams.userId;

  if (!userId) {
    redirect("/register");
  }

  const [user, questions, examOpen] = await Promise.all([
    getUserById(userId),
    getOrCreateExamSession(userId),
    isExamOpen(),
  ]);

  if (!user) {
    redirect("/register");
  }

  if (user.submittedAt) {
    redirect(`/result?userId=${userId}`);
  }

  // Exam window closed and the participant never started → block for now.
  if (!examOpen && !user.startedAt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="gov-card border-t-4 border-t-red-500 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Lock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-navy sm:text-xl">
                Examination Not Started
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                The examination window is currently <strong>closed</strong>. It
                will open automatically once the administrator starts the exam.
                Please check back shortly.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/" className="btn-primary w-full sm:w-auto">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="gov-card p-8">
          <h1 className="gov-heading">Examination Not Available</h1>
          <p className="mt-3 text-sm text-gray-600">
            Questions have not been published yet. Please contact the District
            Rural Development Agency, Deoghar, or check back later.
          </p>
        </div>
      </div>
    );
  }

  // Session was interrupted (started, not submitted, heartbeat gone stale)
  // and the admin has NOT approved a resume → the candidate must wait for
  // approval before continuing. A fresh heartbeat (within the grace window)
  // means the candidate is still connected — a simple reload continues.
  const isActive =
    user.lastActiveAt !== null &&
    Date.now() - user.lastActiveAt.getTime() < RESUME_GRACE_MS;
  if (
    user.startedAt &&
    !user.submittedAt &&
    !user.resumeApprovedAt &&
    !isActive
  ) {
    return (
      <ResumeGate
        userId={user.id}
        alreadyRequested={user.resumeRequestedAt !== null}
      />
    );
  }

  // Remaining exam time. The clock is anchored to `startedAt` (the first time
  // the candidate began the exam), so an approved resume continues with the
  // time genuinely left — a candidate cannot refresh/resume for extra time.
  // The exam has a fixed duration (15 minutes) regardless of question count.
  const totalSeconds = EXAM_DURATION_SECONDS;
  let initialTimeLeft = totalSeconds;
  if (user.startedAt) {
    const elapsed = Math.floor(
      (Date.now() - user.startedAt.getTime()) / 1000
    );
    initialTimeLeft = Math.max(0, totalSeconds - elapsed);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ExamInterface
        userId={userId}
        questions={questions}
        initialAnswers={
          user.answers as unknown as Record<string, string> | undefined
        }
        initialTimeLeft={initialTimeLeft}
      />
    </div>
  );
}
