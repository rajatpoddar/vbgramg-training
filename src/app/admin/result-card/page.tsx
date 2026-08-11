import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Landmark,
  XCircle,
} from "lucide-react";
import PrintButton from "@/components/PrintButton";
import ShareResultCard from "@/components/ShareResultCard";
import { getUserById, getQuestionCount, PASS_PERCENTAGE } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Candidate Result Card",
};

export const dynamic = "force-dynamic";

/**
 * Individual Result Card — a printable, official A4 card for a single
 * candidate (name, designation, block, score, pass/fail, signatures).
 *
 * Reached from the admin dashboard ("Result Card" link per participant).
 * Protected by the /admin/* middleware like every other admin page.
 */
export default async function ResultCardPage({
  searchParams,
}: {
  searchParams: { userId?: string };
}) {
  const userId = searchParams.userId;

  if (!userId) {
    redirect("/admin");
  }

  const [user, totalQuestions] = await Promise.all([
    getUserById(userId),
    getQuestionCount(),
  ]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="gov-card p-8">
          <h1 className="gov-heading">Candidate Not Found</h1>
          <p className="mt-3 text-sm text-gray-600">
            No registered participant matches this reference. Please return to
            the dashboard and select a participant.
          </p>
          <div className="mt-6">
            <Link href="/admin" className="btn-primary">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user.submittedAt) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="gov-card p-8">
          <h1 className="gov-heading">Result Pending</h1>
          <p className="mt-3 text-sm text-gray-600">
            <strong>{user.name}</strong> has registered but has not submitted
            the examination yet. A result card can only be generated after the
            exam is submitted.
          </p>
          <div className="mt-6">
            <Link href="/admin" className="btn-primary">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const percentage =
    totalQuestions > 0 ? Math.round((user.score / totalQuestions) * 100) : 0;
  const passed = percentage >= PASS_PERCENTAGE;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Screen-only chrome (hidden when printing) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="btn-outline">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {/* Share via Email / WhatsApp / Telegram */}
          <ShareResultCard
            name={user.name}
            score={user.score}
            total={totalQuestions}
            percentage={percentage}
            passed={passed}
            userId={user.id}
          />
          <PrintButton label="Print Result Card" />
        </div>
      </div>

      {/* ================= The printable result card ================= */}
      <div className="gov-card overflow-hidden print:border print:border-gray-400">
        {/* Official letterhead */}
        <div className="border-b-2 border-navy bg-parchment px-6 py-5 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy/30 text-navy">
            <Landmark className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            Government of Jharkhand
          </p>
          <h1 className="mt-1 text-base font-bold text-navy sm:text-lg">
            District Rural Development Agency (DRDA / DRDS), Deoghar
          </h1>
          <p className="text-xs text-gray-600">
            VB-G RAM G Act, 2025 – One-Day TOT Programme · Post-Training Evaluation
          </p>
          <div className="tricolor-stripe mx-auto mt-3 w-40" aria-hidden="true" />
        </div>

        {/* Card title */}
        <div className="px-6 pt-5 text-center">
          <h2 className="text-xl font-bold text-navy">Individual Result Card</h2>
          <p className="mt-1 text-xs text-gray-500">
            Date: 13th August, 2026 · Venue: DRDS Training Hall, Deoghar
          </p>
        </div>

        {/* Candidate details */}
        <div className="px-6 pt-5">
          <dl className="grid gap-x-6 gap-y-2.5 rounded border border-gray-200 p-4 text-sm sm:grid-cols-2">
            <Detail label="Candidate Name" value={user.name} />
            <Detail label="Designation" value={user.designation} />
            <Detail label="Block" value={user.block} />
            <Detail label="Mobile" value={user.mobile} />
            <Detail label="Email" value={user.email} />
            <Detail
              label="Reference ID"
              value={user.id.slice(0, 8).toUpperCase()}
            />
            <Detail
              label="Submitted On"
              value={
                user.submittedAt
                  ? new Date(user.submittedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—"
              }
            />
          </dl>
        </div>

        {/* Score summary */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded border border-gray-200 p-3">
              <p className="text-2xl font-bold text-navy">{user.score}</p>
              <p className="text-xs text-gray-500">Marks Obtained</p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-2xl font-bold text-navy">{totalQuestions}</p>
              <p className="text-xs text-gray-500">Total Marks</p>
            </div>
            <div className="rounded border border-gray-200 p-3">
              <p className="text-2xl font-bold text-navy">{percentage}%</p>
              <p className="text-xs text-gray-500">Percentage</p>
            </div>
          </div>

          {/* Pass / Fail badge */}
          <div
            className={`mt-3 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-bold ${
              passed
                ? "bg-indiaGreen-light text-indiaGreen-dark"
                : "bg-red-50 text-red-700"
            }`}
          >
            {passed ? (
              <>
                <Award className="h-4 w-4" /> PASSED
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" /> NOT PASSED
              </>
            )}
            <span className="font-medium text-gray-500">
              — Minimum {PASS_PERCENTAGE}% required
            </span>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-6 px-6 py-8 text-sm text-gray-700">
          <div>
            <p className="font-medium">Candidate Signature</p>
            <p className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">
              Signature with date
            </p>
          </div>
          <div>
            <p className="font-medium">Authorised Signatory</p>
            <p className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">
              District Development Officer, DRDA Deoghar
            </p>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 border-t border-gray-200 px-6 py-3 text-center text-[10px] text-gray-500">
          <CheckCircle2 className="h-3 w-3" />
          Computer-generated result card · District Administration, Deoghar ·
          Viksit Bharat - G RAM G Training Programme
        </p>
      </div>
    </div>
  );
}

/** Small labelled value in the details grid. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}
