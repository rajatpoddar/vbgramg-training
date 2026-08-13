/**
 * Merge two exam-portal SQLite databases into a single database.
 *
 * Why: on exam day the portal accidentally ran on TWO containers with TWO
 * separate SQLite databases (port 3926 "original" and port 3927 "test").
 * Candidates are split across both. This script produces one authoritative
 * database so the certificate / resume flow can look up any candidate by
 * mobile number.
 *
 * Merge rules (as decided by the admin):
 *  - Users:   deduplicated by NORMALISED mobile number (digits only). When a
 *             candidate exists more than once — across databases OR within a
 *             single database — keep the row with the HIGHER final score;
 *             tie-break → the one that submitted; final tie-break → the
 *             "original" (prod, or first-seen) row.
 *  - Questions: deduplicated by NORMALISED question text. Emergency questions
 *             whose text already exists in the original bank are dropped, and
 *             the emergency candidates' `sessionQuestions` / `answers` are
 *             remapped to the surviving question id so scores stay intact.
 *
 * Usage (run with the project's tsx):
 *   npx tsx scripts/merge-dbs.ts <prod.db> <emergency.db> <output.db>
 *
 * The output database is a copy of <prod.db> (schema + original data) with
 * the emergency rows merged in. Run it against BACKUPS first; never against
 * a live database.
 */
import fs from "node:fs";
import Database from "better-sqlite3";

/* ------------------------------- helpers ------------------------------- */

/** Digits-only mobile; falls back to a trimmed lowercase string when short. */
export function normalizeMobile(mobile: string): string {
  const digits = (mobile ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : (mobile ?? "").trim().toLowerCase();
}

/**
 * Normalise question text for matching: lowercase, keep only letters and
 * digits (any script), drop punctuation/spacing so "Capital of India?"
 * and "Capital of India ?" match.
 */
export function normalizeText(text: string): string {
  return (text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Remap question ids inside a stored JSON value (either a string[] of ids —
 * `sessionQuestions` — or an object keyed by question id — `answers`) from
 * the emergency database ids to the merged-database ids.
 */
function remapJson(
  value: unknown,
  idMap: Map<string, string>
): unknown {
  if (value == null) return value;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value; // not JSON — leave untouched
    }
  }
  if (Array.isArray(parsed)) {
    return JSON.stringify(parsed.map((id) => idMap.get(String(id)) ?? id));
  }
  if (typeof parsed === "object" && parsed !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed)) {
      out[idMap.get(key) ?? key] = val;
    }
    return JSON.stringify(out);
  }
  return value;
}

type UserRow = {
  id: string;
  name: string;
  designation: string;
  block: string;
  mobile: string;
  email: string | null;
  score: number;
  submittedAt: string | null;
  startedAt: string | null;
  lastActiveAt: string | null;
  liveScore: number;
  resumeRequestedAt: string | null;
  resumeApprovedAt: string | null;
  answers: unknown;
  sessionQuestions: unknown;
  createdAt: string;
};

type QuestionRow = {
  id: string;
  text: string;
  options: unknown;
  correctAnswer: string;
  createdAt: string;
};

/** Which of two rows for the same mobile should survive? */
function pickWinner(a: UserRow, b: UserRow): UserRow {
  if (b.score !== a.score) return b.score > a.score ? b : a;
  const aSubmitted = a.submittedAt ? 1 : 0;
  const bSubmitted = b.submittedAt ? 1 : 0;
  if (bSubmitted !== aSubmitted) return bSubmitted > aSubmitted ? b : a;
  return a; // final tie-break: keep the "original" (prod) row
}

/* --------------------------------- main -------------------------------- */

