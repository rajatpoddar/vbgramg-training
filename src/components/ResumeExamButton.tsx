"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { resumeUserExam } from "@/lib/actions/admin";

/**
 * ResumeExamButton — the single admin recovery action for any exam that did
 * not end cleanly:
 *
 *  - Candidate's exam is still in progress but was interrupted (call came
 *    in, display turned off, browser closed) → resumes from where they left
 *    off with their genuine remaining time and saved answers.
 *  - Candidate's exam was submitted by mistake (auto-submit) → re-opens the
 *    exam, keeping their saved answers.
 */
export default function ResumeExamButton({
  userId,
  submitted = false,
}: {
  userId: string;
  /** True when the candidate's exam was already submitted (reopen case). */
  submitted?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function resume() {
    if (pending) return;
    const confirmed = window.confirm(
      submitted
        ? "Re-open this candidate's completed exam?\n\nTheir saved answers are kept, the score is cleared, and they can continue the exam. This lets a candidate whose exam ended by mistake appear again."
        : "Allow this candidate to continue their interrupted exam?\n\nThey will resume from where they left off with their remaining time and saved answers."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await resumeUserExam(userId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void resume()}
      disabled={pending}
      title="Resume this candidate's exam so they can continue"
      className="inline-flex items-center gap-1 rounded border border-indiaGreen bg-white px-2.5 py-1.5 text-xs font-semibold text-indiaGreen-dark transition-colors hover:bg-indiaGreen-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Resume
    </button>
  );
}
