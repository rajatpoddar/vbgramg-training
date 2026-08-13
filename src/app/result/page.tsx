import type { Metadata } from "next";
import Link from "next/link";
import { Award, CheckCircle2, Home, XCircle } from "lucide-react";
import { formatDateTimeIST } from "@/lib/dates";
import { getUserById, getUserExamTotal, PASS_PERCENTAGE } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Result",
};

export const dynamic = "force-dynamic";

/**
 * Result page — shows the final, server-computed score after the
 * participant submits (or is auto-submitted).
 */
export default async function ResultPage({
  searchParams,
}: {
  searchParams: { userId?: string };
}) {
  const userId = searchParams.userId;
  const user = userId ? await getUserById(userId) : null;

  if (!user) {
    return (
      <Notice
        title="Participant Not Found"
        message="We could not find a participant with this reference. Please register again from the home page."
        actionHref="/register"
        actionLabel="Go to Registration"
      />
    );
  }

  // "Total questions" is the candidate's actual exam set (25), not the full
  // question bank, so the percentage is computed out of what they were asked.
  const totalQuestions = await getUserExamTotal(user);

  // Participant registered but never submitted — allow resuming the exam.
  if (!user.submittedAt) {
    return (
      <Notice
        title="Examination Not Submitted"
        message="Your examination is still in progress. Resume it from where you left off."
        actionHref={`/exam?userId=${user.id}`}
        actionLabel="Resume Examination"
      />
    );
  }

  const percentage =
    totalQuestions > 0 ? Math.round((user.score / totalQuestions) * 100) : 0;
  const passed = percentage >= PASS_PERCENTAGE;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div
        className={`gov-card overflow-hidden border-t-4 ${
          passed ? "border-t-indiaGreen" : "border-t-red-600"
        }`}
      >
        {/* Result header band */}
        <div className="border-b border-gray-200 bg-parchment px-6 py-5 text-center">
          <div
            className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${
              passed ? "bg-indiaGreen-light text-indiaGreen" : "bg-red-50 text-red-600"
            }`}
          >
            {passed ? <Award className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-bold text-navy">
            {passed ? "Congratulations!" : "Examination Complete"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {user.name} · {user.designation}, Block {user.block}
          </p>
        </div>

        <div className="px-6 py-6">
          {/* Score summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded border border-gray-200 bg-white p-3">
              <p className="text-2xl font-bold text-navy">{user.score}</p>
              <p className="text-xs text-gray-500">Score</p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-3">
              <p className="text-2xl font-bold text-navy">{totalQuestions}</p>
              <p className="text-xs text-gray-500">Total Questions</p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-3">
              <p className="text-2xl font-bold text-navy">{percentage}%</p>
              <p className="text-xs text-gray-500">Percentage</p>
            </div>
          </div>

          {/* Pass / Fail badge */}
          <div
            className={`mt-4 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold ${
              passed
                ? "bg-indiaGreen-light text-indiaGreen-dark"
                : "bg-red-50 text-red-700"
            }`}
          >
            {passed ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                PASSED — Minimum {PASS_PERCENTAGE}% required
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                NOT PASSED — Minimum {PASS_PERCENTAGE}% required
              </>
            )}
          </div>

          {/* Participant details */}
          <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-gray-200 pt-4 text-sm sm:grid-cols-2">
            <Detail label="Mobile" value={user.mobile} />
            <Detail label="Email" value={user.email ?? "—"} />
            <Detail label="Submitted On" value={formatDateTimeIST(user.submittedAt)} />
            <Detail label="Reference ID" value={user.id.slice(0, 8).toUpperCase()} />
          </dl>

          <div className="mt-6 flex justify-center">
            <Link href="/" className="btn-outline">
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-500">
        Official record of the District Administration, Deoghar · Viksit Bharat -
        G RAM G Training Programme
      </p>
    </div>
  );
}

/** Small labelled value in the details grid. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}

/** Simple centred notice card used for edge cases. */
function Notice({
  title,
  message,
  actionHref,
  actionLabel,
}: {
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="gov-card p-8">
        <h1 className="gov-heading">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">{message}</p>
        <Link href={actionHref} className="btn-primary mt-6">
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