export function mergeDatabases(
  prodPath: string,
  emergencyPath: string,
  outPath: string
): {
  output: string;
  prodUsers: number;
  emergencyUsers: number;
  mergedUsers: number;
  prodQuestions: number;
  emergencyQuestions: number;
  mergedQuestions: number;
  remappedQuestions: number;
  dedupedUsers: number;
} {
  // Start from a copy of the original database (schema + original data).
  fs.copyFileSync(prodPath, outPath);

  const prod = new Database(prodPath, { readonly: true });
  const emg = new Database(emergencyPath, { readonly: true });
  const db = new Database(outPath);

  const prodQs = prod.prepare("SELECT * FROM Question").all() as QuestionRow[];
  const emgQs = emg.prepare("SELECT * FROM Question").all() as QuestionRow[];

  /* ---- Questions: keep original ids; import non-duplicate emergency
          questions with their original ids; map duplicates -> survivor ---- */
  const textToId = new Map<string, string>();
  for (const q of prodQs) textToId.set(normalizeText(q.text), q.id);

  const idMap = new Map<string, string>(); // emergency id -> merged id
  let duplicateQuestions = 0;
  const insertQuestion = db.prepare(
    `INSERT OR IGNORE INTO Question (id, text, options, correctAnswer, createdAt)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const q of emgQs) {
    const norm = normalizeText(q.text);
    const existing = textToId.get(norm);
    if (existing) {
      idMap.set(q.id, existing);
      duplicateQuestions += 1;
    } else {
      textToId.set(norm, q.id);
      idMap.set(q.id, q.id);
      insertQuestion.run(q.id, q.text, q.options, q.correctAnswer, q.createdAt);
    }
  }

  /* ---- Users: dedupe by normalised mobile, higher score wins. Dedupe runs
        across databases AND within each database — a candidate may have
        registered twice on the same port (that happened on the emergency
        port: 52 users, 49 unique mobiles). ---- */
  const prodUsers = prod.prepare("SELECT * FROM User").all() as UserRow[];
  const emgUsers = emg.prepare("SELECT * FROM User").all() as UserRow[];

  // Winner per mobile within prod itself.
  const prodWinner = new Map<string, UserRow>();
  for (const u of prodUsers) {
    const key = normalizeMobile(u.mobile);
    const cur = prodWinner.get(key);
    prodWinner.set(key, cur ? pickWinner(cur, u) : u);
  }

  const insertUser = db.prepare(
    `INSERT INTO User (
       id, name, designation, block, mobile, email, score, submittedAt,
       startedAt, lastActiveAt, liveScore, resumeRequestedAt, resumeApprovedAt,
       answers, sessionQuestions, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateUser = db.prepare(
    `UPDATE User SET
       name = ?, designation = ?, block = ?, mobile = ?, email = ?, score = ?,
       submittedAt = ?, startedAt = ?, lastActiveAt = ?, liveScore = ?,
       resumeRequestedAt = ?, resumeApprovedAt = ?, answers = ?,
       sessionQuestions = ?, createdAt = ?
     WHERE id = ?`
  );
  const deleteUser = db.prepare("DELETE FROM User WHERE id = ?");

  const rowToValues = (u: UserRow): unknown[] => [
    u.name,
    u.designation,
    u.block,
    u.mobile,
    u.email,
    u.score,
    u.submittedAt,
    u.startedAt,
    u.lastActiveAt,
    u.liveScore,
    u.resumeRequestedAt,
    u.resumeApprovedAt,
    remapJson(u.answers, idMap),
    remapJson(u.sessionQuestions, idMap),
    u.createdAt,
  ];

  let dedupedUsers = 0;

  // Drop losing prod-internal duplicates from the output copy.
  for (const u of prodUsers) {
    if (prodWinner.get(normalizeMobile(u.mobile))!.id !== u.id) {
      deleteUser.run(u.id);
      dedupedUsers += 1;
    }
  }

  // Normalised mobile -> currently surviving row (id + data) in the output DB.
  const survivor = new Map<string, { id: string; row: UserRow }>();
  for (const [key, winner] of prodWinner) {
    survivor.set(key, { id: winner.id, row: winner });
  }

  for (const emgUser of emgUsers) {
    const key = normalizeMobile(emgUser.mobile);
    const cur = survivor.get(key);

    if (!cur) {
      // Brand-new candidate → insert (remapping any question ids).
      insertUser.run(emgUser.id, ...rowToValues(emgUser));
      survivor.set(key, { id: emgUser.id, row: emgUser });
      continue;
    }

    // Candidate already exists (from prod or an earlier emergency row) →
    // keep the higher-scoring row.
    const winner = pickWinner(cur.row, emgUser);
    dedupedUsers += 1;
    if (winner.id === emgUser.id) {
      // New row wins → overwrite the surviving row in place (keeps its id,
      // so URLs / references to the survivor stay valid).
      updateUser.run(...rowToValues(emgUser), cur.id);
      survivor.set(key, { id: cur.id, row: emgUser });
    }
    // else: current survivor wins → nothing to do (already in the copy).
  }

  prod.close();
  emg.close();
  db.close();

  const mergedUsers = dbCount(outPath, "User");
  const mergedQuestions = dbCount(outPath, "Question");

  return {
    output: outPath,
    prodUsers: prodUsers.length,
    emergencyUsers: emgUsers.length,
    mergedUsers,
    prodQuestions: prodQs.length,
    emergencyQuestions: emgQs.length,
    mergedQuestions,
    duplicateQuestions,
    dedupedUsers,
  };
}

function dbCount(dbPath: string, table: string): number {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as {
    c: number;
  };
  db.close();
  return row.c;
}

/* --------------------------- CLI entry point --------------------------- */

if (process.argv[1] && process.argv[1].endsWith("merge-dbs.ts")) {
  const [prodPath, emergencyPath, outPath] = process.argv.slice(2);
  if (!prodPath || !emergencyPath || !outPath) {
    console.error(
      "Usage: npx tsx scripts/merge-dbs.ts <prod.db> <emergency.db> <output.db>"
    );
    process.exit(1);
  }
  const report = mergeDatabases(prodPath, emergencyPath, outPath);
  console.log(JSON.stringify(report, null, 2));
}
