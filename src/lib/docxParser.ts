import JSZip from "jszip";

/**
 * Parse MCQs from an uploaded .docx (Microsoft Word) question-bank file.
 *
 * Mirrors `scripts/import_mcqs.py` — the format used by the official DRDA
 * documents. Both question numbering styles are accepted:
 *
 *   <old style>                  <new style>
 *   1. <question text>           Q.1 <question text>
 *   A) option 1                  A) option 1
 *   B) option 2                  B) option 2
 *   C) option 3                  C) option 3
 *   D) option 4                  D) option 4
 *   सही उत्तर: A) option 1       सही उत्तर: A) option 1
 *   स्पष्टीकरण / व्याख्या: …    व्याख्या: …
 *
 * Long questions may be split across several paragraphs — every line that
 * is not an option / answer / explanation is appended to the current
 * question's text.
 *
 * The correct answer is stored as the *exact* option string (e.g.
 * "D) 1 जुलाई 2026"), which is how the exam's real-time feedback compares
 * a candidate's selection.
 */

export type ParsedQuestion = {
  text: string;
  options: string[];
  correctAnswer: string;
};

export type DocxParseResult = {
  questions: ParsedQuestion[];
  /** Per-question problems — present ⇒ nothing was imported. */
  errors: string[];
};

/**
 * A question starts with a number, optionally prefixed by "Q":
 *   old style: "1. …", "1) …"
 *   new style: "Q.1 …", "Q1. …", "Q1) …"
 * The number (and any "Q" prefix) is stripped from the stored question text.
 *
 * Two separate patterns instead of one loose one: the old style REQUIRES a
 * separator after the number, and the new style REQUIRES the "Q" prefix —
 * so a paragraph that merely starts with a digit (e.g. a continuation line
 * like "60 दिनों तक…") can never be mistaken for a new question.
 */
const QUESTION_START_RE = new RegExp(
  [
    // "1. …" / "1) …" — number then a mandatory separator.
    "^(\\d{1,3})\\s*[.)]\\s+(.+)$",
    // "Q.1 …" / "Q1. …" — "Q" prefix (separator before the number).
    "^Q\\.?\\s*(\\d{1,3})\\s*[.)]?\\s+(.+)$",
  ].join("|")
);

/** Lines that must never be folded into the question text. */
const IGNORED_PREFIXES = [
  "व्याख्या",
  "स्पष्टीकरण",
  "Explanation",
  "Note",
  "नोट",
];

/** Decode XML entities (including numeric ones) after regex extraction. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extract the non-empty paragraph texts from a .docx `word/document.xml`.
 * Returns an empty array when the XML does not look like a Word document.
 */
export function extractParagraphs(xml: string): string[] {
  const paragraphs: string[] = [];
  // A paragraph is <w:p ...>…</w:p>. The \b guard keeps <w:pPr> etc. out.
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(xml)) !== null) {
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    const text = decodeXmlEntities(
      Array.from(match[1].matchAll(tRegex), (t) => t[1]).join("")
    ).trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

/**
 * Convert the flat paragraph list into validated question records.
 * Malformed questions are collected in `errors` (nothing is partially
 * imported — the caller decides based on the full result).
 */
export function parseDocxQuestions(paragraphs: string[]): DocxParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  let current: {
    num: number;
    text: string;
    options: string[];
    answer: string;
  } | null = null;

  const flush = () => {
    if (!current) return;
    const q = current;
    current = null;

    // A numbered paragraph that never got options is a stray heading
    // (e.g. a "Rules" section in the same file) — ignore it silently.
    if (q.options.length === 0) return;

    if (q.options.length !== 4) {
      errors.push(
        `Question ${q.num}: expected 4 options, found ${q.options.length}.`
      );
      return;
    }
    const letter = /^([A-D])/.exec(q.answer);
    if (!letter) {
      errors.push(`Question ${q.num}: no “सही उत्तर” (correct answer) line.`);
      return;
    }
    const option = q.options.find(
      (o) => o.startsWith(`${letter[1]})`) || o.startsWith(`${letter[1]}.`)
    );
    if (!option) {
      errors.push(
        `Question ${q.num}: answer “${q.answer}” does not match any option.`
      );
      return;
    }
    questions.push({
      text: q.text,
      options: q.options,
      correctAnswer: option,
    });
  };

  for (const raw of paragraphs) {
    const line = raw.trim();

    // A new question starts with "<number>. <text>" or "Q.<number> <text>".
    const start = QUESTION_START_RE.exec(line);
    if (start) {
      if (current) {
        // Only flush once the previous question actually has options — a
        // bare numbered heading is replaced by the next question instead.
        if (current.options.length > 0) flush();
      }
      // Group 1/3 holds the number, group 2/4 the text (old / new style).
      const num = Number(start[1] ?? start[3]);
      const text = (start[2] ?? start[4]).trim();
      current = { num, text, options: [], answer: "" };
      continue;
    }

    if (!current) continue;

    // Options look like "A) ..." or "A. ...".
    if (/^[A-D][).]\s*/.test(line)) {
      current.options.push(line);
    } else if (line.startsWith("सही उत्तर")) {
      const colon = line.indexOf(":");
      current.answer = (colon >= 0 ? line.slice(colon + 1) : line).trim();
    } else if (IGNORED_PREFIXES.some((p) => line.startsWith(p))) {
      // "व्याख्या: …" / "स्पष्टीकरण: …" / notes — not part of the question.
    } else {
      // The question statement continues on this line (long questions are
      // split across several paragraphs in some official files) — append it.
      current.text = `${current.text} ${line}`.trim();
    }
  }

  flush();

  return { questions, errors };
}

/** Unzip a .docx buffer and return its paragraph texts. */
export async function extractDocxParagraphs(
  buffer: ArrayBuffer
): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return [];
  const xml = await doc.async("string");
  return extractParagraphs(xml);
}
