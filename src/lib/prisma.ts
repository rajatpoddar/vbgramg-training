import "server-only"; // Guards against accidentally importing this into client components
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Prisma Client singleton (Prisma 7).
 *
 * Prisma 7 generates a TypeScript client into `src/generated/prisma` and
 * requires a *driver adapter* for the actual database connection. For
 * SQLite we use the official `@prisma/adapter-better-sqlite3` adapter.
 *
 * The generated client compiles queries at build time, so at runtime only
 * the SQLite driver is needed — which keeps the Docker image small.
 */

// Reuse a single client across hot-reloads in development.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Absolute path in Docker (`file:/data/exam.db`); relative in local dev.
  const databaseUrl =
    process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
