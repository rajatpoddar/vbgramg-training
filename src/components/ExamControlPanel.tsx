"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Lock,
  Play,
  Power,
  Unlock,
} from "lucide-react";
import { setExamOpen } from "@/lib/actions/admin";
import { EXAM_QUESTION_COUNT } from "@/lib/examConfig";

/**
 * ExamControlPanel — the admin's power switch for the exam window.
 *
 *  - OPEN   → candidates can register and start the exam.
 *  - CLOSED → registration is blocked; candidates already inside the
 *             exam may finish their session.
 */
export default function ExamControlPanel({
  open,
  questionCount,
}: {
  open: boolean;
  questionCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;
    // Refuse to start with an empty question bank — candidates would see an
    // unusable exam.
    if (!open && questionCount === 0) {
      setError(
        "Cannot start the exam — no questions are published yet. Add questions first in the Question Manager."
      );
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await setExamOpen(!open);
      if (!result.ok) {
        setError("Action failed. Please refresh and try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`gov-card mb-6 overflow-hidden border-t-4 ${
        open ? "border-t-indiaGreen" : "border-t-red-500"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              open
                ? "bg-indiaGreen-light text-indiaGreen"
                : "bg-red-50 text-red-600"
            }`}
          >
            {open ? (
              <Unlock className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
              Exam Control
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  open
                    ? "bg-indiaGreen-light text-indiaGreen-dark"
                    : "bg-red-50 text-red-600"
                }`}
              >
                <span
                  className={`h-2 w-2 animate-pulse rounded-full ${
                    open ? "bg-indiaGreen" : "bg-red-500"
                  }`}
                />
                {open ? "Exam is LIVE" : "Not Started"}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {open
                ? "Candidates can register and appear for the exam right now."
                : "Candidates see a “not started yet” notice. Registration is blocked."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void toggle()}
          disabled={pending}
          className={open ? "btn-danger" : "btn-green"}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : open ? (
            <Power className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {pending ? "Updating…" : open ? "Stop Exam" : "Start Exam"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-saffron-dark" />
          Stopping blocks <strong>new</strong> registrations — participants
          already inside the exam can finish.
        </span>
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-saffron-dark" />
          {questionCount > 0
            ? `${questionCount} in bank · ${EXAM_QUESTION_COUNT} per exam`
            : "No questions published yet"}
        </span>
      </div>

      {error && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
