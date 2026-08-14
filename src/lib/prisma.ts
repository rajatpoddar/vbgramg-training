import "server-only"; // Guards against accidentally importing this into client components
import { headers } from "next/headers";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  dbUrlForDistrict,
  districtFromHost,
  DEFAULT_DISTRICT_KEY,
} from "@/lib/districts";

/**
 * Prisma Client factory (Prisma 7), one client per district.
 *
 * Prisma 7 generates a TypeScript client into `src/generated/prisma` and
 * requires a *driver adapter* for the actual database connection. For
 * SQLite we use the official `@prisma/adapter-better-sqlite3` adapter.
 *
 * Multi-district (PLAN.md Step 4): each district gets its own SQLite file
 * and its own cached PrismaClient. The exported `prisma` is a Proxy that
 * resolves the district from the current request's `Host` header on every
 * property access, so NO call site needs to know about districts — the
 * same `prisma.user.findMany(...)` automatically queries the right
 * database per subdomain. Unknown hosts fall back to the default district
 * (Deoghar), keeping the existing deployment behaviour unchanged.
 */

// Cache clients across hot-reloads in development.
const globalForPrisma = globalThis as unknown as {
  prismaClients: Map<string, PrismaClient> | undefined;
};

const clients =
  globalForPrisma.prismaClients ?? new Map<string, PrismaClient>();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClients = clients;
}

function createPrismaClient(dbUrl: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

/** Get (and lazily create) the client for a district key. */
function clientForDistrict(key: string): PrismaClient {
  let client = clients.get(key);
  if (!client) {
    client = createPrismaClient(dbUrlForDistrict(key));
    clients.set(key, client);
  }
  return client;
}

/**
 * The client for the current request. `headers()` is available inside
 * server components, route handlers and server actions; outside a request
 * scope (build-time module evaluation) we fall back to the default
 * district rather than throwing.
 */
function clientForCurrentRequest(): PrismaClient {
  try {
    return clientForDistrict(districtFromHost(headers().get("host")).key);
  } catch {
    return clientForDistrict(DEFAULT_DISTRICT_KEY);
  }
}

/**
 * Per-district `prisma`. Every property access (`prisma.user`,
 * `prisma.$transaction`, …) forwards to the current request's district
 * client, so all existing query code works unchanged.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = clientForCurrentRequest();
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});
