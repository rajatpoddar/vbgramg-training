/**
 * Central examination configuration.
 *
 * The exam is fixed at EXAM_QUESTION_COUNT questions and a fixed duration
 * (EXAM_DURATION_SECONDS), regardless of how many questions exist in the
 * admin question bank. When the bank holds more than 25 questions, each
 * candidate is served a randomly selected set of 25, persisted per session
 * so a resumed exam keeps the same questions and scoring is consistent.
 *
 * Imported by both server code (pages, queries, actions) and the client
 * exam interface — keep it free of server-only dependencies.
 */

/** Number of questions each candidate is asked in one exam. */
export const EXAM_QUESTION_COUNT = 25;

/** Total duration of the exam in seconds (15 minutes). */
export const EXAM_DURATION_SECONDS = 15 * 60;

/** Total duration of the exam in minutes. */
export const EXAM_DURATION_MINUTES = EXAM_DURATION_SECONDS / 60;
