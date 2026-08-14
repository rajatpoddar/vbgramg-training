import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import PrintButton from "@/components/PrintButton";
import { formatDateLongIST } from "@/lib/dates";
import { getReportData, PASS_PERCENTAGE } from "@/lib/queries";
import { getDistrict } from "@/lib/districts";

export const metadata: Metadata = {
  title: "Print Report",
};

export const dynamic = "force-dynamic";

/**
 * Print-Ready Analytics Report.
 *
 * On screen: a preview of the report plus the "Print Report (A4)" button.
 * In print: the screen chrome (header/nav/buttons — all `no-print`)
 * disappears and the official letterhead (`.print-only`) appears at the
 * top, followed by a bordered A4 table with a signature column.
 */
export default async function ReportPage() {
  const data = await getReportData();
  const district = getDistrict();
  // Short district code for the report number (e.g. DEO for Deoghar).
  const districtCode = district.name.slice(0, 3).toUpperCase();

  const passThreshold = Math.ceil((data.examLength * PASS_PERCENTAGE) / 100);
  const avgScore =
    data.submitted > 0
      ? Math.round(
          (data.users
            .filter((u) => u.submittedAt)
            .reduce((sum, u) => sum + u.score, 0) /
            data.submitted) *
            100
        ) / 100
      : 0;
  const passCount = data.users.filter(
    (u) => u.submittedAt && u.score >= passThreshold
  ).length;

  return (
    <div style={{ page: "report-landscape" }}>
      {/* ============ OFFICIAL LETTERHEAD (print only) ============ */}
      <div className="print-only">
        <div style={{ textAlign: "center" }} className="mb-4">
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 6px",
              border: "2px solid #003366",
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#003366",
            }}
          >
            <Landmark style={{ width: 32, height: 32 }} />
          </div>
          <p style={{ fontSize: 11, letterSpacing: 1, margin: 0, color: "#333" }}>
            GOVERNMENT OF JHARKHAND
          </p>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "4px 0 0",
              color: "#1B3A6B",
            }}
          >
            DISTRICT RURAL DEVELOPMENT AGENCY (DRDA / DRDS), {district.name.toUpperCase()}
          </h1>
          <p style={{ fontSize: 12, margin: "2px 0 0", color: "#333" }}>
            VB-G RAM G ACT, 2025 – ONE-DAY TOT PROGRAMME
          </p>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: "4px 0 0",
              color: "#1B3A6B",
            }}
          >
            POST-TRAINING EVALUATION SHEET (पोस्ट-टेस्ट मूल्यांकन पत्रक)
          </p>
          <p style={{ fontSize: 11, margin: "4px 0 0", color: "#333" }}>
            Date: {district.program.eventDate} &nbsp;·&nbsp; Venue:{" "}
            {district.program.venue}
          </p>
          {/* Tricolor rule */}
          <div
            style={{
              height: 4,
              margin: "10px auto 0",
              background:
                "linear-gradient(to right, #FF9933 0 33%, #003366 33% 33.5%, #ffffff 33.5% 66.5%, #003366 66.5% 67%, #138808 67% 100%)",
            }}
          />
        </div>
      </div>

      {/* ============ SCREEN VIEW ============ */}
      <AdminShell title="Analytics Report" hideTitle>
        {/* Letterhead preview visible on screen */}
        <div className="gov-card no-print mb-6 flex items-center gap-4 p-5">
          <div className="logo-placeholder">
            <Landmark className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              Government of Jharkhand
            </p>
            <h2 className="text-lg font-bold text-navy">
              District Rural Development Agency (DRDA / DRDS), {district.name}
            </h2>
            <p className="text-sm text-gray-600">
              VB-G RAM G Act, 2025 – One-Day TOT Programme
            </p>
            <p className="text-sm font-semibold text-navy">
              Post-Training Evaluation Sheet (पोस्ट-टेस्ट मूल्यांकन पत्रक)
            </p>
            <p className="text-xs text-gray-600">
              Date: {district.program.eventDate} · Venue: {district.program.venue}
            </p>
          </div>
        </div>

        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            This report is formatted for A4 printing. Click the button and
            choose <em>“Save as PDF”</em> or your printer.
          </p>
          <PrintButton />
        </div>

        {/* -------- The printable report body -------- */}
        <div className="gov-card overflow-hidden">
          {/* Report meta header */}
          <div className="border-b border-gray-300 px-4 py-3 text-sm text-gray-700">
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                <strong>Report No.:</strong> DRDA/{districtCode}/VB-GRAMG/
                {new Date().getFullYear()}/01
              </span>
              <span>
                <strong>Date:</strong> {formatDateLongIST(data.generatedAt)}
              </span>
              <span>
                <strong>Place:</strong> Deoghar, Jharkhand
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Programme: VB-G RAM G Act, 2025 – One-Day TOT · Conducted by{" "}
              {district.program.authority} · Date: {district.program.eventDate}{" "}
              · Venue: {district.program.venue}
            </p>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-px bg-gray-200 text-center sm:grid-cols-5">
            {[
              { label: "Registered", value: data.totalRegistered },
              { label: "Submitted", value: data.submitted },
              { label: "Avg. Score", value: avgScore },
              { label: `Passed (≥${passThreshold})`, value: passCount },
              { label: "Questions", value: data.examLength },
            ].map((s) => (
              <div key={s.label} className="bg-white px-2 py-2">
                <p className="text-lg font-bold text-navy">{s.value}</p>
                <p className="text-[11px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Main table with signature column */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-parchment text-xs uppercase tracking-wide text-gray-600">
                  <th className="border border-gray-400 px-3 py-2 font-semibold">S.No</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Name of Participant</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Designation</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Block</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Mobile</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Email</th>
                  <th className="border border-gray-400 px-3 py-2 text-center font-semibold">Score</th>
                  <th className="border border-gray-400 px-3 py-2 font-semibold">Signature</th>
                </tr>
              </thead>
              <tbody>
                {data.users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border border-gray-400 px-3 py-8 text-center text-gray-500">
                      No participants registered yet.
                    </td>
                  </tr>
                ) : (
                  data.users.map((u, i) => (
                    <tr key={u.id} className="align-top">
                      <td className="border border-gray-400 px-3 py-2 text-gray-600">{i + 1}</td>
                      <td className="border border-gray-400 px-3 py-2 font-medium text-gray-800">{u.name}</td>
                      <td className="border border-gray-400 px-3 py-2">{u.designation}</td>
                      <td className="border border-gray-400 px-3 py-2">{u.block}</td>
                      <td className="border border-gray-400 px-3 py-2">{u.mobile}</td>
                      <td className="border border-gray-400 px-3 py-2">{u.email || "—"}</td>
                      <td className="border border-gray-400 px-3 py-2 text-center">
                        {u.submittedAt ? (
                          <span className={u.score >= passThreshold ? "font-bold text-indiaGreen-dark" : "font-bold text-red-700"}>
                            {u.score}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Signature column — left blank for official signing */}
                      <td className="border border-gray-400 px-3 py-2" style={{ height: 44 }} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Signing block */}
          <div className="mt-8 grid grid-cols-2 gap-6 px-4 pb-4 text-sm text-gray-700">
            <div>
              <p className="font-medium">Prepared by</p>
              <p className="mt-6 border-t border-gray-400 pt-1 text-xs text-gray-500">
                Name &amp; Designation
              </p>
            </div>
            <div>
              <p className="font-medium">Verified &amp; Signed</p>
              <p className="mt-6 border-t border-gray-400 pt-1 text-xs text-gray-500">
                District Development Officer, DRDA {district.name}
              </p>
            </div>
          </div>
        </div>

        {/* Print-only footer line for the document */}
        <p className="print-only mt-4 text-center text-[10px] text-gray-600">
          This is a computer-generated report. No signature is required unless
          manually added above. · DRDA / DRDS, {district.name} · VB-G RAM G Act,
          2025 – One-Day TOT Programme
        </p>
      </AdminShell>
    </div>
  );
}
