"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { reopenExam } from "@/lib/actions/admin";

/**
 * ResumeExamButton — admin recovery action for exams that were submitted
 * automatically (timer expiry or the anti-cheat auto-submit) or manually.
 *
 * Re-opens the exam: the candidate's saved answers and question set are kept,
 * the score is cleared, and the candidate gets a fresh full-duration clock so
 * they can continue from where they left off (their result page offers the
 * resume link automatically).
 */
export default function ResumeExamButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function resume() {
    if (pending) return;
    const confirmed = window.confirm(
      "Re-open this candidate's completed exam?\n\nTheir saved answers are kept, the score is cleared, and they get a fresh full-duration clock to continue. The candidate can then resume the exam from their result page."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await reopenExam(userId);
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
      title="Re-open this candidate's exam so they can continue"
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
