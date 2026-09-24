import { useEffect, useState, useMemo, useRef } from "react";
import { Icon } from "../components/Icon";
import {
  ExamStorage,
  type ExamResult,
  type Question,
} from "../services/storage";
import { VideoStorage } from "../services/videoStorage";
import { CameraProctor } from "../components/CameraProctor";
import { releaseCamera } from "../services/camera";
import { api, SubmitFailedError } from "../services/api";
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

  // Server-owned sitting. Held in sessionStorage so a mid-exam reload rejoins
  // the same sitting rather than resetting the server's clock.
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`exam_sid_${userData?.email || "candidate"}`) || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    api
      .getQuestions()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setQuestions(remote);
          ExamStorage.saveQuestions(remote);
        }
      })
      .catch((err) => {
        console.warn("Could not refresh the question bank:", err);
      });
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
    } catch {
      // A corrupt draft falls back to the default below.
    }
    return 0;
  });

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedAnswers) return parsed.selectedAnswers;
      }
    } catch {
      // A corrupt draft falls back to no answers.
    }
    return {};
  });

  /**
   * Wall-clock deadline, not a countdown.
   *
   * `timeLeft` used to be decremented by a setInterval and persisted as a
   * remaining-seconds number, so any time the tab was reloading, backgrounded
   * (browsers throttle intervals to roughly once a minute) or offline was free
   * time. The server rejects a late submit either way (ADR 008); this keeps
   * the displayed clock honest.
   */
  const [deadline] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Accepted even if it has already passed: a lapsed deadline means the
        // exam is over and must auto-submit. Requiring it to be in the future
        // handed a candidate a fresh 30 minutes for letting the clock run out
        // and reloading.
        if (typeof parsed.deadline === "number") {
          return parsed.deadline;
        }
        // A session saved by the old countdown format: convert once.
        if (typeof parsed.timeLeft === "number" && parsed.timeLeft > 0) {
          return Date.now() + parsed.timeLeft * 1000;
        }
      }
    } catch (err) {
      console.warn("Could not read the saved exam deadline:", err);
    }
    return Date.now() + EXAM_DURATION * 1000;
  });

  const [timeLeft, setTimeLeft] = useState<number>(() =>
    Math.max(0, Math.round((deadline - Date.now()) / 1000))
  );

  const [tabSwitches, setTabSwitches] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.tabSwitches === "number") return parsed.tabSwitches;
      }
    } catch {
      // A corrupt draft falls back to zero warnings; the server keeps its own
      // count either way (services/examSession.ts).
    }
    return 0;
  });

  const [submitted, setSubmitted] = useState(false);
  const [submitRefusal, setSubmitRefusal] = useState<string | null>(null);
  const [submitCanRetry, setSubmitCanRetry] = useState(false);
  // What the submit is currently doing. Stopping the recorder, writing to
  // IndexedDB and uploading a 30-minute .webm can take tens of seconds on a
  // slow link, and the screen used to sit frozen with no indication at all.
  const [submitStage, setSubmitStage] = useState<string | null>(null);
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

  // Open the server-owned sitting once. Without it the submit is refused, so
  // failing here must be visible rather than silent.
  useEffect(() => {
    if (sessionId || !userData?.email) return;
    const key = `exam_sid_${userData.email}`;
    api
      .startExam(userData.email, userData.companyId || "")
      .then((id) => {
        setSessionId(id);
        try {
          sessionStorage.setItem(key, id);
        } catch (err) {
          console.warn("Could not persist the exam session id:", err);
        }
      })
      .catch((err) => {
        setSubmitCanRetry(true);
        setSubmitRefusal(
          err instanceof Error
            ? err.message
            : "Could not start the exam session on the server."
        );
      });
  }, [sessionId, userData?.email, userData?.companyId]);

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

  /**
   * The payload the server scores. ADR 001 + ADR 008: the client no longer
   * holds `correctAnswer`, so it cannot compute a score even for preview —
   * pass/fail comes back from `POST /api/exam/submit` or the attempt fails.
   */
  function buildSubmission() {
    const photo = getSnapshotRef.current ? getSnapshotRef.current() : null;

    return {
      draftId: "draft-" + Date.now(),
      candidateId: userData?.companyId || "cand-guest",
      candidateName: userData?.name || "Candidate",
      candidateEmail: userData?.email || "candidate@company.com",
      companyId: userData?.companyId || "N/A",
      answers: selectedAnswers,
      tabSwitches,
      candidatePhoto: photo || undefined,
      hasVideoRecording: false as boolean,
      videoFilename: undefined as string | undefined,
    };
  }

  async function submitExam() {
    if (submitted) {
      return;
    }

    setSubmitted(true);
    setSubmitRefusal(null);
    setSubmitStage("Finalising your recording…");
    const submission = buildSubmission();

    // Finalize and store video recording
    if (stopRecordingRef.current) {
      try {
        const videoBlob = await stopRecordingRef.current();
        releaseCamera();
        if (videoBlob && videoBlob.size > 0) {
          submission.hasVideoRecording = true;
          // Save to local IndexedDB backup
          await VideoStorage.saveVideo(submission.draftId, videoBlob);

          const mb = (videoBlob.size / (1024 * 1024)).toFixed(1);
          setSubmitStage(`Uploading your recording (${mb} MB)…`);
          // Upload to backend so remote admin can stream/watch/download it
          const uploadRes = await api.uploadVideo(videoBlob, sessionId);
          if (uploadRes && uploadRes.filename) {
            submission.videoFilename = uploadRes.filename;
          } else {
            // The attempt is still submittable, but the supervisor gets no
            // footage — say so rather than recording "no video" silently.
            console.warn("Recording upload failed:", uploadRes?.error);
          }
        }
      } catch (err) {
        console.warn("Could not save or upload video recording:", err);
        releaseCamera();
      }
    } else {
      releaseCamera();
    }

    setSubmitStage("Submitting your answers…");

    let finalResult: ExamResult;
    try {
      finalResult = await api.submitExam({
        candidateId: submission.candidateId,
        candidateName: submission.candidateName,
        candidateEmail: submission.candidateEmail,
        companyId: submission.companyId,
        answers: submission.answers,
        sessionId,
        tabSwitches: submission.tabSwitches,
        candidatePhoto: submission.candidatePhoto,
        hasVideoRecording: submission.hasVideoRecording,
        videoFilename: submission.videoFilename,
      });

      // Re-key the local recording to the attempt id the server assigned.
      if (finalResult.id && finalResult.id !== submission.draftId) {
        VideoStorage.getVideo(submission.draftId).then((blob) => {
          if (blob) VideoStorage.saveVideo(finalResult.id, blob);
        });
      }
    } catch (err) {
      const retryable = err instanceof SubmitFailedError ? err.retryable : true;
      setSubmitStage(null);
      setSubmitRefusal(err instanceof Error ? err.message : String(err));
      // A retryable failure must not strand the candidate: re-arm the button.
      // Their answers are still in sessionStorage.
      setSubmitCanRetry(retryable);
      if (retryable) {
        setSubmitted(false);
      }
      return;
    }

    setSubmitStage(null);
    // The recording is uploaded and the attempt recorded; drop the local buffer.
    VideoStorage.clearChunks(sessionId).catch((err) =>
      console.warn("Could not clear the recording buffer:", err)
    );

    try {
      sessionStorage.removeItem(`exam_sid_${userData?.email || "candidate"}`);
    } catch (err) {
      console.warn("Could not clear the exam session id:", err);
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
    // Announced once per candidate; userData does not change mid-exam.
  }, [userData]);

  function confirmSubmit() {
    setShowSubmitModal(true);
  }

  useEffect(() => {
    if (submitted) {
      return;
    }

    if (timeLeft <= 0) {
      // Without a sitting the server refuses the submit outright, so wait for
      // POST /api/exam/start to land rather than firing a doomed request. A
      // failure to open one already surfaces its own retry banner.
      if (sessionId) {
        // The timer reaching zero must submit -- that is the auto-submit
        // requirement -- and `submitted` guards re-entry.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        submitExam();
      }
      return;
    }

    // Recomputed from the deadline each tick, so a throttled or suspended tab
    // catches up instead of gaining time.
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
    // submitExam is re-created every render; listing it would tear down and
    // rebuild the interval each tick. `submitted` and `sessionId` are what
    // actually gate the call above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, submitted, deadline, sessionId]);

  // Continuously persist active session to sessionStorage
  useEffect(() => {
    if (submitted) {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Private-mode storage can refuse; the draft is stale, not harmful.
      }
      return;
    }

    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          currentQuestion,
          selectedAnswers,
          // The deadline, not a remaining count -- a reload must not hand back
          // the seconds it took.
          deadline,
          tabSwitches,
          lastSavedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.warn("Could not save exam progress:", err);
    }
  }, [
    currentQuestion,
    selectedAnswers,
    deadline,
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
      setSecurityToast("Right-click context menu is restricted during this assessment.");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "u" || e.key === "U")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "j" || e.key === "J")) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        setSecurityToast("Copying, source viewing, and developer tools are prohibited.");
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setSecurityToast("Copying question text is prohibited.");
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

  // Submitting: hold the screen with what is actually happening.
  if (submitStage) {
    return (
      <div
        className="exam-page exam-submitting"
        role="status"
        aria-live="polite"
      >
        <div className="exam-submitting-card">
          <div className="exam-spinner" aria-hidden="true" />
          <h2>Submitting your assessment</h2>
          <p>{submitStage}</p>
          <p className="exam-submitting-note">
            Do not close this window. Your answers are saved on this device
            until the server confirms them.
          </p>
        </div>
      </div>
    );
  }

  // A refusal the candidate cannot retry (a cooldown 403) ends the attempt.
  // This used to be nested inside the `!question` branch below, which is false
  // in the normal case — so a refused submit rendered nothing at all.
  if (submitRefusal && !submitCanRetry) {
    return (
      <div className="exam-page" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}>
        <h2>Submission refused</h2>
        <p>{submitRefusal}</p>
        <p>Your answers were not recorded. Contact your supervisor if you believe this is an error.</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="exam-page">
        <p>No questions available.</p>
      </div>
    );
  }

  return (
    <div className="exam-page">
      {/* Submission failed but can be retried — answers are still held locally */}
      {submitRefusal && submitCanRetry && (
        <div className="exam-submit-error" role="alert">
          <strong>Submission not sent.</strong> {submitRefusal}
          <button
            type="button"
            className="btn-retry-submit"
            onClick={() => {
              setSubmitRefusal(null);
              submitExam();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Session Resumed Banner */}
      {sessionResumed && (
        <div className="exam-session-resumed-banner">
          <span>
            <Icon name="check" /> Active exam session restored. Your answers and remaining time are preserved.
          </span>
          <button
            type="button"
            className="dismiss-banner-btn"
            onClick={() => setSessionResumed(false)}
          >
            <Icon name="x" label="Dismiss" />
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
            <span className="powered-by-icon"><Icon name="zap" /></span>
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
            sessionId={sessionId}
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
                <span className="answered-label"><Icon name="check" /> Answered</span>
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
                {questions.length - answeredCount > 0 ? <Icon name="alert-triangle" size={28} /> : <Icon name="check" size={28} />}
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
                <span className="notice-icon"><Icon name="alert-triangle" /></span>
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
                <span className="notice-icon"><Icon name="check" /></span>
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
                Submit Exam Now <Icon name="check" />
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
          <span className="powered-by-icon"><Icon name="zap" /></span>
          <span className="powered-by-prefix">Powered by</span>
          <span className="powered-by-name">Eng. Youssef Ashraf</span>
        </div>
      </footer>
    </div>
  );
}

export default Exam;