# Upgrade Plan — Certificate, Resume, Scale & Multi-District

Status: **Planning** (written 2026-08-13, after the Deoghar exam day)

---

## 1. Current state (verified)

The exam ran on **two containers on two separate SQLite databases** (both backed up):

| Database | Port | Users | Submitted | **Stuck** (started, not submitted) | Not started | Unique mobiles |
|---|---|---|---|---|---|---|
| `prod-exam-20260813_2117.db` (original, `vbgramg-training_exam_data`) | 3926 | 10 | 7 | **3** | 0 | 10 |
| `emergency-exam-20260813_2117.db` (test, `exam_data`) | 3927 | 52 | 23 | **24** | 5 | 49 |
| **After merge (unique)** | — | ~59 | ~30 | **~27** | ~5 | 59 |

- 3 mobiles exist in **both** databases (same person registered on both ports) — must be deduped.
- Backups: `/volume1/docker/backups/prod-exam-20260813_2117.db` and `emergency-exam-20260813_2117.db` (integrity check OK).
- Port 3927 now 301-redirects to 3926 (nginx container `viksit-redirect`).
- The exam answers are **NOT stored in browser localStorage** — they live in the `User.answers` JSON column, saved by the 20-second heartbeat. So "resume from browser cache" is not possible; resume must come from the database (mobile-number lookup). This is actually *better* — the DB is the single source of truth.

### Why submission got stuck (day-1 problems)
1. **Slow NAS + cold compiles**: first request to any route took 10–13 s (Next.js on-demand compilation on a slow volume); server actions (submit) could exceed client patience/timeouts.
2. **SQLite single-writer** on a shared spinning/RAID volume — write-heavy moments (many simultaneous heartbeats + submits) queue up.
3. **No server-side fallback**: if the browser tab died at the "submitting" moment, nothing ever submitted → user stays *stuck* forever.
4. **Admin-approval resume gate** blocked interrupted users who weren't actively connected.

---

## 2. Step 1 — Merge both databases (data first)

Goal: one database, every candidate reachable by mobile number.

1. Take **fresh backups** again (containers may have written since the morning backup).
2. Base = `prod` DB (it has the "official" 37-question bank + `exam_open` setting).
3. Import the 52 emergency users, **dedup by mobile**:
   - Same mobile in both DBs → keep the prod row; if the emergency row has more progress (answers/submittedAt) and prod doesn't, keep the *richer* row.
   - Different mobiles → insert as-is (new cuid ids are fine — ids are opaque).
4. Question bank merge: keep prod's 37 questions. Import emergency questions that are **not already present by exact text** (keeping their original ids so `sessionQuestions` of emergency users still resolve). After merge the admin can prune duplicates from the bank.
5. Re-run `prisma db push` on the merged DB; verify counts; keep both pre-merge backups.

**Deliverable:** `scripts/merge-dbs.ts` (idempotent, runnable with a `tsx` on the NAS) + verification report.

---

## 3. Step 2 — Mobile login → Resume / Certificate (core feature)

### New public flow
Home page gets a prominent **"Get Certificate / Resume Exam"** button:

