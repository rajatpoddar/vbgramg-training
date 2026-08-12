"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Eraser,
  Loader2,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { deleteAllQuestions, deleteAllUsers } from "@/lib/actions/admin";

type Target = "users" | "questions";

/**
 * DatabaseCleanup — the admin "reset" tools, kept clearly separated from
 * the everyday controls so they can never be triggered by accident.
 *
 *  - Delete all participants   → wipes every registered candidate (reset
 *    between exam rounds). The question bank is untouched.
 *  - Delete all questions      → empties the question bank. Existing
 *    candidates' saved question sets are cleared too, so the next exam
 *    picks a fresh set from the new bank.
 *
 * Both require typing DELETE to confirm.
 */
export default function DatabaseCleanup({
  userCount,
  questionCount,
}: {
  userCount: number;
  questionCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Target | null>(null);
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(target: Target) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result =
        target === "users"
          ? await deleteAllUsers()
          : await deleteAllQuestions();
      if (!result.ok) {
        setError("Action failed. Please refresh and try again.");
        return;
      }
      setConfirming(null);
      setPhrase("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function startConfirm(target: Target) {
    setConfirming(target);
    setPhrase("");
    setError(null);
  }

  return (
    <div className="gov-card overflow-hidden border-t-4 border-t-red-600">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ShieldAlert className="h-4 w-4 text-red-600" /> Database Cleanup
        </h2>
        <span className="text-xs text-gray-500">
          Use before starting a fresh exam round
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* ---------------- Delete all participants ---------------- */}
        <div className="rounded border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Users className="h-4 w-4 text-gray-500" />
                Delete All Participants ({userCount})
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Removes every registered candidate, their answers and scores —
                the question bank is kept. Candidates can then register again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startConfirm("users")}
              disabled={userCount === 0 || pending}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eraser className="h-3.5 w-3.5" /> Delete All
            </button>
          </div>

          {confirming === "users" && (
            <ConfirmPanel
              label={`Type DELETE to remove all ${userCount} participants`}
              phrase={phrase}
              setPhrase={setPhrase}
              pending={pending}
              onCancel={() => setConfirming(null)}
              onConfirm={() => void run("users")}
            />
          )}
        </div>

        {/* ---------------- Delete all questions ---------------- */}
        <div className="rounded border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Trash2 className="h-4 w-4 text-gray-500" />
                Delete All Questions ({questionCount})
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Empties the whole question bank. Existing candidates&apos;
                saved question sets are cleared so the next exam picks a fresh
                set from the new bank. Avoid using while candidates are
                actively taking the exam.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startConfirm("questions")}
              disabled={questionCount === 0 || pending}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete All
            </button>
          </div>

          {confirming === "questions" && (
            <ConfirmPanel
              label={`Type DELETE to remove all ${questionCount} questions`}
              phrase={phrase}
              setPhrase={setPhrase}
              pending={pending}
              onCancel={() => setConfirming(null)}
              onConfirm={() => void run("questions")}
            />
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-saffron-dark" />
          These actions permanently delete data and cannot be undone.
        </p>

        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Inline typed-confirmation panel. */
function ConfirmPanel({
  label,
  phrase,
  setPhrase,
  pending,
  onCancel,
  onConfirm,
}: {
  label: string;
  phrase: string;
  setPhrase: (v: string) => void;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ready = phrase === "DELETE";
  return (
    <div className="mt-3 rounded border border-red-200 bg-red-50/60 p-3">
      <p className="text-xs font-semibold text-red-700">{label}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Type DELETE"
          autoComplete="off"
          className="form-input w-full sm:max-w-[160px]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready || pending}
            className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Deleting…" : "Confirm Delete"}
          </button>
          <button type="button" onClick={onCancel} className="btn-outline">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
