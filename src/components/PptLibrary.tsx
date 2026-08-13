"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  Presentation as PresentationIcon,
  WifiOff,
} from "lucide-react";
import type { Presentation } from "@/lib/presentations";

/**
 * Session Presentations — a lazy-loading grid of the training PPTs.
 *
 * The PPTX files are large, so nothing heavy loads up front: each card
 * mounts its Office-Online embed iframe only when scrolled into view, and
 * the embed streams the file from Microsoft's viewer — the browser never
 * downloads the raw PPTX just to render the page.
 *
 * The Microsoft viewer fetches the file from a *public* URL, so the live
 * preview only works when the portal is reachable on the internet. On
 * localhost / a private LAN the embed would just show Microsoft's "can't
 * open this" error — instead we detect that case and show a clean
 * download card. A Download / Open link is always shown under every card
 * as a fallback.
 */

/** Is this host unreachable from the internet (localhost, private LAN)? */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0"
  ) {
    return true;
  }
  if (
    h.endsWith(".local") ||
    h.endsWith(".lan") ||
    h.endsWith(".internal") ||
    h.endsWith(".home.arpa")
  ) {
    return true;
  }
  // Private IPv4 ranges (RFC 1918) + link-local.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

/** Microsoft Office Online viewer — renders a PPTX served at `fileUrl`. */
function officeEmbedSrc(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    fileUrl
  )}`;
}

export default function PptLibrary({
  presentations,
}: {
  presentations: Presentation[];
}) {
  if (presentations.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-10">
      <div className="gov-card overflow-hidden">
        <div className="border-b border-gray-200 bg-parchment px-6 py-5">
          <h2 className="flex items-center gap-2 text-xl font-bold text-navy">
            <PresentationIcon className="h-5 w-5 text-saffron-dark" />
            Session Presentations
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            सत्र प्रस्तुतियाँ — Training slides for reference. Use{" "}
            <strong className="text-gray-700">Download</strong> to save a copy
            or <strong className="text-gray-700">Open</strong> to view in a new
            tab.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {presentations.map((p) => (
            <PptCard key={p.fileUrl} presentation={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One presentation card with a lazy-mounted embed (public) or a download card. */
function PptCard({ presentation }: { presentation: Presentation }) {
  const { title, fileUrl, sizeLabel } = presentation;

  // Whether the file URL is fetchable by Microsoft's viewer (i.e. the
  // portal is reachable over the internet, not just localhost / LAN).
  const [canPreview] = useState<boolean>(() => {
    try {
      return !isPrivateHost(new URL(fileUrl).hostname);
    } catch {
      return false;
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // No point observing when there is nothing to lazy-load.
    if (!canPreview) return;
    const node = containerRef.current;
    if (!node) return;
    // No observer (very old browsers) → load immediately rather than never.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Start loading slightly before the card is actually on screen.
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canPreview]);

  return (
    <div className="flex flex-col overflow-hidden rounded border border-gray-200 bg-white">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3.5 py-2.5">
        <p
          className="min-w-0 truncate text-sm font-semibold text-navy"
          title={title}
        >
          {title}
        </p>
        {sizeLabel && (
          <span className="shrink-0 rounded-full bg-gray-200/70 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {sizeLabel}
          </span>
        )}
      </div>

      {/* 16:9 preview / download area */}
      <div className="aspect-video w-full bg-gray-100">
        {canPreview ? (
          <>
            {visible ? (
              <iframe
                src={officeEmbedSrc(fileUrl)}
                title={title}
                className="h-full w-full border-0"
                allowFullScreen
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
                <PresentationIcon className="h-8 w-8" />
                <p className="px-4 text-center text-xs">
                  Presentation loads when you scroll to it.
                </p>
              </div>
            )}

            {visible && !loaded && !failed && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin text-saffron-dark" />
                <p className="px-4 text-center text-xs">Loading presentation…</p>
              </div>
            )}

            {visible && failed && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-gray-500">
                <p>Could not load the preview.</p>
              </div>
            )}
          </>
        ) : (
          /* Local / private network → the Office viewer can't reach the
             file, so offer a clean download instead of an error page. */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
            <WifiOff className="h-8 w-8 text-gray-400" />
            <p className="text-xs leading-relaxed text-gray-500">
              Live preview needs the portal to be reachable on the internet.
              <br />
              Download the file to view it on your device.
            </p>
            <a
              href={fileUrl}
              download
              className="inline-flex items-center gap-1.5 rounded border border-saffron-dark bg-saffron px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-saffron-dark"
            >
              <Download className="h-3.5 w-3.5" /> Download{" "}
              {sizeLabel && <span className="font-normal opacity-90">({sizeLabel})</span>}
            </a>
          </div>
        )}
      </div>

      {/* Always-visible actions (escape hatch even if a preview fails) */}
      <div className="flex items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-3.5 py-2">
        <a
          href={fileUrl}
          download
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:border-navy hover:bg-parchment"
          title="Download this presentation"
        >
          <Download className="h-3 w-3" /> Download
        </a>
        <a
          href={canPreview ? officeEmbedSrc(fileUrl) : fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:border-navy hover:bg-parchment"
          title="Open the presentation in a new tab"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
        {canPreview && (
          <span className="ml-auto text-[10px] text-gray-400">
            Preview via Microsoft Office Online
          </span>
        )}
      </div>
    </div>
  );
}