1. User enters their **10-digit mobile number** (no password — mobile is the identity, as today's registration requires it).
2. Server looks up the user across the merged DB:
   - **Not found** → show "register as a new participant" (new users can still take the exam — window stays open).
   - **Found + already submitted** → show result + **Download Certificate**.
   - **Found + started but not submitted (stuck)** → **continue the exam directly** (auto-approved resume, no admin approval). Timer continues from `startedAt` — if time already ran out, auto-submit with what they answered.
   - **Found + registered but never started** → start the exam fresh.
3. Result/certificate page gets a **Print / Save as PDF** button.

### Resume gate change
- Replace the admin-approval gate for these users: a mobile-verified resume is **auto-approved**. Keep the in-session heartbeat resume path (already works for reloads within 2 minutes).
- **Stuck users whose time already expired → get EXTRA TIME** (decision): a mobile-verified resume grants a fresh completion window (e.g. the full 15 minutes again) instead of ending the exam. This overrides the "auto-submit at zero" behaviour for these resumes.
- Keep an admin **"force submit / finalize"** button for the few users who never come back (so the day's report is complete).

### Certificate (must look beautiful) — decisions locked
- **Content: PARTICIPATION ONLY** (decision) — candidate name, designation, block, district, event name, date, Reference ID. **No score / percentage / pass-fail on the certificate** (score stays on the result page).
- **Eligibility: submitted AND stuck users both get one** (decision) — anyone who registered and took the exam.
- **Download: browser Print → Save as PDF** (decision) — works on all mobiles, no heavy PDF server lib. Optional later: server-side PDF (pdfkit) for emailed/WhatsApp-shareable files.
- New page `/certificate?userId=…` — A4 landscape, print-ready:
  - Tricolor (saffron/white/green) header band + official title ("Viksit Bharat — G RAM G Mission (Gramin)" / DRDS, Deoghar).
  - **Emblem placeholder** (SVG — swap in the official image later; no external image dependency).
  - Candidate name (large, elegant serif), designation, block, district.
  - "successfully participated in / completed the post-training evaluation" text.
  - Date, Reference ID, **QR code** linking to a public verification URL (small `qrcode` npm dependency, pure JS — no external API).
  - Signature placeholders (Exam Controller / District Development Officer) with a line.
  - Hindi + English text like the rest of the portal.

### "Is the user still in cache?" — answer
No. The exam state was never in localStorage; it is in the DB via heartbeats. Mobile-number login is the reliable path. (If a user's answers never reached the server, there is nothing to recover — the exam restarts from scratch for them.)

---

## 4. Step 3 — Submission reliability (fix the stuck-submission class of bugs)

1. **Client**: submission with **retry + clear error** — if `submitExam` fails, show "Your answers are saved — trying again…" and retry (max 3× with backoff); never a silent hang.
2. **Server**: heartbeat already persists answers. **Decision: stuck users get extra time to complete** — the mobile-login resume grants a fresh window, so a dead tab is no longer a dead end. For users who never come back, the admin **force-submit** button finalizes their record so the report is complete.
3. **Server actions**: keep the 5 MB body limit; add explicit timeout/retry config so submit doesn't drop on slow disks.
4. **Infra** (the real fix) is Step 5/6 — a fast DB + multiple instances.

---

## 5. Step 4 — Multi-district via subdomains

Requirement: *"I should be able to conduct this exam in all districts — just create a subdomain and point it at the site."*

Status: **IMPLEMENTED** (2026-08-14).

### Design: one deployment, per-district databases, host-based routing
- App reads the `Host` header → first label = **district key** (`deoghar.portal.in`, `jamtara.portal.in`, …); unknown hosts (IP/localhost/www) fall back to the default district `deoghar`. ✓
- **Each district gets its own database** (isolated questions, candidates, exam window, certificates) — no data mixing. ✓
  - Now (NAS/SQLite): one SQLite file per district (e.g. `/data/deoghar.db`, `/data/jamtara.db`).
  - Later (scale): one PostgreSQL database per district (same isolation, real concurrency).
- **District registry** = `src/lib/districts.ts`: key → name, DB file (env override `DISTRICT_DB_URL_<KEY>`), blocks, certificate/report text (authority, date, venue, email/phone). Adding a district = adding one config entry + provisioning its DB file. **No code change per district.** ✓
- **Per-district Prisma client**: `src/lib/prisma.ts` now exports a Proxy that resolves the district from the request `Host` header on every property access — all existing query/action code is untouched and automatically hits the right database. ✓
- **Admin portal is per-district**: each district admin manages their own questions, opens/closes their own window, sees their own report. Admin password/token remain global env vars (per-district credentials still an open decision — see §8). ✓
- Existing Deoghar data becomes the `deoghar` district (no data change — it keeps the existing `DATABASE_URL` file). ✓
- All user-facing text (header, footer, home, register/blocks, result, certificate, report, result-card, admin shell) is district-aware. ✓

### Deploying a new district (ops)
1. Add one entry to `DISTRICTS` in `src/lib/districts.ts` (key, name, db file, blocks, program text).
2. Create the DNS subdomain (`<key>.example.com`) → reverse proxy (nginx on 80/443) → app. The app auto-detects the district from the subdomain.
3. Provision the DB file: locally `DATABASE_URL="file:./prisma/<key>.db" npx prisma db push`; in Docker add the file to `DISTRICT_DB_URLS` in docker-compose.yml (the entrypoint `db push`es each) and set the per-district override `DISTRICT_DB_URL_<KEY>` if the file path differs.
4. Each district starts with an empty bank — upload questions from that district's admin portal, open its own exam window.

---

## 6. Step 5 — Scale to 5000 concurrent (honest plan)

**Reality check:** a single Next.js container + SQLite on a home NAS cannot serve 5000 concurrent users — SQLite allows one writer, the NAS CPU/network/disk are the ceiling, and the app is single-instance. Expect **~50–150 concurrent** as-is. Scaling needs two things: a **real database** and **multiple app instances**.

| Tier | Where | Stack | Realistic concurrency |
|---|---|---|---|
| 1 (today) | NAS | SQLite + 1 container (post-merge, single instance) | ~50–150 |
| 2 | NAS | **PostgreSQL** (a Postgres container already runs for nrega on this NAS) + 1 Node instance + connection pool | ~500–1,000 |
| 3 | VPS/cloud (8+ vCPU, 16 GB) | Postgres (managed or self-hosted) + **N Node instances behind nginx/Caddy** + pgbouncer + static caching | **~5,000** |

- The app is already **stateless** (session state lives in the DB) — good; multi-instance just works once the DB is Postgres.
- Prisma change for Tier 2: swap `@prisma/adapter-better-sqlite3` → `@prisma/adapter-pg`; schema is compatible (JSON columns, cuid ids). `prisma db push` works for Postgres too.
- Deployment: the Dockerfile/`deps-prod` fix already made keeps images lean; multiple instances = `docker compose up --scale` behind the proxy.
- Load pattern note: 5,000 users doing a **15-minute exam** means ~5.5 registrations + heartbeats/sec sustained and ~5.5 submits/sec at the end — trivial for Postgres + 4–8 Node workers, impossible for SQLite single-writer.

---

## 7. Implementation order

1. **Merge DBs** (Step 1) — needs fresh backups, merge script, verification.
2. **Mobile login + resume + certificate** (Steps 2–3) — the feature users are waiting for.
3. **Submission reliability** (Step 4) — retries + server auto-submit.
4. **Multi-district** (Step 5) — district registry + host routing + per-district DBs + per-district admin.
5. **Scale** (Step 6) — Postgres migration → multi-instance → (optional) VPS.
6. **Ops**: nginx reverse proxy on 80/443 for clean URLs + subdomains; automated nightly backups of every district DB (cron → `/volume1/docker/backups/`).

Each step is independently shippable and verified (typecheck + test + deploy on 3926 before the next).

---

## 8. Decisions from the admin (locked 2026-08-13)

1. **Certificate download** → browser Print → PDF ✓
2. **Certificate content** → participation only (no score / pass-fail) ✓
3. **Stuck users with expired time** → give extra time to complete the exam ✓
4. **New users / exam window** → keep the admin-panel start/stop control exactly as it is today ✓
5. **Certificate eligibility** → submitted AND stuck users both get certificates ✓
6. **Duplicate candidates (both DBs)** → keep the record with the **higher score** (implemented + tested in `scripts/merge-dbs.ts`) ✓

### Still open
- **Hosting for 5000 users:** NAS-only for now (Tier 2 max), or ready to move to a VPS/cloud (Tier 3 = the only honest way to 5000)? If VPS, which one?
- **Per-district admin login**: currently a single global admin password/token for all districts (simplest, matches the one-deployment model). Want per-district credentials → per-district env vars in the registry.
- **QR verification link**: public domain (e.g. `exam.deoghar.nic.in`) or only the LAN/Tailscale IP for now?
- **Emblem/signature images**: any official image files to include on the certificate?
