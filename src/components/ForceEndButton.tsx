"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { forceEndExam } from "@/lib/actions/admin";

/**
 * ForceEndButton — admin power to end a candidate's live exam session
 * immediately. The candidate's saved answers are scored server-side and the
 * exam is marked submitted; the candidate is redirected to their result page
 * on the next heartbeat.
 */
export default function ForceEndButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function end() {
    if (pending) return;
    const confirmed = window.confirm(
      "End this candidate's live exam session now?\n\nTheir current saved answers will be scored and submitted, and the candidate will be taken to the result page."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await forceEndExam(userId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void end()}
      disabled={pending}
      title="End this candidate's exam session now"
      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      End
    </button>
  );
}
