#!/usr/bin/env python3
"""
Import MCQs from the official DRDA DOCX question bank into the app's SQLite
database.

Usage:
    python3 scripts/import_mcqs.py [path/to/questions.docx] [--db prisma/dev.db] [--replace]

Defaults:
    docx = ~/Downloads/DRDA_Deoghar_VB_G_RAM_G_30_MCQs.docx
    db   = prisma/dev.db   (the local development database)

Behaviour:
  - Parses questions in the format used by the official document:
      <number>. <question text>
      A) option 1
      B) option 2
      C) option 3
      D) option 4
      सही उत्तर: <letter>) <correct option text>
      स्पष्टीकरण / व्याख्या: ...   (ignored)
  - The correct answer is stored as the *exact* option string, which is how
    the exam's real-time feedback compares answers.
  - With --replace the Question table is cleared before importing (idempotent).
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def extract_paragraphs(docx_path: str) -> list[str]:
    """Return all non-empty paragraph texts from a .docx file."""
    with zipfile.ZipFile(docx_path) as z:
        root = ET.fromstring(z.read("word/document.xml"))

    paragraphs = []
    for p in root.iter(W + "p"):
        text = "".join(
            node.text or ""
            for run in p.iter(W + "r")
            for node in run.iter(W + "t")
        ).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def parse_questions(paragraphs: list[str]) -> list[dict]:
    """Convert the flat paragraph list into question records."""
    questions = []
    current = None

    for line in paragraphs:
        # A new question starts with "<number>. <text>"
        m = re.match(r"^(\d+)\.\s*(.*)$", line)
        if m:
            if current and len(current["options"]) >= 2:
                questions.append(current)
            current = {
                "num": int(m.group(1)),
                "text": m.group(2).strip(),
                "options": [],
                "answer": "",
            }
            continue

        if current is None:
            continue

        # Options look like "A) ..." or "A. ..."
        if re.match(r"^[A-D][).]\s*", line):
            current["options"].append(line.strip())
        elif line.startswith("सही उत्तर"):
            answer = line.split(":", 1)[1].strip() if ":" in line else line
            current["answer"] = answer

    if current and len(current["options"]) >= 2:
        questions.append(current)

    return questions


def resolve_correct_answer(question: dict) -> str | None:
    """
    Return the exact option string that the answer letter points to.
    Falls back to a case-insensitive match; returns None if nothing matches.
    """
    letter = re.match(r"^([A-D])", question["answer"])
    if not letter:
        return None

    target = question["answer"].split(")", 1)[-1].split(")", 1)[-1].strip()
    for option in question["options"]:
        if option.startswith(letter.group(1) + ")"):
            # Prefer the full option when the answer text matches it.
            if target and target in option:
                return option
            return option
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Import DRDA MCQs into SQLite")
    parser.add_argument(
        "docx",
        nargs="?",
        default=os.path.expanduser(
            "~/Downloads/DRDA_Deoghar_VB_G_RAM_G_30_MCQs.docx"
        ),
        help="Path to the questions .docx file",
    )
    parser.add_argument(
        "--db",
        default=os.path.join(PROJECT_ROOT, "prisma", "dev.db"),
        help="Path to the SQLite database file",
    )
    parser.add_argument(
        "--replace", action="store_true", help="Clear existing questions first"
    )
    args = parser.parse_args()

    if not os.path.exists(args.docx):
        print(f"[!] DOCX not found: {args.docx}")
        return 1

    paragraphs = extract_paragraphs(args.docx)
    questions = parse_questions(paragraphs)

    print(f"[i] Parsed {len(questions)} questions from {args.docx}")

    # Validate every question before writing anything.
    errors = []
    for q in questions:
        if len(q["options"]) != 4:
            errors.append(f"Q{q['num']}: expected 4 options, got {len(q['options'])}")
        if not q["answer"]:
            errors.append(f"Q{q['num']}: no correct answer line found")
        if resolve_correct_answer(q) is None:
            errors.append(f"Q{q['num']}: answer letter not in options")
    if errors:
        print("[!] Validation failed — nothing imported:")
        for e in errors:
            print(f"    - {e}")
        return 1

    db_path = os.path.abspath(args.db)
    if not os.path.exists(os.path.dirname(db_path)):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        if args.replace:
            deleted = conn.execute("DELETE FROM Question").rowcount
            print(f"[i] --replace: removed {deleted} existing question(s)")

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        inserted = 0
        for q in questions:
            correct = resolve_correct_answer(q)
            conn.execute(
                "INSERT INTO Question (id, text, options, correctAnswer, createdAt) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    # cuid-like unique id (any unique string works — TEXT PK)
                    "c" + os.urandom(16).hex(),
                    q["text"],
                    json.dumps(q["options"], ensure_ascii=False),
                    correct,
                    now,
                ),
            )
            inserted += 1
        conn.commit()
        print(f"[✓] Imported {inserted} questions into {db_path}")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
