import { describe, it, expect } from "vitest";
import { scoreExam, type ScorableQuestion } from "../src/services/scoring";

/**
 * ADR 001: the server owns pass/fail. These pin the arithmetic that decides
 * whether a candidate is granted site access.
 */
const bank: ScorableQuestion[] = [
  { id: 1, section: "A", correctAnswer: 0 },
  { id: 2, section: "A", correctAnswer: 1 },
  { id: 3, section: "B", correctAnswer: 2 },
  { id: 4, section: "B", correctAnswer: 3 },
];

describe("scoreExam", () => {
  it("scores a perfect paper", () => {
    const r = scoreExam(bank, { 1: 0, 2: 1, 3: 2, 4: 3 }, 70);
    expect(r.score).toBe(4);
    expect(r.percentage).toBe(100);
    expect(r.isPassed).toBe(true);
  });

  it("splits the score by section", () => {
    const r = scoreExam(bank, { 1: 0, 3: 2 }, 70);
    expect(r.partAScore).toBe(1);
    expect(r.partBScore).toBe(1);
    expect(r.partATotal).toBe(2);
    expect(r.partBTotal).toBe(2);
    expect(r.percentage).toBe(50);
    expect(r.isPassed).toBe(false);
  });

  it("counts unanswered and wrong alike as zero", () => {
    expect(scoreExam(bank, {}, 70).score).toBe(0);
    expect(scoreExam(bank, { 1: 3, 2: 3, 3: 0, 4: 0 }, 70).score).toBe(0);
  });

  it("accepts the string indexes a JSON body produces", () => {
    expect(scoreExam(bank, { 1: "0", 2: "1" }, 70).partAScore).toBe(2);
  });

  it("passes at exactly the threshold, not above it", () => {
    // 3/4 = 75%
    expect(scoreExam(bank, { 1: 0, 2: 1, 3: 2 }, 75).isPassed).toBe(true);
    expect(scoreExam(bank, { 1: 0, 2: 1, 3: 2 }, 76).isPassed).toBe(false);
  });

  it("never returns NaN for an empty bank", () => {
    const r = scoreExam([], {}, 70);
    expect(r.percentage).toBe(0);
    expect(Number.isNaN(r.percentage)).toBe(false);
  });

  it("ignores an answer for a question that is not in the bank", () => {
    expect(scoreExam(bank, { 999: 0 }, 70).score).toBe(0);
  });
});
