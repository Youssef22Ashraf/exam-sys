/**
 * Input validation shared by the candidate-facing routes.
 *
 * Lives here rather than in a router so `examRoutes` and `candidateRoutes`
 * can both use it without one importing from the other.
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/** Strict examinee email format check. */
export function validateExamineeEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email address is required." };
  }
  const trimmed = email.trim().toLowerCase();

  // Basic RFC format test (local@domain.tld)
  const generalEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!generalEmailRegex.test(trimmed)) {
    return {
      valid: false,
      message:
        "Please enter a valid email address (e.g. employee@gmail.com, candidate@outlook.com, or company email).",
    };
  }

  // Domain structure checks
  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, message: "Malformed email address." };
  }
  const domain = parts[1];
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false, message: "Email domain is invalid." };
  }

  return { valid: true };
}

/**
 * Parse a JSON column, falling back instead of throwing.
 *
 * `Question.options` and `ExamAttempt.answers` are JSON held in TEXT columns.
 * Every read did a bare `JSON.parse`, so a single malformed row took out the
 * whole list endpoint with a 500 rather than degrading that one record.
 */
export function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error("Malformed JSON column, using fallback. Value starts:", raw.slice(0, 80));
    return fallback;
  }
}
