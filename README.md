# Viksit Bharat - G RAM G — Online Examination Portal

Official online examination system for the **Viksit Bharat - G RAM G** training
programme, built for the **District Rural Development Agency (DRDA), Deoghar**,
Government of Jharkhand.

| | |
|---|---|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS, Lucide React |
| **Database** | Prisma ORM 7 + SQLite (`better-sqlite3` driver) |
| **Deployment** | Docker (standalone output), port `3926` |

---

## Features

### Candidate side
- **Registration** — Name, Designation, Block, Mobile, Email (all mandatory,
  validated on both client and server).
- **Anti-cheat (low-level)** — the exam runs in full-screen; switching tabs,
  losing window focus, or exiting full-screen raises a strictly-worded modal
  warning. **Three violations auto-submit the exam.**
- **Real-time feedback** — clicking an option instantly shows green (correct)
  or red (wrong, with the correct option highlighted); the live score counter
  updates immediately and questions lock after answering.
- **Result page** — final server-computed score, percentage, and pass/fail
  status (pass ≥ 40%).

### Admin side (protected by password + session cookie)
- **Dashboard** — aggregate stats + full table of registered candidates and
  scores.
- **Question Manager** — add / edit / delete MCQ questions (4 options, one
  marked correct).
- **Print-Ready Analytics Report** — A4-formatted (`@media print`) with an
  official letterhead, bordered table, summary strip, and a **signature
  column**. All navigation/buttons are hidden when printing.

---

## Prerequisites

- **Node.js 20 LTS** (`.nvmrc` is provided — run `nvm use`). The Docker image
  already runs Node 20.
- ⚠️ **Do not use Node 22+ for local development.** Next.js 14.2 has a known
  incompatibility with Node 22+ where **server actions fail with
  `Error: Connection closed`**. The production Docker container uses Node 20 and
  is unaffected, but local `next dev`/`next start` must run on Node 20.

---

## Quick start (local development)

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Configure environment
cp .env.example .env
#    → edit ADMIN_PASSWORD / ADMIN_TOKEN

# 3. Create the SQLite database
npm run db:push

# 4. Start the dev server
npm run dev
# → http://localhost:3926
```

Then:
1. Visit **/admin/login**, log in with your `ADMIN_PASSWORD`, and add a few
   questions via the Question Manager.
2. Visit **/** → *Register for Exam*, fill in the form, and the exam starts.

> The SQLite file is created at `prisma/dev.db`. It is git-ignored.

---

## Docker deployment (your NAS)

Requirements: Docker Engine with the **Compose** plugin.

```bash
# 1. (Recommended) put your secrets in a .env file next to docker-compose.yml
cat > .env <<'EOF'
ADMIN_PASSWORD=ChangeMe_StrongPassword
ADMIN_TOKEN=ChangeMe_LongRandomToken
COOKIE_SECURE=false
EOF

# 2. Build & start
docker compose up -d --build

# 3. Verify
docker compose ps
# → http://<NAS-IP>:3926
```

- **Persistence** — the SQLite database is stored on the named volume
  `exam_data`, mounted at `/data`. Restarting or rebuilding the container
  **does not** lose data.
- **Schema updates** — the entrypoint runs `prisma db push` automatically on
  every container start, so the database stays in sync with the schema.
- **Backup** — back up the volume (e.g. `docker run --rm -v
  viksit-bharat-g-ram-g-exam_exam_data:/data -v $(pwd):/backup alpine cp
  /data/exam.db /backup/`).

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite location. Local: `file:./prisma/dev.db`. Docker: `file:/data/exam.db` |
| `ADMIN_PASSWORD` | Admin Portal login password (**change in production**) |
| `ADMIN_TOKEN` | Random token stored in the httpOnly admin session cookie (**change in production**) |
| `COOKIE_SECURE` | `true` only when served over HTTPS; `false` on plain-HTTP NAS setups |

---

## Project structure

```
prisma/
  schema.prisma        # User + Question models (SQLite)
src/
  app/
    page.tsx           # Home / landing
    register/          # Candidate registration
    exam/              # Exam (anti-cheat + real-time feedback)
    result/            # Final score page
    admin/
      login/           # Admin login
      page.tsx         # Dashboard (candidates + scores)
      questions/       # Question Manager CRUD
      report/          # Print-ready analytics report
  components/
    Header / Footer / AdminShell / RegisterForm / ExamInterface /
    AdminLoginForm / QuestionManager / PrintButton
  lib/
    prisma.ts          # Prisma client singleton (SQLite driver adapter)
    queries.ts         # Server-only query layer
    actions/           # Server actions (exam.ts, admin.ts)
    admin.ts           # Admin session helpers
    validation.ts      # Shared form validation
middleware.ts          # Protects /admin/* (Edge runtime, cookie check)
Dockerfile / docker-compose.yml / entrypoint.sh
```

## Security notes

- Scores are **recomputed on the server** at submission time — the client only
  sends the selected answers, never a trusted score.
- `submittedAt` is stamped on submission; a submitted candidate cannot re-take
  the exam (server-guarded). A candidate whose session was interrupted (e.g.
  browser crash) can re-register with the same email and resume.
- The admin session uses an **httpOnly** cookie compared against `ADMIN_TOKEN`;
  all `/admin/*` routes are protected by Edge middleware.
- **Admin login is rate-limited** (5 failed attempts → 5-minute lockout) and
  **fails closed in production** if `ADMIN_PASSWORD` / `ADMIN_TOKEN` are unset
  or left at the dev defaults.
- The correct answer is shipped to the browser (required for real-time
  feedback). This is a low-level anti-cheat system — the authoritative score is
  always the server-computed one.
- `DATABASE_URL` is an absolute path on the Docker volume; credentials live in
  `.env` / Compose environment, never in the image.
- The Docker container runs as a **non-root** user.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `python3 scripts/import_mcqs.py [--replace]` | Import the official DRDA MCQ DOCX question bank (parses `A)…D)` options + `सही उत्तर`) |
