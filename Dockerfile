# ============================================================
# Dockerfile — Viksit Bharat - G RAM G Examination Portal
# ------------------------------------------------------------
# Multi-stage build:
#   deps    → installs npm dependencies (with Prisma postinstall)
#   builder → prisma generate + next build (standalone output)
#   runner  → minimal image: standalone server + SQLite driver
#             + Prisma CLI (for `db push` on container start)
# ============================================================

# ---------- Stage 1: dependencies ----------
FROM node:20-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# The postinstall script runs `prisma generate`, so the schema, config and
# a (placeholder) DATABASE_URL must be present at install time. No real DB
# connection is made during generate.
ENV DATABASE_URL="file:./prisma/dev.db"
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------- Stage 2: build the application ----------
FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./prisma/dev.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the TypeScript Prisma client, then build the standalone bundle.
RUN npx prisma generate && npm run build

# ---------- Stage 3: minimal runtime ----------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3926
# Prisma CLI / Node may want a writable HOME for the non-root user.
ENV HOME=/tmp

# OpenSSL is required by Prisma's schema engine (used by `db push`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Non-root user + SQLite data directory (owned by that user so the
# Docker volume mounted at /data is writable by the app).
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /data \
  && chown nextjs:nodejs /data

# --- Next.js standalone server (traced node_modules + server.js) ---
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets served by the standalone server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (favicon, logos, etc.).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- Prisma runtime pieces ---
# 1) SQLite driver (native better-sqlite3 binding).
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# 2) Full @prisma scope: client runtime, adapter, CLI engines (db push).
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# 3) Prisma CLI itself (entrypoint runs `prisma db push` on startup).
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# 4) dotenv — loaded by prisma.config.ts.
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv
# 5) Schema + config used by `prisma db push`.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# --- Entrypoint ---
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3926

ENTRYPOINT ["./entrypoint.sh"]
