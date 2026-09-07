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
 * the two can never disagree. clear-cooldown stamps cooldownClearedAt on
 * the candidate; that is honoured here without touching attempt rows.
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
    include: { candidate: { select: { cooldownClearedAt: true } } },
  });
  if (!last) return null;

  // Admin override: an attempt submitted at or before cooldownClearedAt is
  // spent. The attempt's own timestamp is never rewritten.
  const cleared = last.candidate?.cooldownClearedAt;
  if (cleared && cleared.getTime() >= last.submittedAt.getTime()) return null;

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
