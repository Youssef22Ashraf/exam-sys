/**
 * Exam scoring. Pure — no Prisma, no `req`, no settings lookup.
 *
 * ADR 001: the server owns pass/fail. Keeping the arithmetic in a function
 * that takes plain data means it can be unit-tested without an HTTP request
 * and cannot silently drift from what `POST /api/exam/submit` records.
 */

/** The subset of a Question row scoring actually needs. */
export interface ScorableQuestion {
  id: number;
  section: string;
  correctAnswer: number;
}

/** questionId -> selected option index, as submitted by the client. */
export type AnswerMap = Record<string | number, unknown>;

export interface ScoreResult {
  partAScore: number;
  partATotal: number;
  partBScore: number;
  partBTotal: number;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
}

export function scoreExam(
  questions: ScorableQuestion[],
  answers: AnswerMap,
  passingPercentage: number
): ScoreResult {
  let partAScore = 0;
  let partATotal = 0;
  let partBScore = 0;
  let partBTotal = 0;

  for (const q of questions) {
    const given = answers[q.id];
    const isCorrect = given !== undefined && given !== null && Number(given) === q.correctAnswer;

    if (q.section === "A") {
      partATotal++;
      if (isCorrect) partAScore++;
    } else {
      partBTotal++;
      if (isCorrect) partBScore++;
    }
  }

  const totalQuestions = questions.length;
  const score = partAScore + partBScore;
  // An empty bank would divide by zero; the caller rejects that case, but a
  // pure function should not return NaN.
  const percentage =
    totalQuestions === 0 ? 0 : Number(((score / totalQuestions) * 100).toFixed(1));

  return {
    partAScore,
    partATotal,
    partBScore,
    partBTotal,
    score,
    totalQuestions,
    percentage,
    isPassed: percentage >= passingPercentage,
  };
}

// ponytail: self-check until Phase 5 adds vitest. `npx ts-node src/services/scoring.ts`
if (require.main === module) {
  const assert: typeof import("assert") = require("assert");

  const bank: ScorableQuestion[] = [
    { id: 1, section: "A", correctAnswer: 0 },
    { id: 2, section: "A", correctAnswer: 1 },
    { id: 3, section: "B", correctAnswer: 2 },
    { id: 4, section: "B", correctAnswer: 3 },
  ];

  const perfect = scoreExam(bank, { 1: 0, 2: 1, 3: 2, 4: 3 }, 70);
  assert.strictEqual(perfect.score, 4);
  assert.strictEqual(perfect.percentage, 100);
  assert.strictEqual(perfect.isPassed, true);

  const half = scoreExam(bank, { 1: 0, 3: 2 }, 70);
  assert.strictEqual(half.partAScore, 1);
  assert.strictEqual(half.partBScore, 1);
  assert.strictEqual(half.percentage, 50);
  assert.strictEqual(half.isPassed, false);

  // Section totals count every question, answered or not.
  assert.strictEqual(half.partATotal, 2);
  assert.strictEqual(half.partBTotal, 2);

  // String answers from JSON bodies still compare correctly.
  assert.strictEqual(scoreExam(bank, { 1: "0" }, 70).partAScore, 1);

  // A wrong answer is not a missing answer, and neither scores.
  assert.strictEqual(scoreExam(bank, { 1: 3 }, 70).score, 0);
  assert.strictEqual(scoreExam(bank, {}, 70).score, 0);

  // Exactly at the pass mark passes.
  assert.strictEqual(scoreExam(bank, { 1: 0, 2: 1, 3: 2 }, 75).isPassed, true);

  // Empty bank must not produce NaN.
  assert.strictEqual(scoreExam([], {}, 70).percentage, 0);

  console.log("scoring.ts self-check passed");
}
