import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware — protects the entire /admin/* area.
 *
 * The admin session cookie (`admin_session`) is set by the login server
 * action and must exactly match the ADMIN_TOKEN environment variable.
 * Note: this runs on the Edge runtime, so it must stay dependency-free
 * (no Prisma / next/headers imports). The token fallback below must match
 * `getAdminToken()` in src/lib/admin.ts for local development.
 */

const ADMIN_SESSION_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page itself is always reachable.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const expected = process.env.ADMIN_TOKEN ?? "dev-admin-token";

  if (!token || token !== expected) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
