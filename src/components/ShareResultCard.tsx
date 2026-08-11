"use client";

import { useState } from "react";
import { Mail, MessageCircle, Send, Share2, X } from "lucide-react";

/**
 * ShareResultCard — lets the admin share an individual result card with the
 * candidate via Email, WhatsApp or Telegram. Uses the candidate's public
 * result page (/result?userId=…) as the shareable link.
 */
export default function ShareResultCard({
  name,
  score,
  total,
  percentage,
  passed,
  userId,
}: {
  name: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  userId: string;
}) {
  const [open, setOpen] = useState(false);

  // Resolved on the client (window is undefined during SSR).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const resultUrl = `${origin}/result?userId=${userId}`;
  const subject = `Viksit Bharat - G RAM G — Exam Result: ${name}`;
  const text = [
    "Viksit Bharat - G RAM G | Post-Training Evaluation",
    "",
    `Candidate: ${name}`,
    `Score: ${score} / ${total} (${percentage}%)`,
    `Result: ${passed ? "PASSED ✅" : "NOT PASSED ❌"}`,
    "",
    `View result: ${resultUrl}`,
  ].join("\n");

  const mailto = `mailto:?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(text)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(
    resultUrl
  )}&text=${encodeURIComponent(text)}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-outline"
        aria-expanded={open}
      >
        {open ? <X className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {open ? "Close" : "Share Result"}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Share via
          </p>
          <a
            href={mailto}
            className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Mail className="h-4 w-4 shrink-0 text-gray-500" /> Email
          </a>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" /> WhatsApp
          </a>
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Send className="h-4 w-4 shrink-0 text-[#0088cc]" /> Telegram
          </a>
        </div>
      )}
    </div>
  );
}
