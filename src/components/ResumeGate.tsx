"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RefreshCw, Send, WifiOff } from "lucide-react";
import {
  getResumeStatus,
  requestExamResume,
} from "@/lib/actions/exam";

/** How often the gate re-checks whether the admin approved the resume. */
const POLL_INTERVAL_MS = 10_000;

/**
 * ResumeGate — shown to a candidate whose exam session was interrupted
 * (e.g. network failure, browser crash). The candidate cannot continue
 * until the admin approves the resume from the dashboard:
 *
 *  1. On mount the request is registered automatically (if not already),
 *     so it appears in the admin's "Resume Approvals" panel.
 *  2. The screen polls every 10s; as soon as the admin approves,
 *     `router.refresh()` re-renders the exam page, which now passes the
 *     gate and restores the candidate's saved answers.
 */
export default function ResumeGate({
  userId,
  alreadyRequested,
}: {
  userId: string;
  alreadyRequested: boolean;
}) {
  const router = useRouter();
  const [requested, setRequested] = useState(alreadyRequested);
  const [status, setStatus] = useState<"requesting" | "waiting" | "approved">(
    alreadyRequested ? "waiting" : "requesting"
  );

  // Register the resume request automatically (once) so the admin sees it.
  useEffect(() => {
    if (requested) return;
    let cancelled = false;
    void requestExamResume(userId)
      .then(() => {
        if (!cancelled) {
          setRequested(true);
          setStatus("waiting");
        }
      })
      .catch(() => {
        // Network hiccup — move to the waiting state so the manual
        // "Request Again" button is available as a fallback.
        if (!cancelled) setStatus("waiting");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Poll for admin approval.
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await getResumeStatus(userId);
      if (res.ok && res.approved) {
        setStatus("approved");
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId, router]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="gov-card border-t-4 border-t-saffron p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron-light text-saffron-dark">
            {status === "approved" ? (
              <RefreshCw className="h-6 w-6" />
            ) : (
              <WifiOff className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-navy sm:text-xl">
              {status === "approved"
                ? "Resume Approved"
                : "Session Interrupted"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {status === "approved" ? (
                <>
                  Your exam is now being resumed. Your saved answers will be
                  restored — please wait a moment.
                </>
              ) : (
                <>
                  Your previous exam session was interrupted (network failure
                  or browser issue). To continue, the invigilator must approve
                  your resume from the admin panel. Your saved answers are
                  safe.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Status line */}
        <div className="mt-6 rounded border border-gray-200 bg-parchment px-4 py-3 text-sm text-gray-700">
          {status === "requesting" && (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-saffron-dark" />
              Registering your resume request…
            </p>
          )}
          {status === "waiting" && (
            <p className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-saffron-dark" />
              Request sent. Waiting for the admin&apos;s approval — this page
              checks automatically every few seconds.
            </p>
          )}
          {status === "approved" && (
            <p className="flex items-center gap-2 text-indiaGreen-dark">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Approved! Resuming your examination…
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {!requested && (
            <button
              type="button"
              onClick={() => void requestExamResume(userId)}
              className="btn-outline"
            >
              <Send className="h-4 w-4" /> Request Again
            </button>
          )}
          <Link href="/" className="btn-outline">
            Back to Home
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          If approval takes too long, please contact the invigilator at the
          exam venue.
        </p>
      </div>
    </div>
  );
}
