import Link from "next/link";
import {
  Award,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { adminLogout } from "@/lib/actions/admin";
import { getDistrict } from "@/lib/districts";

/**
 * Shared layout for the Admin Portal pages.
 * Renders the admin navigation bar + logout (all hidden when printing).
 */
export default function AdminShell({
  title,
  hideTitle = false,
  fullBleedPrint = false,
  children,
}: {
  title: string;
  hideTitle?: boolean;
  /** Zero the page padding in print so A4 sheets fill the page exactly. */
  fullBleedPrint?: boolean;
  children: React.ReactNode;
}) {
  const district = getDistrict();
  return (
    <div
      className={`mx-auto max-w-6xl px-4 py-8 ${
        fullBleedPrint ? "print-fullbleed" : ""
      }`}
    >
      {/* Admin navigation bar */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-navy/20 bg-navy px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-saffron" />
          <div>
            <p className="text-sm font-semibold leading-tight">Admin Portal</p>
            <p className="text-[11px] text-gray-300">
              District Administration, {district.name}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <NavLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
          <NavLink href="/admin/questions" icon={<ListChecks className="h-4 w-4" />} label="Questions" />
          <NavLink href="/admin/certificates" icon={<Award className="h-4 w-4" />} label="Certificates" />
          <NavLink href="/admin/report" icon={<Printer className="h-4 w-4" />} label="Print Report" />
          <form action={adminLogout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded px-3 py-2 text-white transition-colors hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </form>
        </nav>
      </div>

      {!hideTitle && <h1 className="gov-heading mb-6">{title}</h1>}

      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded px-3 py-2 text-white transition-colors hover:bg-white/10 hover:text-saffron"
    >
      {icon}
      {label}
    </Link>
  );
}
