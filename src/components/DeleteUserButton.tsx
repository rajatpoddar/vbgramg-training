"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteUserExam } from "@/lib/actions/admin";

/**
 * DeleteUserButton — permanently removes a candidate's record (used for
 * candidates whose exam is complete). Once deleted, the candidate can
 * register again with the same email and take the exam afresh.
 */
export default function DeleteUserButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (pending) return;
    const confirmed = window.confirm(
      "Delete this candidate's record permanently?\n\nThe candidate will then be able to register again and take the exam afresh. This action cannot be undone."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      await deleteUserExam(userId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={pending}
      title="Delete this candidate so they can take the exam again"
      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
      Delete
    </button>
  );
}
