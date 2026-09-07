import { useEffect, useState, useMemo, useRef } from "react";
import {
  ExamStorage,
  type ExamResult,
  type Question,
} from "../services/storage";
import { VideoStorage } from "../services/videoStorage";
import { CameraProctor } from "../components/CameraProctor";
import { releaseCamera } from "../services/camera";
import { api } from "../services/api";
import { socketService } from "../services/socket";
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
  const [questions, setQuestions] = useState<Question[]>(() =>
    ExamStorage.getQuestions()
  );

  useEffect(() => {
    api
      .getQuestions()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setQuestions(remote);
          ExamStorage.saveQuestions(remote);
        }
      })
      .catch(() => {});
  }, []);

  const partA = useMemo(
    () => questions.filter((q) => q.section === "A"),
    [questions]
  );
  const partB = useMemo(
    () => questions.filter((q) => q.section === "B"),
    [questions]
  );

  const EXAM_DURATION = (settings.durationMinutes || 30) * 60;
  const SESSION_STORAGE_KEY = `exam_session_${userData?.email || "candidate"}`;

  // Session persistence lazy initializers
  const [currentQuestion, setCurrentQuestion] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.currentQuestion === "number") return parsed.currentQuestion;
      }
    } catch {}
    return 0;
  });

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedAnswers) return parsed.selectedAnswers;
      }
    } catch {}
    return {};
  });

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.timeLeft === "number" && parsed.timeLeft > 0) return parsed.timeLeft;
      }
    } catch {}
    return EXAM_DURATION;
  });

  const [tabSwitches, setTabSwitches] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.tabSwitches === "number") return parsed.tabSwitches;
      }
    } catch {}
    return 0;
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitRefusal, setSubmitRefusal] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [sessionResumed, setSessionResumed] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return Boolean(saved);
    } catch {
      return false;
    }
  });

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
      passingPercentage: settings.passingPercentage || 70,
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
        releaseCamera();
        if (videoBlob && videoBlob.size > 0) {
          result.hasVideoRecording = true;
          // Save to local IndexedDB backup
          await VideoStorage.saveVideo(result.id, videoBlob);
          // Upload to backend so remote admin can stream/watch/download it
          const uploadRes = await api.uploadVideo(videoBlob, result.id);
          if (uploadRes && uploadRes.filename) {
            result.videoFilename = uploadRes.filename;
          }
        }
      } catch (err) {
        console.warn("Could not save or upload video recording:", err);
        releaseCamera();
      }
    } else {
      releaseCamera();
    }

    // The server re-scores and owns pass/fail, attempt number and the id
    // (ADR 001). The local calculation is only what we show if the API is
    // unreachable (api.submitExam falls back to it), never the source of truth.
    let finalResult: ExamResult = result;
    try {
      const serverResult = await api.submitExam({
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
        videoFilename: result.videoFilename,
      });
      finalResult = {
        ...result,
        ...serverResult,
        passingPercentage: result.passingPercentage,
      };

      // Also map video in IndexedDB to server attempt ID if different
      if (serverResult && serverResult.id && result.id !== serverResult.id) {
        VideoStorage.getVideo(result.id).then((blob) => {
          if (blob) VideoStorage.saveVideo(serverResult.id, blob);
        });
      }
    } catch (err) {
      // A 403 cooldown refusal is the only thing api.submitExam throws.
      setSubmitRefusal(err instanceof Error ? err.message : String(err));
      return;
    }

    // Persist to local storage
    ExamStorage.recordExamResult(finalResult);

    // Broadcast real-time exam submission to remote admin dashboards via WebSocket
    socketService.emitExamSubmitted({
      candidateName: finalResult.candidateName,
      candidateEmail: finalResult.candidateEmail,
      companyId: finalResult.companyId,
      score: finalResult.score,
      totalQuestions: finalResult.totalQuestions,
      percentage: finalResult.percentage,
      isPassed: finalResult.isPassed,
    });

    if (onFinishExam) {
      onFinishExam(finalResult);
    } else {
      alert(
        `Exam submitted!\n\nScore: ${finalResult.score}/${questions.length} (${finalResult.percentage.toFixed(1)}%)\nStatus: ${
          finalResult.isPassed ? "PASSED" : "FAILED"
        }`
      );
    }
  }

  // Announce candidate start via WebSocket on mount
  // Announce candidate start via WebSocket on mount & cleanup camera on unmount
  useEffect(() => {
    if (userData) {
      socketService.emitCandidateStarted({
        candidateName: userData.name,
        candidateEmail: userData.email,
        companyId: userData.companyId,
      });
    }

    return () => {
      releaseCamera();
    };
  }, []);

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

  // Continuously persist active session to sessionStorage
  useEffect(() => {
    if (submitted) {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {}
      return;
    }

    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          currentQuestion,
          selectedAnswers,
          timeLeft,
          tabSwitches,
          lastSavedAt: new Date().toISOString(),
        })
      );
    } catch {}
  }, [
    currentQuestion,
    selectedAnswers,
    timeLeft,
    tabSwitches,
    submitted,
    SESSION_STORAGE_KEY,
  ]);

  // Warn examinee before closing or refreshing active exam tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = "You have an ongoing exam. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [submitted]);

  // Anti-Cheat: Block right-click context menu, Copy shortcuts, and DevTools
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setSecurityToast("⚠️ Right-click context menu is restricted during this assessment.");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "u" || e.key === "U")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "j" || e.key === "J")) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        setSecurityToast("⚠️ Copying, source viewing, and developer tools are prohibited.");
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setSecurityToast("⚠️ Copying question text is prohibited.");
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("copy", handleCopy);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("copy", handleCopy);
    };
  }, []);

  // Auto-dismiss security toast
  useEffect(() => {
    if (securityToast) {
      const timer = setTimeout(() => setSecurityToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [securityToast]);

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
    if (submitRefusal) {
    return (
      <div className="exam-page" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}>
        <h2>Submission refused</h2>
        <p>{submitRefusal}</p>
        <p>Your answers were not recorded. Contact your supervisor if you believe this is an error.</p>
      </div>
    );
  }

  return (
      <div className="exam-page">
        <p>No questions available.</p>
      </div>
    );
  }

  return (
    <div className="exam-page">
      {/* Session Resumed Banner */}
      {sessionResumed && (
        <div className="exam-session-resumed-banner">
          <span>
            ✓ Active exam session restored. Your answers and remaining time are preserved.
          </span>
          <button
            type="button"
            className="dismiss-banner-btn"
            onClick={() => setSessionResumed(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Security Anti-Cheat Toast */}
      {securityToast && (
        <div className="exam-security-toast">
          <span>{securityToast}</span>
        </div>
      )}

      {/* Header */}
      <header className="exam-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="company-logo-badge" style={{ height: "48px", padding: "4px 10px" }} title="Mofarreh Group — Engineering & Construction">
            <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" style={{ height: "38px", width: "auto" }} />
          </div>
          <div>
            <h1>{settings.examTitle || "Examination"}</h1>
            <p>
              {userData
                ? `${userData.name} | ID: ${userData.companyId} | ${userData.email}`
                : "Workplace Assessment System"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <div className="powered-by-tag">
            <span className="powered-by-icon">⚡</span>
            <span className="powered-by-prefix">Powered by</span>
            <span className="powered-by-name">Eng. Youssef Ashraf</span>
          </div>

          <div className={`timer ${isLowTime ? "timer-warning" : ""}`}>
            <span>Time Remaining</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
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

      {/* Platform Attribution Bar */}
      <footer
        style={{
          marginTop: "40px",
          padding: "16px 24px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="company-logo-badge" style={{ height: "34px", padding: "2px 8px" }}>
            <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" style={{ height: "24px" }} />
          </div>
          <span>Mofarreh Group • Engineering & Construction Proctored Assessment</span>
        </div>
        <div className="powered-by-tag">
          <span className="powered-by-icon">⚡</span>
          <span className="powered-by-prefix">Powered by</span>
          <span className="powered-by-name">Eng. Youssef Ashraf</span>
        </div>
      </footer>
    </div>
  );
}

export default Exam;