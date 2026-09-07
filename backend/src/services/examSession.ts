import { prisma } from "../config/db";

/**
 * Server-owned exam sittings.
 *
 * The submit body used to carry `timeSpentSeconds`, `tabSwitches` and
 * `proctoringStatus` — the proctored client reporting on its own conduct, so
 * a candidate could post `tabSwitches: 0, proctoringStatus: "Verified"` and
 * erase the evidence. A session gives the server its own clock and its own
 * warning count, sourced from the socket feed rather than the payload.
 */

/** Slack beyond the configured duration before a submit is rejected. */
export const SUBMIT_GRACE_SECONDS = 5 * 60;

export type ProctoringStatus = "Verified" | "Warnings" | "Camera Disabled";

export interface StartedSession {
  id: string;
  startedAt: Date;
}

export async function startSession(
  candidateEmail: string,
  companyId: string
): Promise<StartedSession> {
  const session = await prisma.examSession.create({
    data: {
      candidateEmail: candidateEmail.trim().toLowerCase(),
      companyId: (companyId || "").trim(),
    },
    select: { id: true, startedAt: true },
  });
  return session;
}

/** Count a proctoring warning against a sitting. Unknown ids are ignored. */
export async function recordWarning(sessionId: string): Promise<void> {
  if (!sessionId || typeof sessionId !== "string") return;
  try {
    await prisma.examSession.update({
      where: { id: sessionId },
      data: { serverWarnings: { increment: 1 } },
    });
  } catch {
    // A warning for a session that does not exist is not worth failing on;
    // the socket feed is best-effort and the submit still gets the count it
    // did record.
  }
}

export interface SessionCheckFailure {
  ok: false;
  status: number;
  error: string;
  message: string;
}

export interface SessionCheckSuccess {
  ok: true;
  sessionId: string;
  timeSpentSeconds: number;
  serverWarnings: number;
}

/**
 * Validate a sitting at submit time and return the values the server trusts.
 * Rejects an unknown session, one belonging to a different candidate, one
 * already submitted, and one past its allotted time.
 */
export async function consumeSession(
  sessionId: unknown,
  candidateEmail: string,
  durationMinutes: number
): Promise<SessionCheckFailure | SessionCheckSuccess> {
  if (!sessionId || typeof sessionId !== "string") {
    return {
      ok: false,
      status: 400,
      error: "SESSION_REQUIRED",
      message: "This submission has no exam session. Start the exam again.",
    };
  }

  const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return {
      ok: false,
      status: 400,
      error: "SESSION_UNKNOWN",
      message: "This exam session is not recognised. Start the exam again.",
    };
  }

  if (session.attemptId) {
    return {
      ok: false,
      status: 409,
      error: "SESSION_ALREADY_SUBMITTED",
      message: "This exam session has already been submitted.",
    };
  }

  if (session.candidateEmail !== candidateEmail.trim().toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: "SESSION_MISMATCH",
      message: "This exam session belongs to a different candidate.",
    };
  }

  const timeSpentSeconds = Math.max(
    0,
    Math.round((Date.now() - session.startedAt.getTime()) / 1000)
  );

  if (timeSpentSeconds > durationMinutes * 60 + SUBMIT_GRACE_SECONDS) {
    return {
      ok: false,
      status: 403,
      error: "SESSION_EXPIRED",
      message: `The allotted ${durationMinutes} minutes elapsed before this submission arrived.`,
    };
  }

  return {
    ok: true,
    sessionId: session.id,
    timeSpentSeconds,
    serverWarnings: session.serverWarnings,
  };
}

/** Mark a sitting spent so the same session cannot be submitted twice. */
export async function closeSession(sessionId: string, attemptId: string): Promise<void> {
  await prisma.examSession.update({
    where: { id: sessionId },
    data: { attemptId },
  });
}

/**
 * Proctoring verdict, derived — never taken from the submit body.
 * No recording means the camera was refused or failed, which is not
 * "Verified" no matter what the client claims.
 */
export function deriveProctoringStatus(
  tabSwitches: number,
  hasVideoRecording: boolean
): ProctoringStatus {
  if (!hasVideoRecording) return "Camera Disabled";
  return tabSwitches === 0 ? "Verified" : "Warnings";
}

// ponytail: self-check until Phase 5 adds vitest. `npx ts-node src/services/examSession.ts`
if (require.main === module) {
  const assert: typeof import("assert") = require("assert");

  assert.strictEqual(deriveProctoringStatus(0, true), "Verified");
  assert.strictEqual(deriveProctoringStatus(3, true), "Warnings");
  // The bypass this closes: no recording can never read as Verified.
  assert.strictEqual(deriveProctoringStatus(0, false), "Camera Disabled");
  assert.strictEqual(deriveProctoringStatus(9, false), "Camera Disabled");

  console.log("examSession.ts self-check passed");
}
