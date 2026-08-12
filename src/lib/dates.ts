/**
 * Central date formatting — every timestamp shown anywhere in the portal is
 * pinned to Indian Standard Time (Asia/Kolkata, UTC+5:30) so the same time
 * appears on every screen:
 *
 *  - Server-rendered pages (admin dashboard, result card, report) previously
 *    formatted with the *server's* local timezone — in the Docker/NAS
 *    deployment that is UTC, so times appeared 5½ hours behind IST.
 *  - Client components used the viewer's browser timezone, which could also
 *    drift from IST.
 *
 * The underlying moments are stored as absolute instants (epoch ms), so
 * converting them for display never changes the recorded value — only the
 * human-readable rendering is pinned to IST.
 */

const IST_TIME_ZONE = "Asia/Kolkata";

/** "12 Aug 2026" — medium date, no time. */
export function formatDateIST(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "medium",
  }).format(date);
}

/** "13 August 2026" — long date, no time (report letterheads). */
export function formatDateLongIST(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "12 Aug 2026, 8:15 pm" — medium date + short time (result pages). */
export function formatDateTimeIST(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** "12/08/26, 8:15 pm" — compact date + time (admin tables). */
export function formatDateTimeShortIST(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
