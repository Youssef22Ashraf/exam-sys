import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Question } from "../services/storage";

/**
 * The timer must auto-submit at zero, and must not hand back time that a
 * reload or a throttled background tab consumed — it stores a deadline, not a
 * countdown (ADR 008).
 */

const submitExam = vi.fn();
const startExam = vi.fn();

vi.mock("../services/api", () => ({
  api: {
    getQuestions: vi.fn().mockResolvedValue([]),
    startExam: (...args: unknown[]) => startExam(...args),
    submitExam: (...args: unknown[]) => submitExam(...args),
    uploadVideo: vi.fn().mockResolvedValue({ success: false }),
  },
  SubmitFailedError: class extends Error {
    retryable = true;
  },
}));

vi.mock("../services/socket", () => ({
  socketService: {
    emitCandidateStarted: vi.fn(),
    emitCandidateWarning: vi.fn(),
    emitExamSubmitted: vi.fn(),
  },
}));

vi.mock("../services/videoStorage", () => ({
  VideoStorage: {
    saveVideo: vi.fn().mockResolvedValue(undefined),
    getVideo: vi.fn().mockResolvedValue(null),
    clearChunks: vi.fn().mockResolvedValue(undefined),
    appendChunk: vi.fn().mockResolvedValue(undefined),
    listChunkKeys: vi.fn().mockResolvedValue([]),
    assembleChunks: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../components/CameraProctor", () => ({
  CameraProctor: () => null,
}));

const QUESTIONS: Question[] = [
  { id: 1, section: "A", sectionTitle: "Part A", question: "Q1", options: ["a", "b"] },
  { id: 2, section: "B", sectionTitle: "Part B", question: "Q2", options: ["a", "b"] },
];

const USER = { name: "Timer Tester", email: "timer@example.com", companyId: "TT-1" };

async function loadExam() {
  const { default: Exam } = await import("./Exam");
  return Exam;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("exam_system_questions", JSON.stringify(QUESTIONS));
  localStorage.setItem(
    "exam_system_settings",
    JSON.stringify({ durationMinutes: 30, passingPercentage: 70, examTitle: "T", allowReviewAnswers: true })
  );
  startExam.mockResolvedValue("session-under-test");
  submitExam.mockResolvedValue({
    id: "attempt-1",
    candidateName: USER.name,
    candidateEmail: USER.email,
    companyId: USER.companyId,
    score: 0,
    totalQuestions: 2,
    percentage: 0,
    isPassed: false,
  });
});

describe("Exam timer", () => {
  it("opens a server-owned sitting on mount", async () => {
    const Exam = await loadExam();
    render(<Exam userData={USER} />);
    await waitFor(() => expect(startExam).toHaveBeenCalledWith(USER.email, USER.companyId));
  });

  it("persists a deadline, not a remaining-seconds countdown", async () => {
    const Exam = await loadExam();
    render(<Exam userData={USER} />);

    await waitFor(() => {
      const raw = sessionStorage.getItem(`exam_session_${USER.email}`);
      expect(raw).not.toBeNull();
      const saved = JSON.parse(raw!);
      expect(saved).toHaveProperty("deadline");
      expect(saved).not.toHaveProperty("timeLeft");
      expect(saved.deadline).toBeGreaterThan(Date.now());
    });
  });

  it("resumes the saved deadline rather than restarting the clock", async () => {
    // Five minutes left of a thirty-minute exam.
    const deadline = Date.now() + 5 * 60 * 1000;
    sessionStorage.setItem(
      `exam_session_${USER.email}`,
      JSON.stringify({ currentQuestion: 0, selectedAnswers: {}, deadline, tabSwitches: 0 })
    );

    const Exam = await loadExam();
    render(<Exam userData={USER} />);

    // Shown as mm:ss, so five minutes reads 05:0x — not 30:00.
    await waitFor(() => expect(screen.getByText(/0[45]:\d\d/)).toBeInTheDocument());
  });

  it("auto-submits when the deadline has passed", async () => {
    // A real resume always carries the sitting id too: App only restores an
    // exam when this key exists.
    sessionStorage.setItem(`exam_sid_${USER.email}`, "session-under-test");
    sessionStorage.setItem(
      `exam_session_${USER.email}`,
      JSON.stringify({
        currentQuestion: 0,
        selectedAnswers: { 1: 0 },
        deadline: Date.now() - 1000,
        tabSwitches: 0,
      })
    );

    const Exam = await loadExam();
    render(<Exam userData={USER} />);

    await waitFor(() => expect(submitExam).toHaveBeenCalled(), { timeout: 4000 });
    const payload = submitExam.mock.calls[0][0];
    expect(payload.sessionId).toBe("session-under-test");
    // The client no longer holds correctAnswer, so it cannot send a score.
    expect(payload).not.toHaveProperty("score");
    expect(payload).not.toHaveProperty("proctoringStatus");
  });
});
