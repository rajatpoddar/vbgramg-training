"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { reExamUser } from "@/lib/actions/admin";

/**
 * ReExamButton — the admin's single recovery action for a candidate whose
 * exam was already submitted (submitted by mistake, or a failed candidate
 * who should get another attempt). The exam is fully reset: score, saved
 * answers, question set and timer are all cleared, so the candidate must
 * answer ALL questions again from the start. They stay a registered
 * participant, so after finishing they can use the mobile login
 * ("Get Certificate") flow to submit and download their certificate.
 */
export default function ReExamButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reExam() {
    if (pending) return;
    const confirmed = window.confirm(
      "Give this candidate a re-exam?\n\nTheir exam is fully reset — score, saved answers, question set and timer are cleared, and they must answer ALL questions again from the start. Use this for candidates who submitted by mistake or need another attempt."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await reExamUser(userId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void reExam()}
      disabled={pending}
      title="Re-exam — reset this candidate's exam so they take it again from the start"
      className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-navy transition-colors hover:border-saffron-dark hover:bg-saffron-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <KeyRound className="h-4 w-4" />
      )}
    </button>
  );
}
