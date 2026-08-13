import "server-only";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";

/**
 * Server-only helper for the "Session Presentations" section.
 *
 * Files dropped into `public/ppt/` (by the site owner) are discovered on
 * every request — no config file or rebuild needed. Only the file *names*
 * are read (cheap); the heavy PPTX bytes are never loaded by the server and
 * are streamed to visitors lazily by the client component.
 */

export type Presentation = {
  /** Display title — the filename without its extension. */
  title: string;
  /** Absolute public URL of the raw file (used by the Office embed + download). */
  fileUrl: string;
  /** Human-readable file size, e.g. "67 MB" (shown on the card). */
  sizeLabel: string;
};

const PPT_DIR = path.join(process.cwd(), "public", "ppt");
const PPT_EXTENSIONS = [".ppt", ".pptx"];

/** "01 Session 1 Orientation.pptx" → "01 Session 1 Orientation" */
function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.(ppt|pptx)$/i, "").trim();
  return base || filename;
}

/**
 * Absolute base URL for the site, used to build the public file URLs that
 * the Office Online embed fetches. Prefers an explicit `NEXT_PUBLIC_SITE_URL`
 * (correct when the site is reachable at a fixed public domain), otherwise
 * derives it from the current request (works on a LAN IP / reverse proxy).
 */
function siteBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "localhost:3926";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/** Human-readable file size for the presentation cards. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** Natural sort so numbered filenames (01, 02, …) order correctly. */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Discover the presentations currently sitting in `public/ppt/`.
 * Returns an empty array (section hidden) when the folder is missing/empty.
 */
export function getPresentations(): Presentation[] {
  let files: string[];
  try {
    files = readdirSync(PPT_DIR);
  } catch {
    return [];
  }

  const baseUrl = siteBaseUrl();
  return files
    .filter((f) => PPT_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)))
    .sort(naturalCompare)
    .map((f) => {
      let sizeLabel = "";
      try {
        sizeLabel = formatBytes(statSync(path.join(PPT_DIR, f)).size);
      } catch {
        // File vanished between listing and stat — leave size blank.
      }
      return {
        title: titleFromFilename(f),
        fileUrl: `${baseUrl}/ppt/${encodeURIComponent(f)}`,
        sizeLabel,
      };
    });
}
