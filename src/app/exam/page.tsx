import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Smartphone, WifiOff } from "lucide-react";
import ExamInterface from "@/components/ExamInterface";
import { EXAM_DURATION_SECONDS } from "@/lib/examConfig";
import {
  getUserById,
  getOrCreateExamSession,
  isExamOpen,
  RESUME_GRACE_MS,
} from "@/lib/queries";
import { getDistrict } from "@/lib/districts";

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
  const district = getDistrict();

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
            Rural Development Agency, {district.name}, or check back later.
          </p>
        </div>
      </div>
    );
  }

  // Session was interrupted (started, not submitted, heartbeat gone stale) and
  // the candidate has not yet re-verified via the mobile login → they are sent
  // to the "Get Certificate" flow, where entering their registered mobile
  // number continues the exam directly (no admin approval needed; if the
  // timer already ran out, they get a fresh window to finish). A fresh
  // heartbeat (within the grace window) means the candidate is still
  // connected — a simple reload continues seamlessly.
  const isActive =
    user.lastActiveAt !== null &&
    Date.now() - user.lastActiveAt.getTime() < RESUME_GRACE_MS;
  if (
    user.startedAt &&
    !user.submittedAt &&
    !user.resumeApprovedAt &&
    !isActive
  ) {
    return <InterruptedSession />;
  }

  // Remaining exam time. The clock is anchored to `startedAt` (the first time
  // the candidate began the exam), so a verified continuation keeps the time
  // genuinely left — a candidate cannot refresh for extra time (only a mobile
  // login after the clock already ran out restarts the window).
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

/**
 * Shown when a started exam's session went stale (network failure / browser
 * closed). The candidate continues by verifying their identity through the
 * mobile login — no admin approval is involved anymore.
 */
function InterruptedSession() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="gov-card border-t-4 border-t-saffron p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron-light text-saffron-dark">
            <WifiOff className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-navy sm:text-xl">
              Session Interrupted
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Your previous exam session was interrupted (network failure or
              browser issue). Your saved answers are safe. Continue directly by
              entering the mobile number you registered with — no approval
              needed, and if the time already ran out you get a fresh window to
              finish.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/mobile-login" className="btn-primary">
            <Smartphone className="h-4 w-4" /> Continue with Mobile Login
          </Link>
          <Link href="/" className="btn-outline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
