# ============================================================
# Dockerfile — Viksit Bharat - G RAM G Examination Portal
# ------------------------------------------------------------
# Multi-stage build:
#   deps      → installs ALL npm dependencies (with Prisma postinstall)
#   deps-prod → installs ONLY production dependencies (lean node_modules
#               for the runner — no typescript/eslint/tailwind/...)
#   builder   → prisma generate + next build (standalone output)
#   runner    → minimal image: standalone server + SQLite driver
#               + Prisma CLI (for `db push` on container start)
# ============================================================

# ---------- Stage 1: dependencies ----------
FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# The postinstall script runs `prisma generate`, so the schema, config and
# a (placeholder) DATABASE_URL must be present at install time. No real DB
# connection is made during generate.
ENV DATABASE_URL="file:./prisma/dev.db"

# better-sqlite3 is a native addon — node-gyp needs python3 + build tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---------- Stage 1b: production-only dependencies (runtime) ----------
# Same platform as the runner (node:22-slim), so the native better-sqlite3
# binding built here is ABI-compatible with the one the app runs on.
FROM node:22-slim AS deps-prod
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The postinstall script runs `prisma generate`, so a (placeholder)
# DATABASE_URL must be present — no real DB connection is made.
ENV DATABASE_URL="file:./prisma/dev.db"

# better-sqlite3 is a native addon — node-gyp needs python3 + build tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Production-only install: prisma CLI + dotenv (imported by prisma.config.ts)
# are runtime deps now (see package.json), so `db push` works without the
# full dev toolchain.
RUN npm ci --omit=dev

# ---------- Stage 2: build the application ----------
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./prisma/dev.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the TypeScript Prisma client, then build the standalone bundle.
RUN npx prisma generate && npm run build

# ---------- Stage 3: minimal runtime ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3926
# Run in Indian Standard Time so `new Date()` / logs use IST.
ENV TZ=Asia/Kolkata
# Prisma CLI / Node may want a writable HOME for the non-root user.
ENV HOME=/tmp

# OpenSSL is required by Prisma's schema engine (used by `db push`); tzdata
# makes the TZ environment variable effective inside the container.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
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
# Copy ONLY the production dependencies (prisma CLI + dotenv + app deps).
# The dev toolchain (typescript, eslint, tailwind, ...) is not needed at
# runtime — keeping this layer small makes builds much faster.
COPY --from=deps-prod --chown=nextjs:nodejs /app/node_modules ./node_modules
# Schema + config used by `prisma db push`
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# --- Entrypoint ---
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3926

ENTRYPOINT ["./entrypoint.sh"]
