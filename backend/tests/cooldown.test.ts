import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/config/db";
import { findActiveCooldown, COOLDOWN_MS } from "../src/services/cooldown";

/**
 * The 48-hour lockout decides whether a candidate may re-sit. The boundary is
 * the part worth pinning: `>= COOLDOWN_MS` is eligible, one millisecond less
 * is not.
 */
const EMAIL = "cooldown.subject@example.com";
const COMPANY_ID = "CD-001";

async function attemptSubmittedAgo(ms: number, over: Partial<{ email: string; companyId: string }> = {}) {
  const email = over.email ?? EMAIL;
  const companyId = over.companyId ?? COMPANY_ID;
  const candidate = await prisma.candidate.create({
    data: { name: "Cooldown Subject", email, companyId },
  });
  await prisma.examAttempt.create({
    data: {
      candidateId: candidate.id,
      candidateName: candidate.name,
      candidateEmail: email,
      companyId,
      submittedAt: new Date(Date.now() - ms),
      score: 10,
      totalQuestions: 40,
      percentage: 25,
      isPassed: false,
      timeSpentSeconds: 600,
      partAScore: 5,
      partATotal: 23,
      partBScore: 5,
      partBTotal: 17,
      answers: "{}",
    },
  });
  return candidate;
}

beforeEach(async () => {
  await prisma.examAttempt.deleteMany();
  await prisma.candidate.deleteMany();
});

afterAll(async () => {
  await prisma.examAttempt.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.$disconnect();
});

describe("findActiveCooldown", () => {
  it("returns nothing when the candidate has never sat the exam", async () => {
    expect(await findActiveCooldown(EMAIL, COMPANY_ID)).toBeNull();
  });

  it("locks out an attempt submitted one minute ago", async () => {
    await attemptSubmittedAgo(60 * 1000);
    const cd = await findActiveCooldown(EMAIL, COMPANY_ID);
    expect(cd).not.toBeNull();
    expect(cd!.remainingHours).toBe(48);
    expect(cd!.attemptNumber).toBe(2);
  });

  /**
   * The clock is frozen across BOTH the write and the read, otherwise these
   * are racy: real time advances between creating the row and querying it,
   * which is more than enough to cross a one-millisecond margin. Only Date is
   * faked, so Prisma's own timers keep working.
   */
  async function atBoundary(offsetFromWindowEnd: number) {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await attemptSubmittedAgo(COOLDOWN_MS + offsetFromWindowEnd);
      return await findActiveCooldown(EMAIL, COMPANY_ID);
    } finally {
      vi.useRealTimers();
    }
  }

  it("still locks out one millisecond before the window closes", async () => {
    expect(await atBoundary(-1)).not.toBeNull();
  });

  it("is eligible at exactly 48 hours", async () => {
    expect(await atBoundary(0)).toBeNull();
  });

  it("is eligible after 48 hours", async () => {
    await attemptSubmittedAgo(COOLDOWN_MS + 60 * 1000);
    expect(await findActiveCooldown(EMAIL, COMPANY_ID)).toBeNull();
  });

  it("matches on the email alone (ADR 004: email OR company ID)", async () => {
    await attemptSubmittedAgo(60 * 1000);
    expect(await findActiveCooldown(EMAIL, "A-DIFFERENT-ID")).not.toBeNull();
  });

  it("matches on the company ID alone", async () => {
    await attemptSubmittedAgo(60 * 1000);
    expect(await findActiveCooldown("someone.else@example.com", COMPANY_ID)).not.toBeNull();
  });

  it("does not match an unrelated candidate", async () => {
    await attemptSubmittedAgo(60 * 1000);
    expect(await findActiveCooldown("unrelated@example.com", "ZZ-999")).toBeNull();
  });

  it("honours an admin clearing the lockout", async () => {
    const candidate = await attemptSubmittedAgo(60 * 1000);
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { cooldownClearedAt: new Date() },
    });
    expect(await findActiveCooldown(EMAIL, COMPANY_ID)).toBeNull();
  });

  it("does not honour a clear stamped before the attempt", async () => {
    const candidate = await attemptSubmittedAgo(60 * 1000);
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { cooldownClearedAt: new Date(Date.now() - 2 * 60 * 1000) },
    });
    expect(await findActiveCooldown(EMAIL, COMPANY_ID)).not.toBeNull();
  });

  it("reports when the next attempt is allowed", async () => {
    await attemptSubmittedAgo(60 * 1000);
    const cd = await findActiveCooldown(EMAIL, COMPANY_ID);
    const next = new Date(cd!.nextAttemptAvailableAt).getTime();
    expect(next - new Date(cd!.lastAttemptAt).getTime()).toBe(COOLDOWN_MS);
  });
});
