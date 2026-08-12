"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileUp,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
  deleteAllQuestions,
  importQuestionsFromDocx,
} from "@/lib/actions/admin";
import { formatDateIST } from "@/lib/dates";
import type { AdminQuestionRow } from "@/lib/queries";

/** Form state — 4 options, one marked correct. */
type QuestionForm = {
  text: string;
  options: string[];
  correctAnswer: string;
};

const EMPTY_FORM: QuestionForm = {
  text: "",
  options: ["", "", "", ""],
  correctAnswer: "",
};

/**
 * QuestionManager — full CRUD for the MCQ question bank.
 *
 *  - Add a new question, edit an existing one inline, or delete it.
 *  - Import the whole bank in one shot from an official .docx question
 *    file (same format as `scripts/import_mcqs.py`).
 *  - Empty the bank with "Delete All" (double confirmation).
 */
export default function QuestionManager({
  questions,
}: {
  questions: AdminQuestionRow[];
}) {
  const router = useRouter();

  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // ---- Docx import state ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [replaceBank, setReplaceBank] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  /** Fill the form from an existing question (edit mode). */
  function startEdit(q: AdminQuestionRow) {
    setEditingId(q.id);
    setForm({ text: q.text, options: [...q.options], correctAnswer: q.correctAnswer });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);

    const result = editingId
      ? await updateQuestion(editingId, form)
      : await createQuestion(form);

    if (result.ok) {
      resetForm();
      router.refresh(); // re-fetch the question list from the server
    } else {
      setFormError(
        Object.values(result.errors ?? {}).join(" ") || "Could not save question."
      );
    }
    setPending(false);
  }

  async function handleDelete(id: string) {
    await deleteQuestion(id);
    setConfirmDeleteId(null);
    router.refresh();
  }

  async function handleDeleteAll() {
    if (pending) return;
    setPending(true);
    await deleteAllQuestions();
    setConfirmDeleteAll(false);
    setPending(false);
    router.refresh();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile || importing) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("docx", importFile);
      fd.append("replace", replaceBank ? "true" : "false");
      const res = await importQuestionsFromDocx(fd);
      if (res.ok) {
        setImportResult({
          ok: true,
          message: res.skippedDuplicates
            ? `✓ Imported ${res.imported} new question(s) — ${res.skippedDuplicates} duplicate(s) already in the bank were skipped.`
            : `✓ Imported ${res.imported} question(s) from the document.`,
        });
        setImportFile(null);
        setReplaceBank(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        setImportResult({
          ok: false,
          message: res.message ?? "Import failed.",
          errors: res.errors,
        });
      }
    } catch {
      setImportResult({ ok: false, message: "Network error while importing." });
    } finally {
      setImporting(false);
    }
  }

  const isEditing = editingId !== null;

  return (
    <div className="space-y-6">
      {/* ---------- Add / Edit form ---------- */}
      <div className="gov-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy">
          {isEditing ? (
            <>
              <Pencil className="h-4 w-4 text-saffron-dark" /> Edit Question
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 text-indiaGreen" /> Add New Question
            </>
          )}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="q-text" className="form-label">
              Question Text <span className="text-red-600">*</span>
            </label>
            <textarea
              id="q-text"
              rows={2}
              required
              minLength={5}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder="Type the question here…"
              className="form-input resize-y"
            />
          </div>

          {/* Options 1-4 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {form.options.map((opt, i) => (
              <div key={i}>
                <label htmlFor={`q-opt-${i}`} className="form-label">
                  Option {i + 1} <span className="text-red-600">*</span>
                </label>
                <input
                  id={`q-opt-${i}`}
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm({ ...form, options });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="form-input"
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="q-correct" className="form-label">
              Mark the Correct Answer <span className="text-red-600">*</span>
            </label>
            <select
              id="q-correct"
              required
              value={form.correctAnswer}
              onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
              className="form-input"
            >
              <option value="">— Select the correct option —</option>
              {form.options.map((opt, i) =>
                opt.trim() ? (
                  <option key={i} value={opt}>
                    Option {i + 1}: {opt}
                  </option>
                ) : null
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The correct answer must exactly match one of the four options
              above.
            </p>
          </div>

          {formError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending
                ? "Saving…"
                : isEditing
                ? "Save Changes"
                : "Add Question"}
            </button>
            {isEditing && (
              <button type="button" onClick={resetForm} className="btn-outline">
                <X className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ---------- Bulk import from a Word (.docx) file ---------- */}
      <div className="gov-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy">
          <FileUp className="h-4 w-4 text-saffron-dark" />
          Import Questions from Word File (.docx)
        </h2>
        <p className="mb-1 text-xs text-gray-500">
          Upload the official DRDA question document directly — the app reads
          the questions, options and correct answers automatically.
        </p>
        <p className="mb-4 text-[11px] leading-relaxed text-gray-400">
          Supported format: each question numbered as{" "}
          <code className="rounded bg-parchment px-1">1. …</code> or{" "}
          <code className="rounded bg-parchment px-1">Q.1 …</code>, followed by
          four options <code className="rounded bg-parchment px-1">A) … D)</code>{" "}
          and a <code className="rounded bg-parchment px-1">सही उत्तर: …</code> line.
        </p>

        <form onSubmit={handleImport} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded border border-dashed border-gray-300 bg-parchment/60 px-3 py-2.5 text-sm text-gray-600 transition-colors hover:border-saffron hover:bg-saffron-light/30">
              <Upload className="h-4 w-4 shrink-0 text-saffron-dark" />
              <span className="min-w-0 truncate">
                {importFile
                  ? importFile.name
                  : "Choose a .docx file… (e.g. DRDA … 30 MCQs.docx)"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImportFile(file);
                  setImportResult(null);
                }}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={replaceBank}
                  onChange={(e) => setReplaceBank(e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                Clear existing questions first
              </label>
              <button
                type="submit"
                disabled={!importFile || importing}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {importing ? "Importing…" : "Import Questions"}
              </button>
            </div>
          </div>

          {replaceBank && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              Warning: the current question bank will be deleted before the new
              questions are added.
            </p>
          )}

          {importResult && (
            <div
              className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                importResult.ok
                  ? "border-indiaGreen bg-indiaGreen-light text-indiaGreen-dark"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {importResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{importResult.message}</p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li className="text-gray-500">
                          …and {importResult.errors.length - 10} more
                        </li>
                      )}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      Check that each question follows the format{" "}
                      <code className="rounded bg-red-50 px-1">1. प्रश्न…</code> or{" "}
                      <code className="rounded bg-red-50 px-1">Q.1 प्रश्न…</code>, four
                      options (A–D) and a{" "}
                      <code className="rounded bg-red-50 px-1">सही उत्तर:</code> line,
                      then upload again.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ---------- Question list ---------- */}
      <div className="gov-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <ListChecks className="h-4 w-4" /> Question Bank ({questions.length})
          </h2>

          {questions.length > 0 &&
            (confirmDeleteAll ? (
              <span className="inline-flex flex-wrap items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs">
                <span className="text-red-700">
                  Delete all {questions.length} questions?
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteAll()}
                  disabled={pending}
                  className="font-semibold text-red-700 underline hover:text-red-900 disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Yes, delete all"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="font-semibold text-gray-500 underline hover:text-gray-700"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete All Questions
              </button>
            ))}
        </div>

        {questions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            No questions yet. Use the form above to add the first question, or
            upload the official Word file to import the whole bank at once.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {questions.map((q, idx) => (
              <li key={q.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy">
                    <span className="mr-1 text-gray-400">Q{idx + 1}.</span>
                    {q.text}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {q.options.map((opt) => (
                      <span
                        key={opt}
                        className={`rounded border px-2 py-0.5 text-xs ${
                          opt === q.correctAnswer
                            ? "border-indiaGreen bg-indiaGreen-light font-medium text-indiaGreen-dark"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Added {formatDateIST(q.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(q)}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>

                  {confirmDeleteId === q.id ? (
                    <span className="inline-flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs">
                      <span className="text-red-700">Delete?</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(q.id)}
                        className="font-semibold text-red-700 underline hover:text-red-900"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="font-semibold text-gray-500 underline hover:text-gray-700"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(q.id)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                      aria-label={`Delete question ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-500">
        <CheckCircle2 className="h-4 w-4 text-indiaGreen" />
        Changes are saved to the database immediately and take effect the next
        time a participant starts the exam.
      </p>
    </div>
  );
}
