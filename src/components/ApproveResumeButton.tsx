"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { approveExamResume } from "@/lib/actions/admin";

/**
 * ApproveResumeButton — admin action for the Resume Approvals panel.
 * Grants the candidate permission to continue their interrupted exam.
 */
export default function ApproveResumeButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function approve() {
    if (pending) return;
    setPending(true);
    try {
      await approveExamResume(userId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void approve()}
      disabled={pending}
      className="btn-green px-3 py-1.5 text-xs"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {pending ? "Approving…" : "Approve Resume"}
    </button>
  );
}
