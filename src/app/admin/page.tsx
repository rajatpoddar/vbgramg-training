import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ClipboardCheck,
  FileText,
  ListChecks,
  Printer,
  Radio,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AutoRefresh from "@/components/AutoRefresh";
import DatabaseCleanup from "@/components/DatabaseCleanup";
import DeleteUserButton from "@/components/DeleteUserButton";
import ExamControlPanel from "@/components/ExamControlPanel";
import ForceEndButton from "@/components/ForceEndButton";
import ResumeExamButton from "@/components/ResumeExamButton";
import { formatDateTimeShortIST } from "@/lib/dates";
import { getDashboardData, isExamOpen, RESUME_GRACE_MS } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export const dynamic = "force-dynamic";

/** How old a heartbeat may be before a participant is shown as "idle". */
const ONLINE_WINDOW_MS = RESUME_GRACE_MS;

/** Compact relative-time label ("12s ago", "3m ago", …). */
function timeAgo(date: Date | null): string {
  if (!date) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

/**
 * Admin Dashboard — aggregate statistics, a LIVE exam-status panel, and the
 * full table of registered participants with their scores.
 *
 * Resume flow (simplified): there is no separate approvals screen — every
 * candidate whose exam needs attention gets a Resume button right in their
 * row. Candidates waiting for the admin are flagged with an orange badge
 * and listed in a small banner above the table.
 */
export default async function AdminDashboardPage() {
  const [data, examOpen] = await Promise.all([
    getDashboardData(),
    isExamOpen(),
  ]);
  const activeUsers = data.users.filter(
    (u) => u.startedAt !== null && u.submittedAt === null
  );

  // Candidates who asked to resume (their session broke) and are still
  // waiting for the admin's go-ahead.
  const waitingResumes = data.users.filter(
    (u) =>
      u.startedAt !== null &&
      u.submittedAt === null &&
      u.resumeApprovedAt === null &&
      u.resumeRequestedAt !== null
  );

  const stats = [
    {
      label: "Total Registered",
      value: data.totalRegistered,
      icon: <Users className="h-5 w-5" />,
      accent: "bg-saffron-light text-saffron-dark",
    },
    {
      label: "In Exam Now (Live)",
      value: data.activeInExam,
      icon: <Radio className="h-5 w-5 text-red-500" />,
      accent: "bg-red-50 text-red-600",
      live: true,
    },
    {
      label: "Exam Submitted",
      value: data.submitted,
      icon: <ClipboardCheck className="h-5 w-5" />,
      accent: "bg-indiaGreen-light text-indiaGreen-dark",
    },
    {
      label: "Passed (≥ " + data.passThreshold + ")",
      value: data.passCount,
      icon: <Target className="h-5 w-5" />,
      accent: "bg-blue-50 text-blue-700",
    },
    {
      label: "Average Score",
      value: data.averageScore,
      icon: <Activity className="h-5 w-5" />,
      accent: "bg-gray-100 text-navy",
    },
  ];

  return (
    <AdminShell title="Dashboard">
      {/* Auto-refresh keeps the LIVE panel current */}
      <AutoRefresh intervalMs={10_000} />

      {/* Start / Stop the exam window */}
      <ExamControlPanel open={examOpen} questionCount={data.totalQuestions} />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="gov-card flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${s.accent}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight text-navy">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- LIVE status panel ---------- */}
      <div className="gov-card mb-6 overflow-hidden border-t-4 border-t-red-500">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Radio className="h-4 w-4 text-red-500" /> Live Status
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              LIVE
            </span>
          </h2>
          <span className="text-xs text-gray-500">
            {data.onlineNow} online now · refreshes automatically every 10 seconds
          </span>
        </div>

        <div className="overflow-x-auto">
        <table className="responsive-table w-full text-left text-sm">
          <thead className="bg-parchment text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">#</th>
              <th className="px-4 py-2.5 font-semibold">Participant</th>
              <th className="px-4 py-2.5 font-semibold">Designation</th>
              <th className="px-4 py-2.5 font-semibold">Block</th>
              <th className="px-4 py-2.5 font-semibold">Mobile</th>
              <th className="px-4 py-2.5 text-center font-semibold">Live Score</th>
              <th className="px-4 py-2.5 font-semibold">Last Active</th>
              <th className="px-4 py-2.5 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  data-fullwidth="true"
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No participant is taking the exam right now.
                </td>
              </tr>
            ) : (
              activeUsers.map((u, i) => {
                const online =
                  u.lastActiveAt !== null &&
                  Date.now() - u.lastActiveAt.getTime() < ONLINE_WINDOW_MS;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td data-label="#" className="px-4 py-2.5 text-gray-500">
                      {i + 1}
                    </td>
                    <td data-label="Participant" className="px-4 py-2.5 font-medium text-navy">
                      <span className="flex items-center gap-2">
                        {u.name}
                        {online && (
                          <span
                            className="h-2 w-2 animate-pulse rounded-full bg-indiaGreen"
                            title="Online — answering questions right now"
                          />
                        )}
                      </span>
                    </td>
                    <td data-label="Designation" className="px-4 py-2.5">
                      {u.designation}
                    </td>
                    <td data-label="Block" className="px-4 py-2.5">
                      {u.block}
                    </td>
                    <td data-label="Mobile" className="px-4 py-2.5">
                      {u.mobile}
                    </td>
                    <td data-label="Live Score" className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-saffron-light px-2.5 py-0.5 text-xs font-bold text-saffron-dark">
                        {u.liveScore}
                        <span className="font-medium text-gray-500">
                          /{data.examLength}
                        </span>
                      </span>
                    </td>
                    <td data-label="Last Active" className="px-4 py-2.5 text-xs text-gray-500">
                      {timeAgo(u.lastActiveAt)}
                    </td>
                    <td
                      data-label="Action"
                      data-fullwidth="true"
                      className="px-4 py-2.5 text-center"
                    >
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <ResumeExamButton userId={u.id} />
                        <ForceEndButton userId={u.id} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Quick actions */}
      <div className="no-print mb-6 flex flex-wrap gap-3">
        <Link href="/admin/questions" className="btn-primary">
          <ListChecks className="h-4 w-4" /> Manage Questions
        </Link>
        <Link href="/admin/report" className="btn-green">
          <Printer className="h-4 w-4" /> Print Analytics Report
        </Link>
      </div>

      {/* Candidates waiting to resume — one-tap from the table below */}
      {waitingResumes.length > 0 && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded border border-saffron bg-saffron-light/60 px-4 py-3">
          <RefreshCw className="h-4 w-4 shrink-0 text-saffron-dark" />
          <p className="min-w-0 flex-1 text-sm text-gray-800">
            <strong>{waitingResumes.length}</strong> candidate
            {waitingResumes.length > 1 ? "s are" : " is"} waiting to resume
            after an interruption — press the{" "}
            <strong className="text-indiaGreen-dark">Resume</strong> button
            next to their name below.
          </p>
        </div>
      )}

      {/* Participants table */}
      <div className="gov-card overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">
            Registered Participants ({data.totalRegistered})
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            <strong>Resume</strong> lets a candidate whose exam ended by
            mistake (call, display off, browser closed) continue from where
            they left off · <strong>Delete</strong> lets a candidate whose
            exam is complete register and appear again.
          </p>
        </div>
        <div className="overflow-x-auto">
        <table className="responsive-table w-full text-left text-sm">
          <thead className="bg-parchment text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">#</th>
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Designation</th>
              <th className="px-4 py-2.5 font-semibold">Block</th>
              <th className="px-4 py-2.5 font-semibold">Mobile</th>
              <th className="px-4 py-2.5 font-semibold">Email</th>
              <th className="px-4 py-2.5 text-center font-semibold">Score</th>
              <th className="px-4 py-2.5 font-semibold">Submitted</th>
              <th className="px-4 py-2.5 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.users.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  data-fullwidth="true"
                  className="px-4 py-10 text-center text-gray-500"
                >
                  No participants registered yet.
                </td>
              </tr>
            ) : (
              data.users.map((u, i) => {
                // Waiting to resume: session broke and the admin has not
                // yet approved a resume.
                const waiting =
                  u.startedAt !== null &&
                  u.submittedAt === null &&
                  u.resumeApprovedAt === null &&
                  u.resumeRequestedAt !== null;
                const inProgress =
                  u.startedAt !== null && u.submittedAt === null;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td data-label="#" className="px-4 py-2.5 text-gray-500">
                      {i + 1}
                    </td>
                    <td data-label="Name" className="px-4 py-2.5 font-medium text-navy">
                      <span className="flex flex-wrap items-center gap-2">
                        {u.name}
                        {waiting && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-saffron-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-saffron-dark">
                            <RefreshCw className="h-3 w-3" />
                            Waiting to resume
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Designation" className="px-4 py-2.5">
                      {u.designation}
                    </td>
                    <td data-label="Block" className="px-4 py-2.5">
                      {u.block}
                    </td>
                    <td data-label="Mobile" className="px-4 py-2.5">
                      {u.mobile}
                    </td>
                    <td data-label="Email" className="px-4 py-2.5 text-gray-600">
                      {u.email}
                    </td>
                    <td data-label="Score" className="px-4 py-2.5 text-center">
                      {u.submittedAt ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            u.score >= data.passThreshold
                              ? "bg-indiaGreen-light text-indiaGreen-dark"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {u.score}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td data-label="Submitted" className="px-4 py-2.5 text-xs text-gray-500">
                      {u.submittedAt
                        ? formatDateTimeShortIST(u.submittedAt)
                        : "Not submitted"}
                    </td>
                    <td
                      data-label="Actions"
                      data-fullwidth="true"
                      className="px-4 py-2.5"
                    >
                      {u.submittedAt ? (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <Link
                            href={`/admin/result-card?userId=${u.id}`}
                            title="Open this candidate's printable result card"
                            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-navy hover:bg-parchment"
                          >
                            <FileText className="h-3.5 w-3.5" /> View
                          </Link>
                          <ResumeExamButton userId={u.id} submitted />
                          <DeleteUserButton userId={u.id} />
                        </div>
                      ) : inProgress ? (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <ResumeExamButton userId={u.id} />
                          <ForceEndButton userId={u.id} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Database cleanup — reset tools (typed confirmation required) */}
      <div className="no-print mt-6">
        <DatabaseCleanup
          userCount={data.totalRegistered}
          questionCount={data.totalQuestions}
        />
      </div>
    </AdminShell>
  );
}
