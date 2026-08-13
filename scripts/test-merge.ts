/**
 * Local test for scripts/merge-dbs.ts — builds two synthetic exam-portal
 * databases (same schema as the real ones) and asserts the merge rules:
 *  - users deduped by normalised mobile, higher score wins
 *  - questions deduped by normalised text, ids remapped in session data
 *
 * Run: npx tsx scripts/test-merge.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { mergeDatabases, normalizeMobile } from "./merge-dbs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "designation" TEXT NOT NULL,
  "block" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "email" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" DATETIME,
  "startedAt" DATETIME,
  "lastActiveAt" DATETIME,
  "liveScore" INTEGER NOT NULL DEFAULT 0,
  "resumeRequestedAt" DATETIME,
  "resumeApprovedAt" DATETIME,
  "answers" JSON,
  "sessionQuestions" JSON,
  "createdAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Question" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "text" TEXT NOT NULL,
  "options" JSON NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL
);
`;

function makeDb(dir: string, name: string): Database {
  const db = new Database(path.join(dir, name));
  db.exec(SCHEMA);
  return db;
}

function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "merge-test-"));
  const prodPath = path.join(dir, "prod.db");
  const emgPath = path.join(dir, "emergency.db");
  const outPath = path.join(dir, "merged.db");

  const prod = makeDb(dir, "prod.db");
  const emg = makeDb(dir, "emergency.db");

  // ---- Original DB (prod): 4 questions, 3 users ----
  const prodQs = [
    { id: "q1", text: "Capital of India?", options: '["Delhi","Mumbai"]', correctAnswer: "Delhi" },
    { id: "q2", text: "2 + 2 = ?", options: '["3","4"]', correctAnswer: "4" },
    { id: "q3", text: "Largest planet?", options: '["Jupiter","Earth"]', correctAnswer: "Jupiter" },
    { id: "q4", text: "National animal?", options: '["Tiger","Lion"]', correctAnswer: "Tiger" },
  ];
  for (const q of prodQs) {
    prod
      .prepare("INSERT INTO Question (id,text,options,correctAnswer,createdAt) VALUES (?,?,?,?,?)")
      .run(q.id, q.text, q.options, q.correctAnswer, "2026-08-13T00:00:00.000Z");
  }

  const insertUser = (db: Database) =>
    db.prepare(
      `INSERT INTO User (id,name,designation,block,mobile,email,score,submittedAt,startedAt,lastActiveAt,liveScore,resumeRequestedAt,resumeApprovedAt,answers,sessionQuestions,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );

  // p1: submitted, score 10 — also present in emergency with score 18 → emergency should win
  insertUser(prod).run("p1", "Ramesh", "Sewak", "Deoghar", "9876543210", null, 10, "2026-08-13T05:00:00.000Z", "2026-08-13T04:00:00.000Z", "2026-08-13T05:00:00.000Z", 10, null, null, JSON.stringify({ q1: "Delhi" }), JSON.stringify(["q1", "q2"]), "2026-08-13T03:00:00.000Z");
  // p2: submitted, score 15 — emergency has score 5 → prod should win
  insertUser(prod).run("p2", "Sita", "Sewak", "Madhupur", "9876543211", null, 15, "2026-08-13T05:00:00.000Z", "2026-08-13T04:00:00.000Z", "2026-08-13T05:00:00.000Z", 15, null, null, JSON.stringify({ q1: "Delhi", q2: "4" }), JSON.stringify(["q1", "q2"]), "2026-08-13T03:00:00.000Z");
  // p3: unique to prod (stuck)
  insertUser(prod).run("p3", "Mohan", "Clerk", "Sarath", "9876543212", null, 0, null, "2026-08-13T04:00:00.000Z", "2026-08-13T04:30:00.000Z", 0, null, null, JSON.stringify({}), JSON.stringify(["q3", "q4"]), "2026-08-13T03:00:00.000Z");
  prod.prepare("INSERT INTO Setting (key,value) VALUES ('exam_open','false')").run();

  // ---- Emergency DB: 3 questions (q1 duplicate text, q5 new), 3 users ----
  const emgQs = [
    { id: "eq1", text: "Capital of India ?", options: '["Delhi","Mumbai"]', correctAnswer: "Delhi" }, // duplicate (whitespace differs)
    { id: "eq2", text: "First Prime Minister?", options: '["Nehru","Gandhi"]', correctAnswer: "Nehru" }, // new
    { id: "eq3", text: "National bird?", options: '["Peacock","Sparrow"]', correctAnswer: "Peacock" }, // new
  ];
  for (const q of emgQs) {
    emg
      .prepare("INSERT INTO Question (id,text,options,correctAnswer,createdAt) VALUES (?,?,?,?,?)")
      .run(q.id, q.text, q.options, q.correctAnswer, "2026-08-13T00:00:00.000Z");
  }

  // e1: same mobile as p1, HIGHER score (18) → should win over p1; answers reference eq1 (duplicate → remap to q1)
  insertUser(emg).run("e1", "Ramesh Kumar", "Sewak", "Deoghar", "9876543210", null, 18, "2026-08-13T05:00:00.000Z", "2026-08-13T04:00:00.000Z", "2026-08-13T05:00:00.000Z", 18, null, null, JSON.stringify({ eq1: "Delhi" }), JSON.stringify(["eq1", "eq2"]), "2026-08-13T03:00:00.000Z");
  // e2: same mobile as p2, LOWER score (5) → prod p2 should win
  insertUser(emg).run("e2", "Sita Devi", "Sewak", "Madhupur", "9876543211", null, 5, "2026-08-13T05:00:00.000Z", "2026-08-13T04:00:00.000Z", "2026-08-13T05:00:00.000Z", 5, null, null, JSON.stringify({ eq2: "Nehru" }), JSON.stringify(["eq2"]), "2026-08-13T03:00:00.000Z");
  // e3: mobile with formatting "98 765 43213" → same as "9876543213" (new user)
  insertUser(emg).run("e3", "Geeta", "Operator", "Karon", "98 765 43213", null, 0, null, "2026-08-13T04:00:00.000Z", "2026-08-13T04:10:00.000Z", 0, null, null, JSON.stringify({ eq2: "Nehru", eq3: "Peacock" }), JSON.stringify(["eq2", "eq3"]), "2026-08-13T03:00:00.000Z");
  // e4: SAME mobile as e3 (within-emergency duplicate), HIGHER score (14, submitted)
  //     → e4 should win; only ONE row survives for mobile 9876543213.
  insertUser(emg).run("e4", "Geeta Kumari", "Operator", "Karon", "9876543213", null, 14, "2026-08-13T05:00:00.000Z", "2026-08-13T04:00:00.000Z", "2026-08-13T05:00:00.000Z", 14, null, null, JSON.stringify({ eq2: "Nehru", eq3: "Peacock" }), JSON.stringify(["eq2", "eq3"]), "2026-08-13T03:00:00.000Z");

  prod.close();
  emg.close();

  const report = mergeDatabases(prodPath, emgPath, outPath);

  // ---- Assertions ----
  const db = new Database(outPath, { readonly: true });
  const users = db.prepare("SELECT * FROM User ORDER BY id").all() as any[];
  const questions = db.prepare("SELECT * FROM Question ORDER BY id").all() as any[];
  const setting = db.prepare("SELECT * FROM Setting").get() as any;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error("FAIL:", msg);
      process.exitCode = 1;
    } else {
      console.log("PASS:", msg);
    }
  };

  // 3 prod users + 1 new emergency user (e3) = 4; e1/e2 deduped against p1/p2
  assert(users.length === 4, `merged users = 4 (got ${users.length})`);
  assert(questions.length === 6, `merged questions = 6 (got ${questions.length})`); // 4 prod + eq2 + eq3 (eq1 dup dropped)
  assert(setting && setting.value === "false", "exam_open setting carried over");

  const p1 = users.find((u) => u.id === "p1");
  assert(p1 && p1.score === 18, "p1 (dup mobile) keeps HIGHER score 18 from emergency");
  assert(p1 && p1.name === "Ramesh Kumar", "p1 uses emergency row name");
  assert(
    p1 && JSON.parse(p1.sessionQuestions)[0] === "q1",
    "p1 sessionQuestions remapped eq1 -> q1"
  );
  assert(
    p1 && JSON.parse(p1.answers).q1 === "Delhi",
    "p1 answers remapped eq1 -> q1"
  );

  const p2 = users.find((u) => u.id === "p2");
  assert(p2 && p2.score === 15, "p2 keeps HIGHER score 15 (prod wins over emergency's 5)");

  const e3 = users.find((u) => u.id === "e3");
  assert(
    e3 && normalizeMobile(e3.mobile) === "9876543213",
    "e3 (new user, formatted mobile) inserted"
  );
  assert(
    e3 && JSON.parse(e3.sessionQuestions).includes("eq2"),
    "e3 sessionQuestions keep new question ids"
  );
  assert(e3 && e3.score === 14, "e3 wins within-emergency duplicate with HIGHER score 14");
  assert(e3 && e3.name === "Geeta Kumari", "e3 row carries the winner (e4) name");
  const dupCount = db
    .prepare("SELECT COUNT(*) c FROM User WHERE mobile='98 765 43213' OR mobile='9876543213'")
    .get() as any;
  assert(dupCount.c === 1, "only ONE row survives for the within-DB duplicate mobile");

  const q = db.prepare("SELECT COUNT(*) c FROM Question WHERE id='eq1'").get() as any;
  assert(q.c === 0, "duplicate emergency question eq1 not imported");

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });

  console.log("\nReport:", JSON.stringify(report, null, 2));
  if (process.exitCode) {
    console.error("\nSome assertions FAILED.");
    process.exit(1);
  }
  console.log("\nAll assertions passed ✓");
}

main();
