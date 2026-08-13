import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import PrintButton from "@/components/PrintButton";
import { formatDateTimeIST } from "@/lib/dates";
import { getUserById } from "@/lib/queries";

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
 * paper output exactly (fixed A4-landscape proportions).
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
    <div className="mx-auto max-w-6xl px-4 py-8">
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
          <div className="certificate-sheet shadow-xl">
            <div className="certificate-frame">
              <div className="certificate-frame-inner">
                {/* Tricolor header band */}
                <div className="cert-tricolor" aria-hidden="true">
                  <div className="saffron" />
                  <div className="white" />
                  <div className="green" />
                </div>

                <div className="certificate-body">
                  {/* Header: emblem + authority */}
                  <div className="flex w-full items-start justify-center gap-8">
                    <div className="flex flex-col items-center gap-1" aria-hidden="true">
                      <div className="logo-placeholder">
                        <Landmark className="h-10 w-10" />
                      </div>
                      <p className="text-[2.4mm] font-medium uppercase tracking-wide text-gray-600">
                        भारत सरकार
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="cert-title-sub">Government of Jharkhand</p>
                      <p className="cert-title-line">
                        Viksit Bharat — G RAM G Mission (Gramin)
                      </p>
                      <p className="mt-1 text-[3mm] font-medium text-gray-700">
                        District Rural Development Section (DRDS), Deoghar
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1" aria-hidden="true">
                      <div className="logo-placeholder">
                        <Building2 className="h-10 w-10" />
                      </div>
                      <p className="text-[2.4mm] font-medium uppercase tracking-wide text-gray-600">
                        झारखंड सरकार
                      </p>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <p className="cert-kicker">Certificate of Participation</p>
                    <p className="cert-hindi">प्रतिभागिता प्रमाण-पत्र</p>
                  </div>

                  {/* Recipient */}
                  <div>
                    <p className="cert-intro">
                      This is to certify that / यह प्रमाणित किया जाता है कि
                    </p>
                    <p className="cert-name">{user!.name}</p>
                    <p className="cert-details">
                      {user!.designation} · Block {user!.block} · District
                      Deoghar, Jharkhand
                    </p>
                  </div>

                  {/* Body */}
                  <p className="cert-body">
                    has successfully participated in the{" "}
                    <strong>Post-Training Evaluation</strong> conducted under the{" "}
                    <strong>
                      Viksit Bharat — Guarantee for Rozgar and Ajeevika Mission
                      (Gramin)
                    </strong>{" "}
                    programme by the District Rural Development Section, Deoghar
                    on <strong>13th August, 2026</strong>. This certificate is
                    issued as an official record of participation.
                  </p>

                  {/* Footer: date | QR | signatures */}
                  <div className="cert-footer">
                    <div className="cert-footer-col">
                      <p>Issued On</p>
                      <p className="mt-0.5 font-semibold text-gray-800">
                        {formatDateTimeIST(user!.submittedAt ?? user!.createdAt)}
                      </p>
                      <p className="mt-2 text-[2.6mm] text-gray-500">
                        Reference:{" "}
                        <span className="font-semibold tracking-wide">
                          {user!.id.slice(0, 8).toUpperCase()}
                        </span>
                      </p>
                    </div>

                    <div className="cert-footer-col">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="Verification QR code"
                        className="mx-auto"
                        style={{ width: "22mm", height: "22mm" }}
                      />
                      <p className="mt-1 text-[2.6mm] text-gray-500">
                        Scan to verify this certificate
                      </p>
                    </div>

                    <div className="cert-footer-col">
                      <p className="cert-signature-line">
                        Exam Controller
                      </p>
                      <p className="mt-1 text-[2.6mm] text-gray-500">
                        DRDS, Deoghar
                      </p>
                    </div>
                    <div className="cert-footer-col">
                      <p className="cert-signature-line">
                        District Development Officer
                      </p>
                      <p className="mt-1 text-[2.6mm] text-gray-500">
                        Deoghar
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tricolor footer band */}
                <div className="cert-tricolor" aria-hidden="true">
                  <div className="saffron" />
                  <div className="white" />
                  <div className="green" />
                </div>
              </div>
            </div>
          </div>

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
