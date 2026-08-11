/**
 * Lightweight, dependency-free validation helpers.
 * All server actions and client forms funnel through these so the rules
 * stay consistent (defence in depth: client for UX, server for integrity).
 */

/** Accepts common Indian email patterns only. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Indian mobile number: 10 digits, starting 6-9. */
export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile.trim());
}

/** A non-empty field with at least 2 characters (name, designation, block). */
export function isNonEmpty(value: string, minLength = 2): boolean {
  return value.trim().length >= minLength;
}

/**
 * Validate the full participant registration payload.
 * Returns an object of per-field error messages (empty object = valid).
 */
export function validateRegistration(input: {
  name: string;
  designation: string;
  block: string;
  mobile: string;
  email: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(input.name)) {
    errors.name = "Full name is mandatory (minimum 2 characters).";
  }
  if (!isNonEmpty(input.designation)) {
    errors.designation = "Designation is mandatory.";
  }
  if (!isNonEmpty(input.block)) {
    errors.block = "Block is mandatory.";
  }
  if (!isValidMobile(input.mobile)) {
    errors.mobile = "Enter a valid 10-digit mobile number.";
  }
  if (!isValidEmail(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

/** Options are mandatory, must be 4 distinct, non-empty choices. */
export function validateQuestion(input: {
  text: string;
  options: string[];
  correctAnswer: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isNonEmpty(input.text, 5)) {
    errors.text = "Question text is mandatory (minimum 5 characters).";
  }

  if (input.options.length !== 4 || input.options.some((o) => !o.trim())) {
    errors.options = "Provide exactly 4 options and all must be non-empty.";
  } else if (new Set(input.options.map((o) => o.trim())).size !== 4) {
    errors.options = "All 4 options must be distinct.";
  }

  if (!input.correctAnswer.trim()) {
    errors.correctAnswer = "Please mark the correct answer.";
  } else if (
    !input.options.some(
      (o) => o.trim().toLowerCase() === input.correctAnswer.trim().toLowerCase()
    )
  ) {
    errors.correctAnswer = "Correct answer must match one of the 4 options.";
  }

  return errors;
}
