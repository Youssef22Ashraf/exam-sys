import { useEffect } from "react";
import { ExamStorage, type ExamResult } from "../services/storage";
import { releaseCamera } from "../services/camera";
import "./ExamResults.css";

interface ExamResultsProps {
  result: ExamResult;
  onReturnHome: () => void;
}

function ExamResults({
  result,
  onReturnHome,
}: ExamResultsProps) {
  useEffect(() => {
    releaseCamera();
  }, []);

  const settings = ExamStorage.getSettings();
  const passingScore = result.passingPercentage ?? settings.passingPercentage ?? 70;
  const examDuration = settings.durationMinutes ?? 30;

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
          Exit Assessment
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
              : `You did not achieve the required ${passingScore}% passing threshold for this assessment.`}
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
            <strong>{passingScore}%</strong>
            <small>Standard requirement</small>
          </div>

          <div className="score-stat-box">
            <span>Time Taken</span>
            <strong>{formatTime(result.timeSpentSeconds)}</strong>
            <small>Allocated: {examDuration} minutes</small>
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
                    partAPercent >= passingScore
                      ? "high"
                      : partAPercent >= Math.round(passingScore * 0.7)
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
                    partBPercent >= passingScore
                      ? "high"
                      : partBPercent >= Math.round(passingScore * 0.7)
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
              <strong>✓ Verification Recorded:</strong> Your assessment submission
              has been recorded and securely transmitted to administration. Your site supervisor or proctor will review your assessment record.
            </div>
          ) : (
            <div>
              <strong>⚠️ Retest Notice:</strong> Candidates who score below {passingScore}%
              must complete an orientation review before re-attempting the
              assessment. Please consult your supervisor.
            </div>
          )}
        </div>

        {/* Candidate Action */}
        <div className="results-actions" style={{ justifyContent: "center", marginTop: "28px" }}>
          <button
            className="primary-button"
            onClick={onReturnHome}
            style={{ minWidth: "240px", padding: "14px 28px", fontSize: "15px" }}
          >
            Finish & Exit Assessment →
          </button>
        </div>
      </main>

      <footer className="app-footer">Workplace Assessment System</footer>
    </div>
  );
}

export default ExamResults;
