import { Building2, Landmark } from "lucide-react";
import { formatDateTimeIST } from "@/lib/dates";

/** Minimum candidate fields the certificate needs. */
export type CertificateUser = {
  id: string;
  name: string;
  designation: string;
  block: string;
  submittedAt: Date | null;
  createdAt: Date;
};

/**
 * CertificateContent — the framed certificate (tricolor bands + body). Pure
 * markup with no client behaviour, shared by:
 *  - the public certificate page (`/certificate?userId=…`, wrapped in the
 *    screen-scaling CertificateSheet), and
 *  - the admin bulk-certificate page (each candidate's certificate wrapped
 *    in a plain `.certificate-sheet` for A4 printing).
 *
 * The caller is responsible for the outer `.certificate-sheet` box (which
 * carries the A4-landscape page size) and for generating the QR data URL.
 */
export default function CertificateContent({
  user,
  qrDataUrl,
}: {
  user: CertificateUser;
  qrDataUrl: string;
}) {
  return (
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
            <p className="cert-name">{user.name}</p>
            <p className="cert-details">
              {user.designation} · Block {user.block} · District Deoghar,
              Jharkhand
            </p>
          </div>

          {/* Body */}
          <p className="cert-body">
            has successfully participated in the{" "}
            <strong>Post-Training Evaluation</strong> conducted under the{" "}
            <strong>
              Viksit Bharat — Guarantee for Rozgar and Ajeevika Mission (Gramin)
            </strong>{" "}
            programme by the District Rural Development Section, Deoghar on{" "}
            <strong>13th August, 2026</strong>. This certificate is issued as an
            official record of participation.
          </p>

          {/* Footer: date | QR | signatures */}
          <div className="cert-footer">
            <div className="cert-footer-col">
              <p>Issued On</p>
              <p className="mt-0.5 font-semibold text-gray-800">
                {formatDateTimeIST(user.submittedAt ?? user.createdAt)}
              </p>
              <p className="mt-2 text-[2.6mm] text-gray-500">
                Reference:{" "}
                <span className="font-semibold tracking-wide">
                  {user.id.slice(0, 8).toUpperCase()}
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
              <p className="cert-signature-line">Exam Controller</p>
              <p className="mt-1 text-[2.6mm] text-gray-500">DRDS, Deoghar</p>
            </div>
            <div className="cert-footer-col">
              <p className="cert-signature-line">
                District Development Officer
              </p>
              <p className="mt-1 text-[2.6mm] text-gray-500">Deoghar</p>
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
  );
}
