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

echo "[entrypoint] Starting Viksit Bharat - G RAM G portal..."
exec node server.js
