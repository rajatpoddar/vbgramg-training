#!/bin/sh
# ============================================================
# Container entrypoint
#  1. Ensure the SQLite data directory exists (fresh volume).
#  2. Sync the Prisma schema to the SQLite file (`db push`).
#  3. Start the Next.js standalone server.
# ============================================================
set -e

echo "[entrypoint] Ensuring SQLite data directory exists..."
mkdir -p /data

echo "[entrypoint] Syncing database schema (prisma db push)..."
# Note: Prisma 7 no longer auto-generates the client on `db push`.
node node_modules/prisma/build/index.js db push

# Multi-district (PLAN.md Step 4): each extra district gets its own SQLite
# file on the same volume. List them in DISTRICT_DB_URLS (comma-separated),
# e.g. "file:/data/jamtara.db,file:/data/giridih.db". The district registry
# in src/lib/districts.ts maps subdomains → these DB files.
if [ -n "$DISTRICT_DB_URLS" ]; then
  for url in $(echo "$DISTRICT_DB_URLS" | tr ',' ' '); do
    echo "[entrypoint] Syncing district DB: $url"
    DATABASE_URL="$url" node node_modules/prisma/build/index.js db push
  done
fi

echo "[entrypoint] Starting Viksit Bharat - G RAM G portal..."
exec node server.js
