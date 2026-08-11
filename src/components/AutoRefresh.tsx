"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * AutoRefresh — silently re-fetches the current server component tree on an
 * interval via `router.refresh()`. Used on the admin dashboard so the LIVE
 * status panel updates itself without a manual page reload.
 */
export default function AutoRefresh({
  intervalMs = 10_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
