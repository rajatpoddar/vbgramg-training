import "server-only";
import { cookies } from "next/headers";

/**
 * Admin authentication.
 *
 * The admin area is protected by a single shared password (set via the
 * ADMIN_PASSWORD environment variable). On successful login we set an
 * httpOnly session cookie whose value must match the ADMIN_TOKEN env var;
 * `middleware.ts` enforces this on every /admin/* request.
 */

export const ADMIN_SESSION_COOKIE = "admin_session";

/** Admin password from env (fallback only for local development). */
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

/** Session token stored in the cookie; must match middleware. */
export function getAdminToken(): string {
  return process.env.ADMIN_TOKEN ?? "dev-admin-token";
}

/**
 * Fail-closed guard: in production the weak dev defaults are rejected so an
 * operator who forgets to configure credentials cannot deploy an open admin
 * portal. Returns an error message, or null when the deployment is safe.
 */
export function getAdminConfigError(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "admin123") {
    return "ADMIN_PASSWORD is not set to a strong value. Refusing admin login.";
  }
  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN === "dev-admin-token") {
    return "ADMIN_TOKEN is not set to a strong value. Refusing admin login.";
  }
  return null;
}

/** True if the current request holds a valid admin session cookie. */
export function isAdminAuthenticated(): boolean {
  const store = cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === getAdminToken();
}

/** Set the httpOnly session cookie after a successful login. */
export function setAdminSession(): void {
  const store = cookies();

  // `secure` cookies are only sent over HTTPS. On a private NAS served over
  // plain HTTP the admin login would otherwise silently fail, so this can be
  // overridden with COOKIE_SECURE=false. Default: secure when in production.
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";

  store.set(ADMIN_SESSION_COOKIE, getAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

/** Clear the session cookie on logout. */
export function clearAdminSession(): void {
  const store = cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}
