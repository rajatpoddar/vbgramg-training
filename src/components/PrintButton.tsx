"use client";

import { Printer } from "lucide-react";

/** Small client component: triggers the browser's print dialog. */
export default function PrintButton({ label = "Print Report (A4)" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-green">
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
