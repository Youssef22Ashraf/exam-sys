import { useEffect, useState, useMemo, useRef } from "react";
import {
  ExamStorage,
  type ExamResult,
  type Question,
} from "../services/storage";
import { VideoStorage } from "../services/videoStorage";
import { CameraProctor } from "../components/CameraProctor";
import { api } from "../services/api";
import "./Exam.css";

interface ExamProps {
  userData?: {
    name: string;
    email: string;
    companyId: string;
  } | null;
  onFinishExam?: (result: ExamResult) => void;
}

function Exam({ userData, onFinishExam }: ExamProps) {
  // Load settings & questions from storage
  const settings = useMemo(() => ExamStorage.getSettings(), []);
  const questions: Question[] = useMemo(() => ExamStorage.getQuestions(), []);

  const partA = useMemo(
    () => questions.filter((q) => q.section === "A"),
    [questions]
  );
  const partB = useMemo(
    () => questions.filter((q) => q.section === "B"),
    [questions]
  );

  const EXAM_DURATION = (settings.durationMinutes || 30) * 60;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [submitted, setSubmitted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const getSnapshotRef = useRef<(() => string | null) | null>(null);
  const stopRecordingRef = useRef<(() => Promise<Blob | null>) | null>(null);

  const question = questions[currentQuestion] || questions[0];
  const answeredCount = Object.keys(selectedAnswers).length;
  const progress =
    questions.length > 0 ? ((currentQuestion + 1) / questions.length) * 100 : 0;

  function selectAnswer(answerIndex: number) {
    if (!question) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [question.id]: answerIndex,
    }));
  }

  function goToQuestion(index: number) {
    setCurrentQuestion(index);
  }

  function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  }

  function previousQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  function calculateResults(): ExamResult {
    let score = 0;
    let partAScore = 0;
    let partBScore = 0;

    questions.forEach((q) => {
      const isCorrect = selectedAnswers[q.id] === q.correctAnswer;
      if (isCorrect) {
        score++;
        if (q.section === "A") partAScore++;
        if (q.section === "B") partBScore++;
      }
    });

    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const isPassed = percentage >= (settings.passingPercentage || 70);
    const timeSpentSeconds = Math.max(0, EXAM_DURATION - timeLeft);

    // Capture proctor photo snapshot if available
    const photo = getSnapshotRef.current ? getSnapshotRef.current() : null;
    const proctoringStatus: "Verified" | "Warnings" =
      tabSwitches === 0 ? "Verified" : "Warnings";

    const result: ExamResult = {
      id: "res-" + Date.now(),
      candidateId: userData?.companyId || "cand-guest",
      candidateName: userData?.name || "Candidate",
      candidateEmail: userData?.email || "candidate@company.com",
      companyId: userData?.companyId || "N/A",
      submittedAt: new Date().toISOString(),
      score,
      totalQuestions,
      percentage,
      isPassed,
      timeSpentSeconds,
      partAScore,
      partATotal: partA.length,
      partBScore,
      partBTotal: partB.length,
      answers: selectedAnswers,
      tabSwitches,
      proctoringStatus,
      candidatePhoto: photo || undefined,
      hasVideoRecording: false,
    };

    return result;
  }

  async function submitExam() {
    if (submitted) {
      return;
    }

    setSubmitted(true);
    const result = calculateResults();

    // Finalize and store video recording
    if (stopRecordingRef.current) {
      try {
        const videoBlob = await stopRecordingRef.current();
        if (videoBlob && videoBlob.size > 0) {
          await VideoStorage.saveVideo(result.id, videoBlob);
          result.hasVideoRecording = true;
          // Upload to backend if online
          api.uploadVideo(videoBlob, result.id).catch(() => {});
        }
      } catch (err) {
        console.warn("Could not save video recording:", err);
      }
    }

    // Persist to local storage
    ExamStorage.recordExamResult(result);

    // Sync submission with backend (triggers email notification to admin)
    api.submitExam({
      candidateId: result.candidateId,
      candidateName: result.candidateName,
      candidateEmail: result.candidateEmail,
      companyId: result.companyId,
      answers: result.answers,
      timeSpentSeconds: result.timeSpentSeconds,
      tabSwitches: result.tabSwitches,
      proctoringStatus: result.proctoringStatus,
      candidatePhoto: result.candidatePhoto,
      hasVideoRecording: result.hasVideoRecording,
    }).catch((err) => {
      console.warn("Backend offline, result saved locally:", err);
    });

    if (onFinishExam) {
      onFinishExam(result);
    } else {
      alert(
        `Exam submitted!\n\nScore: ${result.score}/${questions.length} (${result.percentage.toFixed(1)}%)\nStatus: ${
          result.isPassed ? "PASSED" : "FAILED"
        }`
      );
    }
  }

  function confirmSubmit() {
    setShowSubmitModal(true);
  }

  useEffect(() => {
    if (submitted) {
      return;
    }

    if (timeLeft <= 0) {
      submitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previousTime) => previousTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  const isLowTime = timeLeft <= 5 * 60;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const currentPart =
    question?.section === "A"
      ? question?.sectionTitle || "Part A — Interface Management"
      : question?.sectionTitle || "Part B — Stakeholder Management";

  if (!question) {
    return (
      <div className="exam-page">
        <p>No questions available.</p>
      </div>
    );
  }

  return (
    <div className="exam-page">
      {/* Header */}
      <header className="exam-header">
        <div>
          <h1>{settings.examTitle || "Examination"}</h1>
          <p>
            {userData
              ? `${userData.name} | ID: ${userData.companyId} | ${userData.email}`
              : "Workplace Assessment System"}
          </p>
        </div>

        <div className={`timer ${isLowTime ? "timer-warning" : ""}`}>
          <span>Time Remaining</span>
          <strong>{formatTime(timeLeft)}</strong>
        </div>
      </header>

      {/* Progress */}
      <div className="progress-section">
        <div className="progress-info">
          <span>
            Question {currentQuestion + 1} of {questions.length}
          </span>

          <span>
            {answeredCount}/{questions.length} answered
          </span>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="exam-layout">
        {/* Question Navigator & Proctoring */}
        <aside className="question-sidebar">
          {/* Live Camera Proctoring & Background Video Recording Card */}
          <CameraProctor
            candidateName={userData?.name}
            candidateId={userData?.companyId}
            onWarningChange={(count) => setTabSwitches(count)}
            onRegisterSnapshotGetter={(getter) => {
              getSnapshotRef.current = getter;
            }}
            onRegisterStopRecording={(stopper) => {
              stopRecordingRef.current = stopper;
            }}
          />

          <h3>Questions</h3>

          <div className="legend">
            <div>
              <span className="legend-box current" />
              Current
            </div>

            <div>
              <span className="legend-box answered" />
              Answered
            </div>

            <div>
              <span className="legend-box unanswered" />
              Unanswered
            </div>
          </div>

          <h4>Part A — Interface</h4>

          <div className="question-grid">
            {partA.map((item) => {
              const index = questions.findIndex((q) => q.id === item.id);
              return (
                <button
                  key={item.id}
                  className={`
                    question-number
                    ${currentQuestion === index ? "current" : ""}
                    ${
                      selectedAnswers[item.id] !== undefined ? "answered" : ""
                    }
                  `}
                  onClick={() => goToQuestion(index)}
                >
                  {item.id}
                </button>
              );
            })}
          </div>

          <h4>Part B — Stakeholder</h4>

          <div className="question-grid">
            {partB.map((item) => {
              const index = questions.findIndex((q) => q.id === item.id);

              return (
                <button
                  key={item.id}
                  className={`
                    question-number
                    ${currentQuestion === index ? "current" : ""}
                    ${
                      selectedAnswers[item.id] !== undefined ? "answered" : ""
                    }
                  `}
                  onClick={() => goToQuestion(index)}
                >
                  {item.id}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Question */}
        <main className="question-area">
          <div className="section-badge">{currentPart}</div>

          <div className="question-card">
            <div className="question-top">
              <span>Question {question.id}</span>

              {selectedAnswers[question.id] !== undefined && (
                <span className="answered-label">✓ Answered</span>
              )}
            </div>

            <h2>{question.question}</h2>

            <div className="answers">
              {question.options.map((option, index) => {
                const selected = selectedAnswers[question.id] === index;

                return (
                  <label
                    key={index}
                    className={`answer-option ${selected ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={selected}
                      onChange={() => selectAnswer(index)}
                    />

                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="navigation">
            <button
              className="nav-button secondary"
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
            >
              ← Previous
            </button>

            {!isLastQuestion ? (
              <button className="nav-button primary" onClick={nextQuestion}>
                Next →
              </button>
            ) : (
              <button className="nav-button submit" onClick={confirmSubmit}>
                Submit Exam
              </button>
            )}
          </div>
        </main>
      </div>

      {/* =========================================
          THEMED SUBMISSION CONFIRMATION MODAL
      ========================================= */}
      {showSubmitModal && (
        <div
          className="exam-modal-backdrop"
          onClick={() => setShowSubmitModal(false)}
        >
          <div
            className="exam-submit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="exam-submit-modal-header">
              <div
                className={`exam-submit-modal-icon-badge ${
                  questions.length - answeredCount > 0 ? "warning" : "success"
                }`}
              >
                {questions.length - answeredCount > 0 ? "⚠️" : "✓"}
              </div>
              <div>
                <h3>
                  {questions.length - answeredCount > 0
                    ? "Incomplete Assessment"
                    : "Ready to Submit Exam"}
                </h3>
                <p className="exam-submit-modal-subtitle">
                  {questions.length - answeredCount > 0
                    ? "You still have unanswered questions in your assessment."
                    : "You have answered all questions. Ready to finalize?"}
                </p>
              </div>
            </div>

            <div className="exam-submit-modal-stats">
              <div className="submit-stat-card answered">
                <span className="stat-label">Answered</span>
                <span className="stat-value">{answeredCount}</span>
                <span className="stat-sub">of {questions.length} questions</span>
              </div>
              <div
                className={`submit-stat-card ${
                  questions.length - answeredCount > 0
                    ? "unanswered warning"
                    : "completed"
                }`}
              >
                <span className="stat-label">Unanswered</span>
                <span className="stat-value">
                  {questions.length - answeredCount}
                </span>
                <span className="stat-sub">
                  {questions.length - answeredCount > 0
                    ? "Will be marked 0 pts"
                    : "All questions complete"}
                </span>
              </div>
            </div>

            {questions.length - answeredCount > 0 ? (
              <div className="submit-notice-box warning">
                <span className="notice-icon">⚠️</span>
                <span>
                  You have <strong>{questions.length - answeredCount}</strong>{" "}
                  unanswered question
                  {questions.length - answeredCount === 1 ? "" : "s"}. Any
                  unanswered questions will be scored as 0. Once submitted, your
                  answers cannot be changed.
                </span>
              </div>
            ) : (
              <div className="submit-notice-box success">
                <span className="notice-icon">✓</span>
                <span>
                  All <strong>{questions.length}</strong> questions answered!
                  Your exam will be graded immediately and your official results
                  sheet will be generated.
                </span>
              </div>
            )}

            <div className="exam-submit-modal-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowSubmitModal(false)}
              >
                ← Keep Answering
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={() => {
                  setShowSubmitModal(false);
                  submitExam();
                }}
              >
                Submit Exam Now ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Exam;