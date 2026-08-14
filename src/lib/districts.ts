import "server-only";
import { headers } from "next/headers";

/**
 * District registry + host-based routing (Step 4 of PLAN.md).
 *
 * One deployment serves every district: the first label of the `Host`
 * header selects the district (`deoghar.portal.in` → deoghar,
 * `jamtara.portal.in` → jamtara). Unknown hosts (raw IPs, localhost,
 * apex domains, `www.…`) fall back to the default district, so the
 * existing Deoghar deployment keeps working unchanged.
 *
 * Each district has its OWN SQLite database (isolated questions,
 * candidates, exam window and certificates — no data mixing). Adding a
 * new district = adding one entry here + provisioning its DB file
 * (see `scripts/`/entrypoint + PLAN.md). No code changes per district.
 */

export type DistrictProgram = {
  /** Exam date, e.g. "13th August, 2026". */
  eventDate: string;
  /** Venue line, e.g. "DRDS Training Hall, Deoghar". */
  venue: string;
  /** Official authority line, e.g. "District Rural Development Section (DRDS), Deoghar". */
  authority: string;
  /** District label for certificates, e.g. "Deoghar, Jharkhand". */
  districtLabel: string;
  /** Contact email shown in the footer. */
  contactEmail: string;
  /** Contact phone shown in the footer. */
  contactPhone: string;
};

export type DistrictConfig = {
  /** Host subdomain key — also used as the DB lookup key. */
  key: string;
  /** Human-readable district name, e.g. "Deoghar". */
  name: string;
  /** Default SQLite file for this district (env override supported). */
  dbUrl: string;
  /** Blocks offered in the registration form. */
  blocks: string[];
  /** Text used across pages, certificates and the printed report. */
  program: DistrictProgram;
};

export const DEFAULT_DISTRICT_KEY = "deoghar";

/** All configured districts. Add a new district here (one entry). */
export const DISTRICTS: DistrictConfig[] = [
  {
    key: "deoghar",
    name: "Deoghar",
    // The default district keeps the existing database — no data change.
    dbUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    blocks: [
      "Deoghar",
      "Devipur",
      "Karon",
      "Madhupur",
      "Margomunda",
      "Mohanpur",
      "Palojori",
      "Sarath",
      "Sarwan",
      "Sonaraithari",
    ],
    program: {
      eventDate: "13th August, 2026",
      venue: "DRDS Training Hall, Deoghar",
      authority: "District Rural Development Section (DRDS), Deoghar",
      districtLabel: "Deoghar, Jharkhand",
      contactEmail: "drda.deoghar@gov.in",
      contactPhone: "06432-XXXXXX",
    },
  },
  {
    key: "jamtara",
    name: "Jamtara",
    // Override in production via DISTRICT_DB_URL_JAMTARA (e.g. file:/data/jamtara.db).
    dbUrl: "file:./prisma/jamtara.db",
    blocks: [
      "Jamtara",
      "Fatehpur",
      "Kundhit",
      "Nala",
      "Narayanpur",
    ],
    program: {
      eventDate: "13th August, 2026",
      venue: "DRDS Training Hall, Jamtara",
      authority: "District Rural Development Section (DRDS), Jamtara",
      districtLabel: "Jamtara, Jharkhand",
      contactEmail: "drda.jamtara@gov.in",
      contactPhone: "06433-XXXXXX",
    },
  },
];

/** The effective DB URL for a district, honouring the per-district env override. */
export function dbUrlForDistrict(key: string): string {
  const configured =
    DISTRICTS.find((d) => d.key === key) ?? defaultDistrict();
  return (
    process.env[`DISTRICT_DB_URL_${key.toUpperCase()}`] ?? configured.dbUrl
  );
}

export function defaultDistrict(): DistrictConfig {
  return (
    DISTRICTS.find((d) => d.key === DEFAULT_DISTRICT_KEY) ?? DISTRICTS[0]
  );
}

/** Resolve a Host header value to a district (unknown hosts → default). */
export function districtFromHost(host?: string | null): DistrictConfig {
  if (!host) return defaultDistrict();
  const labels = host.split(":")[0].toLowerCase().split(".");
  // District = first subdomain label (skip a leading "www").
  const candidate = labels[0] === "www" ? labels[1] : labels[0];
  return DISTRICTS.find((d) => d.key === candidate) ?? defaultDistrict();
}

/**
 * The district for the current request, from the Host header.
 * Server components, route handlers and server actions all run inside
 * the request scope, so `headers()` is available here.
 */
export function getDistrict(): DistrictConfig {
  return districtFromHost(headers().get("host"));
}

/** District key for the current request (safe fallback to the default). */
export function getDistrictKey(): string {
  try {
    return getDistrict().key;
  } catch {
    return DEFAULT_DISTRICT_KEY;
  }
}
