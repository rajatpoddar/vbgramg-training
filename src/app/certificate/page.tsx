import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";
import CertificateContent from "@/components/CertificateContent";
import CertificateSheet from "@/components/CertificateSheet";
import PrintButton from "@/components/PrintButton";
import { getUserById } from "@/lib/queries";
import { getDistrict } from "@/lib/districts";

export const metadata: Metadata = {
  title: "Participation Certificate",
};

export const dynamic = "force-dynamic";

/**
 * Participation certificate — A4 landscape, print-ready.
 *
 * Access rules:
 *  - Candidate not found        → notice.
 *  - Registered but never began → notice ("no participation record").
 *  - Submitted OR started (stuck/interrupted) → certificate (per the admin
 *    decision: submitted AND stuck participants both receive one).
 *
 * Download = browser Print → Save as PDF. The screen preview mirrors the
 * paper output exactly (fixed A4-landscape proportions, scaled to fit on
 * phones). In print the outer page padding is removed so the sheet fills
 * exactly one A4 landscape page (see `@media print` in globals.css).
 *
 * The QR code links back to this page with `verify=1` so the certificate
 * can be verified by opening it from any device — no external service.
 */
export default async function CertificatePage({
  searchParams,
}: {
  searchParams: { userId?: string; verify?: string };
}) {
  const userId = searchParams.userId;
  const isVerification = searchParams.verify === "1";
  const user = userId ? await getUserById(userId) : null;
  const district = getDistrict();

  // Build the public verification URL from the request itself, so it works
  // whether the portal is on the LAN, behind Tailscale, or a public domain.
  const host = headers().get("host") ?? "localhost";
  const proto = headers().get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const verifyUrl = userId
    ? `${origin}/certificate?userId=${userId}&verify=1`
    : origin;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 360,
    margin: 1,
    color: { dark: "#111827", light: "#FFFFFF" },
  });

  const notFound = !user;
  const noParticipation = Boolean(user && !user.submittedAt && !user.startedAt);

  return (
    <div className="certificate-page mx-auto max-w-6xl px-4 py-8">
      {/* ---------- Screen-only toolbar (hidden on print) ---------- */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ShieldCheck className="h-4 w-4 text-indiaGreen" />
          Official participation certificate — Viksit Bharat - G RAM G
        </div>
        <div className="flex flex-wrap gap-3">
          <PrintButton label="Print / Save as PDF" />
          <Link href="/" className="btn-outline">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>

      {notFound || noParticipation ? (
        <div className="gov-card mx-auto max-w-xl p-8 text-center">
          <h1 className="gov-heading">
            {notFound ? "Certificate Not Found" : "No Participation Record"}
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {notFound
              ? "We could not find a participant with this reference. Please check the link or log in with your registered mobile number."
              : "This candidate is registered but has not begun the examination yet, so no participation certificate is available."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/mobile-login" className="btn-primary">
              <BadgeCheck className="h-4 w-4" /> Login with Mobile Number
            </Link>
            <Link href="/" className="btn-outline">
              Back to Home
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Verification banner (screen only) */}
          {isVerification && (
            <div className="no-print mx-auto mb-5 flex max-w-3xl items-center justify-center gap-2 rounded border border-indiaGreen bg-indiaGreen-light px-4 py-2.5 text-sm font-medium text-indiaGreen-dark">
              <BadgeCheck className="h-4 w-4" />
              This certificate is verified against the official examination
              record of DRDS, Deoghar.
            </div>
          )}

          {/* ---------- The certificate sheet ---------- */}
          {/* CertificateSheet scales the fixed A4-landscape sheet down to fit
              phone screens; on print it is removed so the paper output stays
              a full A4 landscape sheet. */}
          <CertificateSheet>
            <CertificateContent
              user={user!}
              qrDataUrl={qrDataUrl}
              district={district}
            />
          </CertificateSheet>

          <p className="no-print mt-4 text-center text-xs text-gray-500">
            Tip: tap <strong>Print / Save as PDF</strong>, choose
            <strong> “Save as PDF”</strong> and landscape orientation if
            prompted, then download the certificate.
          </p>
        </>
      )}
    </div>
  );
}
