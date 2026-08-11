"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Menu, ShieldCheck, X } from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
};

/**
 * SiteNav — the portal navigation strip (rendered inside the Header).
 *
 * Mobile: a hamburger button toggles a dropdown menu.
 * Desktop: horizontal links with an active-route highlight.
 *
 * The "Admin Portal" link is only shown when the visitor holds a valid
 * admin session cookie (`isAdmin` from the server) — candidates never
 * see it in the navbar.
 */
export default function SiteNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    {
      href: "/",
      icon: <Home className="h-4 w-4" />,
      label: "Home",
    },
    {
      href: "/register",
      icon: <ClipboardList className="h-4 w-4" />,
      label: "Register for Exam",
    },
    {
      href: "/admin",
      icon: <ShieldCheck className="h-4 w-4" />,
      label: "Admin Portal",
      adminOnly: true,
    },
  ].filter((item) => !item.adminOnly || isAdmin);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="border-b-2 border-saffron bg-navy">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4">
        {/* Desktop links (hidden on small screens) */}
        <div className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-white/10 text-saffron"
                  : "text-white hover:bg-white/10 hover:text-saffron"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        {/* Mobile: brand + hamburger */}
        <div className="flex w-full items-center justify-between md:hidden">
          <Link
            href="/"
            className="flex items-center gap-2 py-2.5 text-sm font-semibold text-white"
            onClick={() => setOpen(false)}
          >
            <Home className="h-4 w-4 text-saffron" />
            Portal Home
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-2.5 text-sm font-medium text-white"
            aria-expanded={open}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="text-xs">{open ? "Close" : "Menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-white/10 bg-navy-dark md:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 border-l-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "border-saffron bg-white/10 text-saffron"
                  : "border-transparent text-white hover:bg-white/10 hover:text-saffron"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
