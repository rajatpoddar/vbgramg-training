"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from "@/lib/actions/admin";
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
 * Add a new question, edit an existing one inline, or delete it.
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

      {/* ---------- Question list ---------- */}
      <div className="gov-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <ListChecks className="h-4 w-4" /> Question Bank ({questions.length})
          </h2>
        </div>

        {questions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            No questions yet. Use the form above to add the first question.
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
                    Added {new Date(q.createdAt).toLocaleString("en-IN", { dateStyle: "medium" })}
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
        Changes are saved to the database immediately and take effect the next         time a participant starts the exam.
      </p>
    </div>
  );
}
