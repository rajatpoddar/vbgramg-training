import {
  Landmark, // National Emblem placeholder icon
  Building2, // Jharkhand Government placeholder icon
  Recycle, // Swachh Bharat placeholder icon
} from "lucide-react";
import SiteNav from "./SiteNav";
import { isAdminAuthenticated } from "@/lib/admin";

/**
 * Header — official Government-of-India portal style.
 *
 * Layout:
 *  - A tricolor (Saffron / White / Green) band at the very top.
 *  - Logo placeholders on the left/right (National Emblem, Jharkhand
 *    Govt, Swachh Bharat). Replace these with <img> tags once the
 *    official artwork is available.
 *  - Formal program title in the centre (truly centred on all screens).
 *  - Mobile: a single compact row — small National Emblem + title.
 *    The two right-side logos and the "Government of Jharkhand" text
 *    are hidden on small screens so the header stays short.
 *  - A mobile-friendly navigation strip below (hamburger on small
 *    screens). The "Admin Portal" item is hidden from candidates and
 *    shown only when an admin session cookie is present.
 *
 * The whole header carries the `no-print` class so it disappears
 * from the printed analytics report.
 */
export default function Header() {
  const isAdmin = isAdminAuthenticated();

  return (
    <header className="no-print">
      {/* Tricolor national band */}
      <div className="tricolor-stripe" aria-hidden="true" />

      <div className="border-b border-gray-200 bg-white">
        {/* 3-column grid keeps the title truly centred on mobile even when
            the right-side logos are hidden (balanced by an invisible spacer). */}
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-2.5 sm:py-4">
          {/* Left: National Emblem + Jharkhand Govt text (text hidden on mobile) */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="logo-placeholder"
              title="National Emblem (placeholder — replace with official image)"
            >
              <Landmark className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy">
                Government of Jharkhand
              </p>
              <p className="text-[11px] text-gray-500">भारत सरकार · Govt. of India</p>
            </div>
          </div>

          {/* Centre: Program title */}
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-bold leading-tight text-navy sm:text-lg md:text-2xl">
              Viksit Bharat <span className="text-saffron-dark">-</span> G RAM G
            </h1>
            <p className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-widest text-gray-600 sm:block md:text-xs">
              Training Programme · District Administration, Deoghar
            </p>
          </div>

          {/* Right: Swachh Bharat + Jharkhand Govt logos (hidden on mobile) */}
          <div className="flex items-center justify-end gap-3">
            <div
              className="logo-placeholder hidden sm:flex"
              title="Jharkhand Government (placeholder — replace with official image)"
            >
              <Building2 className="h-8 w-8" />
            </div>
            <div
              className="logo-placeholder hidden sm:flex"
              title="Swachh Bharat Mission (placeholder — replace with official image)"
            >
              <Recycle className="h-8 w-8" />
            </div>
            {/* Invisible spacer that mirrors the left logo width on mobile so
                the title stays perfectly centred */}
            <div className="w-9 shrink-0 sm:hidden" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Navigation strip (mobile-friendly, admin-aware) */}
      <SiteNav isAdmin={isAdmin} />
    </header>
  );
}
