import { describe, it, expect, beforeEach } from "vitest";
import { ExamStorage, type Candidate, type ExamResult } from "./storage";

/**
 * The client-side lockout mirrors the server's (services/cooldown.ts). It is
 * the registration screen's pre-check; the server is still the authority.
 */
const COOLDOWN_MS = 48 * 60 * 60 * 1000;

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: "c1",
    name: "Existing Person",
    email: "existing@example.com",
    companyId: "EX-001",
    registeredAt: new Date().toISOString(),
    status: "Completed",
    totalAttempts: 1,
    ...over,
  } as Candidate;
}

function result(submittedAgoMs: number, over: Partial<ExamResult> = {}): ExamResult {
  return {
    id: "r1",
    candidateId: "c1",
    candidateName: "Existing Person",
    candidateEmail: "existing@example.com",
    companyId: "EX-001",
    submittedAt: new Date(Date.now() - submittedAgoMs).toISOString(),
    score: 10,
    totalQuestions: 40,
    percentage: 25,
    isPassed: false,
    timeSpentSeconds: 600,
    partAScore: 5,
    partATotal: 23,
    partBScore: 5,
    partBTotal: 17,
    answers: {},
    tabSwitches: 0,
    proctoringStatus: "Verified",
    ...over,
  } as ExamResult;
}

beforeEach(() => {
  localStorage.clear();
});

describe("ExamStorage.getCandidates / getResults", () => {
  it("returns empty for a cold cache instead of inventing records", () => {
    // These used to write fictional candidates into localStorage and return
    // them, so an empty dashboard showed invented people as real.
    expect(ExamStorage.getCandidates()).toEqual([]);
    expect(ExamStorage.getResults()).toEqual([]);
    expect(localStorage.getItem("exam_system_candidates")).toBeNull();
  });

  it("survives a corrupt cache", () => {
    localStorage.setItem("exam_system_candidates", "{not json");
    expect(ExamStorage.getCandidates()).toEqual([]);
  });
});

describe("ExamStorage.checkCandidateCooldown", () => {
  it("allows a candidate with no history", () => {
    expect(ExamStorage.checkCandidateCooldown("new@example.com", "NEW-1").eligible).toBe(true);
  });

  it("rejects a malformed email", () => {
    const r = ExamStorage.checkCandidateCooldown("not-an-email", "NEW-1");
    expect(r.eligible).toBe(false);
    expect(r.error).toBe("INVALID_EMAIL");
  });

  it("locks out an attempt from one minute ago", () => {
    ExamStorage.saveResults([result(60 * 1000)]);
    const r = ExamStorage.checkCandidateCooldown("existing@example.com", "EX-001");
    expect(r.eligible).toBe(false);
    expect(r.error).toBe("COOLDOWN_ACTIVE");
    expect(r.remainingHours).toBe(48);
  });

  it("still locks out just inside the window", () => {
    ExamStorage.saveResults([result(COOLDOWN_MS - 60 * 1000)]);
    expect(ExamStorage.checkCandidateCooldown("existing@example.com", "EX-001").eligible).toBe(false);
  });

  it("is eligible once the window has passed", () => {
    ExamStorage.saveResults([result(COOLDOWN_MS + 60 * 1000)]);
    expect(ExamStorage.checkCandidateCooldown("existing@example.com", "EX-001").eligible).toBe(true);
  });

  it("matches on the email alone (ADR 004)", () => {
    ExamStorage.saveResults([result(60 * 1000)]);
    expect(
      ExamStorage.checkCandidateCooldown("existing@example.com", "A-DIFFERENT-ID").eligible
    ).toBe(false);
  });

  it("matches on the company ID alone", () => {
    ExamStorage.saveResults([result(60 * 1000)]);
    expect(ExamStorage.checkCandidateCooldown("someone.else@example.com", "EX-001").eligible).toBe(
      false
    );
  });

  it("leaves an unrelated candidate eligible", () => {
    ExamStorage.saveResults([result(60 * 1000)]);
    expect(ExamStorage.checkCandidateCooldown("unrelated@example.com", "ZZ-999").eligible).toBe(true);
  });

  it("uses the newest attempt when several exist", () => {
    ExamStorage.saveResults([
      result(COOLDOWN_MS * 3, { id: "old" }),
      result(60 * 1000, { id: "recent" }),
    ]);
    const r = ExamStorage.checkCandidateCooldown("existing@example.com", "EX-001");
    expect(r.eligible).toBe(false);
    expect(r.attemptNumber).toBe(3);
  });

  it("flags a company ID registered to a different name", () => {
    ExamStorage.saveCandidates([candidate()]);
    const r = ExamStorage.checkCandidateCooldown(
      "existing@example.com",
      "EX-001",
      "Someone Different"
    );
    expect(r.eligible).toBe(false);
    expect(r.error).toBe("IDENTITY_CONFLICT");
  });

  it("flags an email registered under a different company ID", () => {
    ExamStorage.saveCandidates([candidate()]);
    const r = ExamStorage.checkCandidateCooldown("existing@example.com", "OTHER-9", "Existing Person");
    expect(r.eligible).toBe(false);
    expect(r.error).toBe("IDENTITY_CONFLICT");
  });

  it("accepts a consistent identity", () => {
    ExamStorage.saveCandidates([candidate()]);
    expect(
      ExamStorage.checkCandidateCooldown("existing@example.com", "EX-001", "Existing Person").eligible
    ).toBe(true);
  });
});
