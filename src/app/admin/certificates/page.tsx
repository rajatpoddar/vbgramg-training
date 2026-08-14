import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Award } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import CertificateContent from "@/components/CertificateContent";
import PrintButton from "@/components/PrintButton";
import { formatDateTimeShortIST } from "@/lib/dates";
import { getCertificateCandidates } from "@/lib/queries";
import { getDistrict } from "@/lib/districts";

export const metadata: Metadata = {
  title: "Certificates — Admin",
};

export const dynamic = "force-dynamic";

/**
 * Admin certificate centre (route protected by the /admin middleware).
 *
 *  - Individual: every eligible candidate is listed with an "Open" link that
 *    opens their print-ready certificate (browser Print → Save as PDF).
 *  - All candidates: the "Print All Certificates" button prints every
 *    certificate in one batch — each certificate is exactly one A4 landscape
 *    page, so the whole PDF is N pages for N candidates.
 *
 * Eligibility matches the public certificate page: submitted OR started
 * (stuck) participants.
 */
export default async function AdminCertificatesPage() {
  const candidates = await getCertificateCandidates();
  const district = getDistrict();

  // Verification QR per candidate (links back to the public verify URL).
  const host = headers().get("host") ?? "localhost";
  const proto = headers().get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const withQr = await Promise.all(
    candidates.map(async (u) => ({
      user: u,
      qr: await QRCode.toDataURL(
        `${origin}/certificate?userId=${u.id}&verify=1`,
        { width: 360, margin: 1, color: { dark: "#111827", light: "#FFFFFF" } }
      ),
    }))
  );

  // hideTitle keeps the page heading out of the print output — the sheet
  // must be the only thing on each printed page (one A4 per certificate).
  return (
    <AdminShell title="Certificates" fullBleedPrint hideTitle>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <strong>{candidates.length}</strong> candidate
          {candidates.length === 1 ? "" : "s"} eligible for a participation
          certificate (submitted or started the exam). Open individual
          certificates below, or print the whole batch in one PDF.
        </p>
        <PrintButton
          label={`Print All Certificates (${candidates.length})`}
        />
      </div>

      {candidates.length === 0 ? (
        <div className="gov-card p-10 text-center text-sm text-gray-500">
          No certificates to generate yet — candidates appear here once they
          submit (or start) the exam.
        </div>
      ) : (
        <>
          {/* ---------- Individual certificates (screen only) ---------- */}
          <div className="gov-card no-print mb-6 overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-navy">
                Individual Certificates
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Click a candidate&apos;s certificate icon to open and print /
                save their certificate. For the full batch, press the button
                above.
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
                    <th className="px-4 py-2.5 text-center font-semibold">Score</th>
                    <th className="px-4 py-2.5 font-semibold">Submitted</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {withQr.map(({ user }, i) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td data-label="#" className="px-4 py-2.5 text-gray-500">
                        {i + 1}
                      </td>
                      <td data-label="Name" className="px-4 py-2.5 font-medium text-navy">
                        {user.name}
                      </td>
                      <td data-label="Designation" className="px-4 py-2.5">
                        {user.designation}
                      </td>
                      <td data-label="Block" className="px-4 py-2.5">
                        {user.block}
                      </td>
                      <td data-label="Mobile" className="px-4 py-2.5">
                        {user.mobile}
                      </td>
                      <td data-label="Score" className="px-4 py-2.5 text-center">
                        {user.submittedAt ? (
                          <span className="inline-block rounded-full bg-saffron-light px-2.5 py-0.5 text-xs font-bold text-saffron-dark">
                            {user.score}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td data-label="Submitted" className="px-4 py-2.5 text-xs text-gray-500">
                        {user.submittedAt
                          ? formatDateTimeShortIST(user.submittedAt)
                          : "In progress"}
                      </td>
                      <td
                        data-label="Certificate"
                        data-fullwidth="true"
                        className="px-4 py-2.5 text-center"
                      >
                        <Link
                          href={`/certificate?userId=${user.id}`}
                          target="_blank"
                          title={`Open ${user.name}'s certificate to print / save as PDF`}
                          className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-navy transition-colors hover:border-saffron-dark hover:bg-saffron-light"
                        >
                          <Award className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- Print-only batch: every certificate, one A4 page each ---------- */}
          {/* Hidden on screen; in print each `.cert-batch-item` starts a new
              page and the full-bleed padding (AdminShell `fullBleedPrint`)
              lets the 297×210mm sheets fill their A4 pages exactly. */}
          <div className="hidden print:block">
            {withQr.map(({ user, qr }) => (
              <div key={user.id} className="cert-batch-item">
                <div className="certificate-sheet">
                  <CertificateContent
                    user={user}
                    qrDataUrl={qr}
                    district={district}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
