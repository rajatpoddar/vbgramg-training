"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Presentation as PresentationIcon,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { Presentation } from "@/lib/presentations";
import type { PPTXViewer } from "pptxviewjs";

/**
 * Session Presentations — a play-to-load grid of the training PPTs.
 *
 * Nothing heavy loads up front. Each card shows a Play button; the file is
 * fetched and rendered **only when the visitor presses Play**. The slides are
 * parsed and drawn in the visitor's own browser (pptxviewjs), so the preview
 * works on any network — LAN, NAS, or public internet — with no dependency on
 * Microsoft's online viewer. Next / previous / fullscreen controls are shown
 * once a deck is open.
 *
 * Legacy `.ppt` files (not ZIP-based) can't be parsed in the browser, so those
 * fall back to Microsoft's Office Online viewer iframe. A Download / Open link
 * is always shown under every card as a fallback.
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

/** Microsoft Office Online viewer — renders a PPTX/PPT served at `fileUrl`. */
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
            सत्र प्रस्तुतियाँ — Training slides for reference. Press{" "}
            <strong className="text-gray-700">Play</strong> to view the slides
            right here, use <strong className="text-gray-700">Download</strong>{" "}
            to save a copy, or{" "}
            <strong className="text-gray-700">Open</strong> to view in a new
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

