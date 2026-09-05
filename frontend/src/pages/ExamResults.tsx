import { useState } from "react";
import type { ExamResult, Question } from "../services/storage";
import "./ExamResults.css";

interface ExamResultsProps {
  result: ExamResult;
  questions: Question[];
  onReturnHome: () => void;
  onOpenAdmin: () => void;
}

function ExamResults({
  result,
  questions,
  onReturnHome,
  onOpenAdmin,
}: ExamResultsProps) {
  const [showReview, setShowReview] = useState(false);

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }

  const partAPercent =
    result.partATotal > 0
      ? Math.round((result.partAScore / result.partATotal) * 100)
      : 0;

  const partBPercent =
    result.partBTotal > 0
      ? Math.round((result.partBScore / result.partBTotal) * 100)
      : 0;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="results-page">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">E</div>
          <div className="brand-text">
            <span className="brand-title">EXAM SYSTEM</span>
            <span className="brand-subtitle">Workplace Assessment Portal</span>
          </div>
        </div>

        <button className="secondary-button" onClick={onReturnHome}>
          Exit to Home
        </button>
      </header>

      <main className="results-container">
        {/* Status Hero Card */}
        <section
          className={`result-hero-card ${result.isPassed ? "passed" : "failed"}`}
        >
          <div className="status-icon-circle">
            {result.isPassed ? "✓" : "!"}
          </div>

          <h1>
            {result.isPassed
              ? "Assessment Successfully Passed!"
              : "Assessment Not Passed"}
          </h1>

          <p>
            {result.isPassed
              ? "You have met the passing threshold for site and workplace access clearance."
              : "You did not achieve the required 70% passing threshold for this assessment."}
          </p>

          <span
            className={`status-badge-lg ${
              result.isPassed ? "passed" : "failed"
            }`}
          >
            {result.isPassed ? "Passed (Eligible)" : "Failed (Retest Required)"}
          </span>
        </section>

        {/* Score Stats Grid */}
        <section className="score-stats-grid">
          <div className="score-stat-box highlight">
            <span>Overall Score</span>
            <strong>
              {result.score} / {result.totalQuestions}
            </strong>
            <small>{result.percentage.toFixed(1)}% achieved</small>
          </div>

          <div className="score-stat-box">
            <span>Passing Mark</span>
            <strong>70%</strong>
            <small>Standard requirement</small>
          </div>

          <div className="score-stat-box">
            <span>Time Taken</span>
            <strong>{formatTime(result.timeSpentSeconds)}</strong>
            <small>Allocated: 30 minutes</small>
          </div>

          <div className="score-stat-box">
            <span>Result Status</span>
            <strong
              style={{
                color: result.isPassed ? "#16a34a" : "#dc2626",
              }}
            >
              {result.isPassed ? "PASSED" : "FAILED"}
            </strong>
            <small>Official verification</small>
          </div>
        </section>

        {/* Two-Column Details */}
        <section className="results-two-col">
          {/* Candidate Info Panel */}
          <div className="info-card-panel">
            <h2>Candidate Details</h2>
            <div className="candidate-meta-list">
              <div className="meta-row">
                <label>Full Name</label>
                <span>{result.candidateName}</span>
              </div>
              <div className="meta-row">
                <label>Company ID</label>
                <span>{result.companyId}</span>
              </div>
              <div className="meta-row">
                <label>Email Address</label>
                <span>{result.candidateEmail}</span>
              </div>
              <div className="meta-row">
                <label>Date & Time</label>
                <span>{new Date(result.submittedAt).toLocaleString()}</span>
              </div>
              <div className="meta-row">
                <label>Assessment ID</label>
                <span style={{ fontSize: "12px", fontFamily: "monospace" }}>
                  {result.id}
                </span>
              </div>
              <div className="meta-row">
                <label>Proctoring Integrity</label>
                <span
                  style={{
                    color:
                      result.proctoringStatus === "Warnings"
                        ? "#dc2626"
                        : "#16a34a",
                    fontWeight: 700,
                  }}
                >
                  {result.proctoringStatus === "Warnings"
                    ? `⚠️ ${result.tabSwitches || 0} Tab Switch Warning(s)`
                    : "✓ Verified & Monitored"}
                </span>
              </div>
              {result.candidatePhoto && (
                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "12px",
                    borderTop: "1px dashed #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <img
                    src={result.candidatePhoto}
                    alt="Candidate Proctor Snapshot"
                    style={{
                      width: "88px",
                      height: "66px",
                      borderRadius: "8px",
                      border: "2px solid #cbd5e1",
                      objectFit: "cover",
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: "12px", color: "#1e293b", display: "block" }}>
                      Camera Verification Stamp
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Identity verified during assessment
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section Scores Panel */}
          <div className="info-card-panel">
            <h2>Section Performance</h2>

            <div className="section-score-item">
              <div className="section-score-header">
                <strong>Part A — Interface Management</strong>
                <span>
                  {result.partAScore} / {result.partATotal} ({partAPercent}%)
                </span>
              </div>
              <div className="section-bar-track">
                <div
                  className={`section-bar-fill ${
                    partAPercent >= 70
                      ? "high"
                      : partAPercent >= 50
                      ? "mid"
                      : "low"
                  }`}
                  style={{ width: `${partAPercent}%` }}
                />
              </div>
            </div>

            <div className="section-score-item">
              <div className="section-score-header">
                <strong>Part B — Stakeholder Management</strong>
                <span>
                  {result.partBScore} / {result.partBTotal} ({partBPercent}%)
                </span>
              </div>
              <div className="section-bar-track">
                <div
                  className={`section-bar-fill ${
                    partBPercent >= 70
                      ? "high"
                      : partBPercent >= 50
                      ? "mid"
                      : "low"
                  }`}
                  style={{ width: `${partBPercent}%` }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                background: "#f8fafc",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              ℹ️ Both sections are factored into your overall workplace
              competency rating.
            </div>
          </div>
        </section>

        {/* Notice Box */}
        <div
          className={`feedback-notice ${result.isPassed ? "passed" : "failed"}`}
        >
          {result.isPassed ? (
            <div>
              <strong>✓ Verification Recorded:</strong> Your examination results
              have been stored in the workplace database. You may print this
              summary or show it to your site supervisor upon entry.
            </div>
          ) : (
            <div>
              <strong>⚠️ Retest Notice:</strong> Candidates who score below 70%
              must complete an orientation review before re-attempting the
              assessment. Please consult your supervisor.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="results-actions">
          <button className="primary-button" onClick={handlePrint}>
            🖨️ Print / Save Result
          </button>

          <button
            className="secondary-button"
            onClick={() => setShowReview(!showReview)}
          >
            {showReview ? "Hide Answer Review ▲" : "Review All Answers ▼"}
          </button>

          <button className="secondary-button" onClick={onReturnHome}>
            Return to Home
          </button>

          <button
            className="secondary-button"
            onClick={onOpenAdmin}
            style={{ color: "#2563eb", borderColor: "#bfdbfe" }}
          >
            Admin Portal →
          </button>
        </div>

        {/* Answer Breakdown Section */}
        {showReview && (
          <section className="review-section">
            <div className="review-header-btn">
              <h3>Detailed Question & Answer Review</h3>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                {result.score} of {questions.length} correct
              </span>
            </div>

            <div className="review-items-container">
              {questions.map((q) => {
                const selectedIdx = result.answers[q.id];
                const isAnswered = selectedIdx !== undefined;
                const isCorrect = selectedIdx === q.correctAnswer;

                return (
                  <div
                    key={q.id}
                    className={`review-card ${
                      isCorrect ? "correct" : "incorrect"
                    }`}
                  >
                    <div className="review-card-top">
                      <span className="q-num">
                        Question {q.id} • {q.sectionTitle}
                      </span>
                      <span
                        className={`q-status ${
                          isCorrect ? "correct" : "incorrect"
                        }`}
                      >
                        {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                      </span>
                    </div>

                    <h4>{q.question}</h4>

                    <div className="review-answers-box">
                      <div className="review-answer-row">
                        <strong>Your Answer:</strong>
                        <span
                          style={{
                            color: isCorrect
                              ? "#16a34a"
                              : isAnswered
                              ? "#dc2626"
                              : "#94a3b8",
                            fontWeight: 600,
                          }}
                        >
                          {isAnswered
                            ? q.options[selectedIdx]
                            : "(Not answered)"}
                        </span>
                      </div>

                      {!isCorrect && (
                        <div className="review-answer-row">
                          <strong>Correct Answer:</strong>
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>
                            {q.options[q.correctAnswer]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">Workplace Assessment System</footer>
    </div>
  );
}

export default ExamResults;

