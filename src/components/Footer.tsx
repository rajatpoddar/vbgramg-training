import Link from "next/link";
import { Code2, Mail, Phone, ShieldCheck } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin";
import { getDistrict } from "@/lib/districts";

/**
 * Footer — compact single strip (kept intentionally small).
 * Carries `no-print` so it never appears on printed reports.
 * The "Admin Portal" link is shown only to authenticated admins so
 * candidates never see admin entry points.
 */
export default function Footer() {
  const isAdmin = isAdminAuthenticated();
  const district = getDistrict();

  return (
    <footer className="no-print border-t-2 border-indiaGreen bg-navy-dark text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-gray-300 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} District Administration, {district.name}
          · Government of Jharkhand
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-saffron" /> {district.program.contactPhone}
          </span>
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-saffron" /> {district.program.contactEmail}
          </span>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-gray-400 transition-colors hover:text-saffron"
              title="Authorised personnel only"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Portal
            </Link>
          )}
        </div>
      </div>

      {/* Developer branding */}
      <p className="border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-gray-400">
        Portal developed by{" "}
        <span className="font-medium text-gray-300">Rajat Poddar</span> ·
        Palojori Block, Deoghar{" "}
        <Code2 className="ml-1 inline h-3 w-3 text-saffron" aria-hidden="true" />
      </p>
    </footer>
  );
}
