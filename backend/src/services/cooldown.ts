import { prisma } from "../config/db";

export const COOLDOWN_MS = 48 * 60 * 60 * 1000;

export interface ActiveCooldown {
  lastAttemptAt: string;
  nextAttemptAvailableAt: string;
  remainingHours: number;
  attemptNumber: number;
}

/**
 * Newest attempt matching the email OR the company ID, if it is younger
 * than 48 hours. Shared by check-cooldown (registration) and submit so
 * the two can never disagree. clear-cooldown backdates submittedAt, so
 * an admin override is honoured here without a second code path.
 */
export async function findActiveCooldown(
  email: string,
  companyId: string
): Promise<ActiveCooldown | null> {
  const or: { candidateEmail?: string; companyId?: string }[] = [];
  if (email) or.push({ candidateEmail: email });
  if (companyId) or.push({ companyId });
  if (or.length === 0) return null;

  const last = await prisma.examAttempt.findFirst({
    where: { OR: or },
    orderBy: { submittedAt: "desc" },
  });
  if (!last) return null;

  const elapsedMs = Date.now() - last.submittedAt.getTime();
  if (elapsedMs >= COOLDOWN_MS) return null;

  const remainingMs = COOLDOWN_MS - elapsedMs;
  return {
    lastAttemptAt: last.submittedAt.toISOString(),
    nextAttemptAvailableAt: new Date(last.submittedAt.getTime() + COOLDOWN_MS).toISOString(),
    remainingHours: Math.ceil(remainingMs / (60 * 60 * 1000)),
    attemptNumber: (last.attemptNumber || 1) + 1,
  };
}
