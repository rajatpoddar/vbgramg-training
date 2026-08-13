"use server";

import { prisma } from "@/lib/prisma";
import { isValidMobile } from "@/lib/validation";
import { isExamOpen } from "@/lib/queries";
import { EXAM_DURATION_SECONDS } from "@/lib/examConfig";

/**
 * Server actions for the participant-facing "Get Certificate / Resume Exam"
 * flow. A candidate enters their mobile number (the identity captured at
 * registration) and is routed to the right place:
 *
 *  - not registered          → prompted to register (if the window is open)
 *  - registered + submitted  → result page (with certificate download)
 *  - registered + started    → resume the exam directly (NO admin approval;
 *                              if the timer already ran out, they get a fresh
 *                              window so they can finish — "extra time")
 *  - registered + never started → start the exam (if the window is open)
 */

export type MobileLoginState = {
  ok?: boolean;
  /** Where the candidate should be taken on success. */
  redirectTo?: string;
  /** Candidate was not found — whether a fresh registration is possible. */
  notFound?: boolean;
  canRegister?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

/** Digits-only form of a mobile number (ignores spaces / hyphens). */
function digitsOf(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

export async function loginByMobile(
  _prevState: MobileLoginState,
  formData: FormData
): Promise<MobileLoginState> {
  const mobile = String(formData.get("mobile") ?? "").trim();

  if (!isValidMobile(mobile)) {
    return { errors: { mobile: "Enter a valid 10-digit mobile number." } };
  }

  const digits = digitsOf(mobile);

  // The stored mobile may have been typed with spaces/hyphens — match on
  // digits only (the merged database guarantees one row per mobile).
  const candidates = await prisma.user.findMany({
    select: { id: true, mobile: true },
  });
  const match = candidates.find((u) => digitsOf(u.mobile) === digits);

  if (!match) {
    const examOpen = await isExamOpen();
    return {
      ok: false,
      notFound: true,
      canRegister: examOpen,
      message: examOpen
        ? "No candidate found with this mobile number. You can register as a new participant and take the exam."
        : "No candidate found with this mobile number. The examination window is currently closed, so new registration is not available right now.",
    };
  }

  const user = await prisma.user.findUnique({ where: { id: match.id } });
  if (!user) {
    return {
      ok: false,
      message: "Candidate record could not be loaded. Please try again.",
    };
  }

  // Already submitted → show result (with the certificate download button).
  if (user.submittedAt) {
    return { ok: true, redirectTo: `/result?userId=${user.id}` };
  }

  // Started but never submitted (stuck / interrupted) → resume DIRECTLY.
  // No admin approval needed here — the mobile number is the proof of
  // identity. If the original time already ran out, restart the clock so
  // the candidate gets extra time to finish ("jiska exam adhura reh gaya,
  // wo complete kar sake").
  if (user.startedAt) {
    const elapsed = Math.floor((Date.now() - user.startedAt.getTime()) / 1000);
    const expired = elapsed >= EXAM_DURATION_SECONDS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(expired ? { startedAt: new Date() } : {}),
        resumeApprovedAt: new Date(),
        resumeRequestedAt: null,
      },
    });
    return { ok: true, redirectTo: `/exam?userId=${user.id}` };
  }

  // Registered but never started → start fresh, if the window is open.
  const examOpen = await isExamOpen();
  if (!examOpen) {
    return {
      ok: false,
      message:
        "Your registration is complete, but the examination window is currently closed. It opens when the administrator starts the exam — please check back.",
    };
  }
  return { ok: true, redirectTo: `/exam?userId=${user.id}` };
}