/** Idle → Play → loading → viewer. One presentation card. */
function PptCard({ presentation }: { presentation: Presentation }) {
  const { title, fileUrl, sizeLabel } = presentation;

  // Modern ZIP-based decks are rendered in the browser; legacy .ppt files
  // fall back to Microsoft's Office Online iframe.
  const isPptx = fileUrl.toLowerCase().endsWith(".pptx");

  // Whether the Office Online "Open in new tab" link can reach the file
  // (it needs the portal to be publicly reachable from the internet).
  const [canPreview] = useState<boolean>(() => {
    try {
      return !isPrivateHost(new URL(fileUrl).hostname);
    } catch {
      return false;
    }
  });

  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<PPTXViewer | null>(null);
  const stateRef = useRef(state);
  const busyRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Re-draw the current slide after the card resizes (incl. fullscreen). */
  const renderCurrent = useCallback(async () => {
    const viewer = viewerRef.current;
    const canvas = canvasRef.current;
    if (!viewer || !canvas || viewer.getSlideCount() === 0) return;
    try {
      await viewer.render(canvas, { quality: "high" });
    } catch {
      // Ignore transient render failures (e.g. mid-fullscreen).
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stateRef.current === "ready") void renderCurrent();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [renderCurrent]);

  // Arrow-key navigation while a deck is open.
  useEffect(() => {
    if (state !== "ready" || !isPptx) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") void viewerRef.current?.nextSlide();
      else if (event.key === "ArrowLeft") void viewerRef.current?.previousSlide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, isPptx]);

  // Tear down the viewer when the card unmounts.
  useEffect(() => {
    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  const play = useCallback(async () => {
    if (busyRef.current || stateRef.current !== "idle") return;
    busyRef.current = true;
    setState("loading");
    try {
      if (isPptx) {
        // Drop any previous (possibly failed) viewer before retrying.
        viewerRef.current?.destroy();
        viewerRef.current = null;
        const { PPTXViewer } = await import("pptxviewjs");
        const viewer = new PPTXViewer({
          canvas: canvasRef.current ?? undefined,
          slideSizeMode: "fit",
          enableThumbnails: false,
          backgroundColor: "#ffffff",
        });
        viewerRef.current = viewer;
        viewer.on("slideChanged", (index) =>
          setSlideIndex(Number(index) || 0)
        );
        viewer.on("loadComplete", (data) => {
          const payload = (data ?? {}) as { slideCount?: unknown };
          setSlideCount(
            typeof payload.slideCount === "number"
              ? payload.slideCount
              : viewer.getSlideCount()
          );
        });
        await viewer.loadFromUrl(fileUrl);
        await viewer.render(canvasRef.current, { quality: "high" });
        setState("ready");
      } else {
        // Legacy .ppt — mount the Office Online viewer iframe.
        setState("ready");
      }
    } catch (error) {
      console.error("[PptLibrary] failed to load presentation:", error);
      setState("error");
    } finally {
      busyRef.current = false;
    }
  }, [fileUrl, isPptx]);

  const goTo = useCallback((delta: number) => {
    const viewer = viewerRef.current;
    if (!viewer || stateRef.current !== "ready") return;
    if (delta > 0) void viewer.nextSlide();
    else if (delta < 0) void viewer.previousSlide();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = cardRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof node.requestFullscreen === "function") {
        await node.requestFullscreen();
      }
    } catch {
      // Fullscreen can be rejected (e.g. unsupported on iOS) — ignore.
    }
  }, []);

  const fullscreenSupported =
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function";

  return (
    <div
      ref={cardRef}
      className="flex flex-col overflow-hidden rounded border border-gray-200 bg-white"
    >
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

      {/* 16:9 preview / player area */}
      <div className="relative aspect-video w-full bg-gray-100">
        {isPptx && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            aria-label={`${title} — slide ${slideIndex + 1}`}
          />
        )}

        {state === "idle" && (
          <button
            type="button"
            onClick={play}
            className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-b from-gray-900/5 via-gray-900/35 to-gray-900/75 transition-colors hover:from-gray-900/10 hover:via-gray-900/45 hover:to-gray-900/85"
            title={`Play ${title}`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-saffron text-white shadow-lg shadow-black/30 transition-transform group-hover:scale-105">
              <Play className="h-6 w-6 fill-current" />
            </span>
            <span className="text-sm font-semibold text-white drop-shadow">
              Play Presentation
            </span>
            <span className="px-6 text-center text-[11px] leading-relaxed text-white/80">
              Slides load only when you press play
            </span>
          </button>
        )}

        {state === "loading" && (
          <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-2 bg-white px-4 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-saffron-dark" />
            <p className="text-xs text-gray-500">
              Loading presentation…
              <br />
              <span className="text-gray-400">
                Large files may take a moment
              </span>
            </p>
          </div>
        )}

        {state === "ready" && isPptx && (
          <div className="absolute inset-0">
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gray-900/70 px-2 py-1.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => goTo(-1)}
                disabled={slideIndex <= 0}
                className="rounded p-1.5 text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                title="Previous slide (←)"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4.5rem] text-center text-[11px] font-medium tabular-nums text-white">
                {slideCount > 0 ? `${slideIndex + 1} / ${slideCount}` : "—"}
              </span>
              <button
                type="button"
                onClick={() => goTo(1)}
                disabled={slideCount > 0 && slideIndex >= slideCount - 1}
                className="rounded p-1.5 text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                title="Next slide (→)"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {fullscreenSupported && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="ml-1.5 rounded p-1.5 text-white transition-colors hover:bg-white/15"
                  title={isFullscreen ? "Exit full screen" : "Full screen"}
                  aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {state === "ready" && !isPptx && (
          <iframe
            src={officeEmbedSrc(fileUrl)}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allowFullScreen
          />
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
            <XCircle className="h-8 w-8 text-red-400" />
            <p className="text-xs leading-relaxed text-gray-600">
              Couldn&apos;t open this presentation in the browser.
              <br />
              Use <strong>Download</strong> or <strong>Open</strong> below.
            </p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-navy hover:bg-parchment"
            >
              <RefreshCw className="h-3 w-3" /> Try Again
            </button>
          </div>
        )}
      </div>

      {/* Always-visible actions (escape hatch even if the player fails) */}
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
        <span className="ml-auto text-[10px] text-gray-400">
          Play to view · Download to save
        </span>
      </div>
    </div>
  );
}
