import { useEffect, useState, useMemo } from "react";
import { useTheme } from "../hooks/useTheme";
import {
  ExamStorage,
  onStorageSync,
  type Candidate,
  type ExamResult,
  type Question,
  type ExamSettings,
} from "../services/storage";
import { VideoStorage } from "../services/videoStorage";
import { socketService } from "../services/socket";
import { api } from "../services/api";
import "./AdminDashboard.css";

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabType = "overview" | "candidates" | "results" | "exams";

function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [theme, toggleTheme] = useTheme();

  // Storage states
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    ExamStorage.getCandidates()
  );
  const [results, setResults] = useState<ExamResult[]>(() =>
    ExamStorage.getResults()
  );
  const [questions, setQuestions] = useState<Question[]>(() =>
    ExamStorage.getQuestions()
  );
  const [settings, setSettings] = useState<ExamSettings>(() =>
    ExamStorage.getSettings()
  );

  // Filters & searches
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("All");

  const [resultSearch, setResultSearch] = useState("");
  const [resultStatusFilter, setResultStatusFilter] = useState("All");

  const [questionSectionFilter, setQuestionSectionFilter] = useState("All");
  const [questionSearch, setQuestionSearch] = useState("");

  // Modals state
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );
  const [loadedVideoUrl, setLoadedVideoUrl] = useState<string | null>(null);

  // Load video recording from IndexedDB when an attempt is opened
  // Load video recording from backend streaming endpoint or IndexedDB fallback
  useEffect(() => {
    let currentObjectUrl: string | null = null;
    if (selectedResult) {
      VideoStorage.getVideo(selectedResult.id).then((blob) => {
        if (blob && blob.size > 0) {
          currentObjectUrl = URL.createObjectURL(blob);
          setLoadedVideoUrl(currentObjectUrl);
        } else {
          setLoadedVideoUrl(null);
        }
      });
      if (selectedResult.videoFilename) {
        const videoBase =
          import.meta.env.VITE_API_URL ||
          (typeof window !== "undefined" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"
            ? `${window.location.origin}/api`
            : "http://localhost:5000/api");
        const adminToken = sessionStorage.getItem("adminToken") || "";
        setLoadedVideoUrl(
          `${videoBase}/proctor/video/${selectedResult.videoFilename}?token=${encodeURIComponent(adminToken)}`
        );
      } else {
        VideoStorage.getVideo(selectedResult.id).then((blob) => {
          if (blob && blob.size > 0) {
            currentObjectUrl = URL.createObjectURL(blob);
            setLoadedVideoUrl(currentObjectUrl);
          } else {
            setLoadedVideoUrl(null);
          }
        });
      }
    } else {
      setLoadedVideoUrl(null);
    }

    return () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [selectedResult]);

  const [questionModalMode, setQuestionModalMode] = useState<"add" | "edit">(
    "add"
  );
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  // Question form state
  const [qSection, setQSection] = useState<"A" | "B">("A");
  const [qText, setQText] = useState("");
  const [qOptions, setQOptions] = useState<string[]>([
    "A. Option 1",
    "B. Option 2",
    "C. Option 3",
    "D. Option 4",
  ]);
  const [qCorrect, setQCorrect] = useState<number>(0);

  // Settings form state
  const [tempSettings, setTempSettings] = useState<ExamSettings>(settings);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const [liveSocketToast, setLiveSocketToast] = useState<{
    message: string;
    type: "info" | "warning" | "success";
  } | null>(null);

  function reloadData() {
    setCandidates(ExamStorage.getCandidates());
    setResults(ExamStorage.getResults());
    setQuestions(ExamStorage.getQuestions());
    setSettings(ExamStorage.getSettings());
  }

  // Load latest state from backend on mount
  useEffect(() => {
    api.getCandidates().then((c) => { if (c) setCandidates(c); }).catch(() => {});
    api.getResults().then((r) => { if (r) setResults(r); }).catch(() => {});
    api.getQuestions().then((q) => { if (q) setQuestions(q); }).catch(() => {});
    api.getSettings().then((s) => { if (s) setSettings(s); }).catch(() => {});
  }, []);

  // Real-time live synchronization across tabs, windows, and remote computers via WebSocket
  useEffect(() => {
    // 1. Local BroadcastChannel & Storage events
    const unsubscribe = onStorageSync(() => {
      reloadData();
    });

    // 2. Remote WebSocket live proctoring events
    const unSubSubmit = socketService.onAdminExamSubmitted((data) => {
      reloadData();
      setLiveSocketToast({
        message: `🎉 Candidate ${data.candidateName} (${data.companyId}) submitted exam: ${data.score}/${data.totalQuestions} (${data.percentage.toFixed(1)}%) - ${data.isPassed ? "PASSED" : "FAILED"}`,
        type: "success",
      });
    });

    const unSubWarn = socketService.onAdminCandidateWarning((data) => {
      reloadData();
      setLiveSocketToast({
        message: `⚠️ Proctor Alert: ${data.candidateName} (${data.companyId}) - ${data.warningType} (Total Warnings: ${data.totalWarnings})`,
        type: "warning",
      });
    });

    const unSubStart = socketService.onAdminCandidateStarted((data) => {
      reloadData();
      setLiveSocketToast({
        message: `📝 Candidate ${data.candidateName} (${data.companyId}) just started the assessment.`,
        type: "info",
      });
    });

    const interval = setInterval(() => {
      reloadData();
    }, 2000);

    return () => {
      unsubscribe();
      unSubSubmit();
      unSubWarn();
      unSubStart();
      clearInterval(interval);
    };
  }, []);

  // Auto-dismiss live socket toast
  useEffect(() => {
    if (liveSocketToast) {
      const timer = setTimeout(() => setLiveSocketToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [liveSocketToast]);

  // Statistics calculation
  const totalCandidatesCount = candidates.length;
  const totalCompletedResults = results.length;
  const passedResultsCount = results.filter((r) => r.isPassed).length;

  const passRate =
    totalCompletedResults > 0
      ? Math.round((passedResultsCount / totalCompletedResults) * 100)
      : 0;

  const averageScorePercent =
    totalCompletedResults > 0
      ? (
          results.reduce((acc, r) => acc + r.percentage, 0) /
          totalCompletedResults
        ).toFixed(1)
      : "—";

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchQuery =
        c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.companyId.toLowerCase().includes(candidateSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(candidateSearch.toLowerCase());

      const matchStatus =
        candidateStatusFilter === "All" || c.status === candidateStatusFilter;

      return matchQuery && matchStatus;
    });
  }, [candidates, candidateSearch, candidateStatusFilter]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchQuery =
        r.candidateName.toLowerCase().includes(resultSearch.toLowerCase()) ||
        r.companyId.toLowerCase().includes(resultSearch.toLowerCase()) ||
        r.candidateEmail.toLowerCase().includes(resultSearch.toLowerCase());

      const matchStatus =
        resultStatusFilter === "All" ||
        (resultStatusFilter === "Passed" && r.isPassed) ||
        (resultStatusFilter === "Failed" && !r.isPassed);

      return matchQuery && matchStatus;
    });
  }, [results, resultSearch, resultStatusFilter]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSection =
        questionSectionFilter === "All" || q.section === questionSectionFilter;
      const matchQuery =
        q.question.toLowerCase().includes(questionSearch.toLowerCase()) ||
        q.options.some((opt) =>
          opt.toLowerCase().includes(questionSearch.toLowerCase())
        );
      return matchSection && matchQuery;
    });
  }, [questions, questionSectionFilter, questionSearch]);

  // Handlers for Questions
  function handleOpenAddQuestion() {
    setQuestionModalMode("add");
    setEditingQuestion(null);
    setQSection("A");
    setQText("");
    setQOptions([
      "A. Option 1",
      "B. Option 2",
      "C. Option 3",
      "D. Option 4",
    ]);
    setQCorrect(0);
    setIsQuestionModalOpen(true);
  }

  function handleOpenEditQuestion(q: Question) {
    setQuestionModalMode("edit");
    setEditingQuestion(q);
    setQSection(q.section);
    setQText(q.question);
    setQOptions([...q.options]);
    setQCorrect(q.correctAnswer);
    setIsQuestionModalOpen(true);
  }

  function handleSaveQuestion() {
    if (!qText.trim()) {
      alert("Please enter question text.");
      return;
    }

    const sectionTitle =
      qSection === "A"
        ? "Part A — Interface Management"
        : "Part B — Stakeholder Management";

    if (questionModalMode === "add") {
      const newQ = {
        section: qSection,
        sectionTitle,
        question: qText,
        options: qOptions,
        correctAnswer: qCorrect,
      };
      ExamStorage.addQuestion(newQ);
      api.createQuestion(newQ).catch(() => {});
    } else if (editingQuestion) {
      const updatedQ = {
        ...editingQuestion,
        section: qSection,
        sectionTitle,
        question: qText,
        options: qOptions,
        correctAnswer: qCorrect,
      };
      ExamStorage.updateQuestion(updatedQ);
      api.updateQuestion(updatedQ).catch(() => {});
    }

    setIsQuestionModalOpen(false);
    reloadData();
  }

  function handleDeleteQuestion(id: number) {
    if (window.confirm(`Are you sure you want to delete question #${id}?`)) {
      ExamStorage.deleteQuestion(id);
      api.deleteQuestion(id).catch(() => {});
      reloadData();
    }
  }

  function handleResetQuestions() {
    if (
      window.confirm(
        "Are you sure you want to restore the default 40 questions? Custom changes will be overwritten."
      )
    ) {
      ExamStorage.resetQuestions();
      api.resetQuestions().catch(() => {});
      reloadData();
    }
  }

  // Handlers for Candidates
  function handleDeleteCandidate(id: string) {
    if (
      window.confirm("Are you sure you want to remove this candidate record?")
    ) {
      ExamStorage.deleteCandidate(id);
      reloadData();
    }
  }

  async function handleClearCandidateCooldown(candidateId: string) {
    if (
      !window.confirm(
        "Allow this candidate to re-attempt the assessment immediately without waiting 48 hours?"
      )
    ) {
      return;
    }
    try {
      await api.clearCandidateCooldown(candidateId);
      const updatedCandidates = candidates.map((c) =>
        c.id === candidateId ? { ...c, lastAttemptAt: undefined } : c
      );
      ExamStorage.saveCandidates(updatedCandidates);
      setCandidates(updatedCandidates);
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate({ ...selectedCandidate, lastAttemptAt: undefined });
      }
      alert("Cooldown cleared! The candidate can now attempt the exam immediately.");
      reloadData();
    } catch (err) {
      console.error("Failed to clear cooldown:", err);
      alert("Error clearing cooldown.");
    }
  }

  // Handlers for Results
  function handleDeleteResult(id: string) {
    if (window.confirm("Are you sure you want to delete this exam result?")) {
      ExamStorage.deleteResult(id);
      VideoStorage.deleteVideo(id);
      reloadData();
    }
  }

  function handleSaveSettings() {
    ExamStorage.saveSettings(tempSettings);
    api.saveSettings(tempSettings).catch(() => {});
    setSettings(tempSettings);
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  }

  async function handleSendTestEmail() {
    setTestingEmail(true);
    setTestEmailMsg(null);
    try {
      const email = tempSettings.notifyEmail?.trim();
      const res = await api.sendTestEmail(email);
      if (res.success) {
        setTestEmailMsg({
          text: res.message || "✓ Test email sent successfully!",
          success: true,
        });
      } else {
        setTestEmailMsg({
          text: res.error || "Failed to dispatch test email.",
          success: false,
        });
      }
    } catch {
      setTestEmailMsg({
        text: "Failed to connect to backend server.",
        success: false,
      });
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="brand">
          <div className="brand-icon">E</div>
          <div className="brand-text">
            <span className="brand-title">EXAM SYSTEM</span>
            <span className="brand-subtitle">Administration Portal</span>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="secondary-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Live Remote Proctoring Alert Toast via WebSockets */}
      {liveSocketToast && (
        <div
          className={`admin-live-toast ${liveSocketToast.type}`}
          onClick={() => setLiveSocketToast(null)}
        >
          <span>{liveSocketToast.message}</span>
          <button className="dismiss-toast-btn" type="button">✕</button>
        </div>
      )}

      <main className="admin-container">
        {/* Title Bar */}
        <div className="admin-title">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Overview of candidates, examination results, and assessment controls.</p>
          </div>

          <span className="admin-status">● Live Sync Active</span>
        </div>

        {/* Navigation Tabs */}
        <nav className="admin-nav-tabs">
          <button
            className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Dashboard Overview
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "candidates" ? "active" : ""}`}
            onClick={() => setActiveTab("candidates")}
          >
            👥 Candidates
            <span className="tab-badge">{candidates.length}</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "results" ? "active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            📑 Exam Results
            <span className="tab-badge">{results.length}</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "exams" ? "active" : ""}`}
            onClick={() => setActiveTab("exams")}
          >
            ⚙️ Exam Management
            <span className="tab-badge">{questions.length} Qs</span>
          </button>
        </nav>

        {/* =========================================
            TAB 1: OVERVIEW
        ========================================= */}
        {activeTab === "overview" && (
          <div>
            {/* Stats Grid */}
            <section className="stats-grid">
              <div className="stat-card">
                <span>Total Candidates</span>
                <strong>{totalCandidatesCount}</strong>
                <small>Registered in system</small>
              </div>

              <div className="stat-card">
                <span>Exams Completed</span>
                <strong>{totalCompletedResults}</strong>
                <small>Assessed attempts</small>
              </div>

              <div className="stat-card">
                <span>Average Score</span>
                <strong>{averageScorePercent !== "—" ? `${averageScorePercent}%` : "—"}</strong>
                <small>Across all completed</small>
              </div>

              <div className="stat-card">
                <span>Pass Rate</span>
                <strong>{passRate}%</strong>
                <small>{passedResultsCount} passed / {totalCompletedResults} total</small>
              </div>
            </section>

            {/* Dashboard Grid */}
            <section className="dashboard-grid">
              {/* Recent Exam Attempts */}
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h2>Recent Exam Attempts</h2>
                    <p>Latest assessment submissions</p>
                  </div>
                  <button
                    className="btn-sm"
                    onClick={() => setActiveTab("results")}
                  >
                    View All →
                  </button>
                </div>

                {results.length === 0 ? (
                  <div className="empty-state">
                    <div>📋</div>
                    <strong>No exam attempts yet</strong>
                    <span>Submissions will appear here once candidates complete tests.</span>
                  </div>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Candidate</th>
                          <th>Company ID</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.slice(0, 5).map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.candidateName}</strong>
                              <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                                {r.candidateEmail}
                              </div>
                            </td>
                            <td>{r.companyId}</td>
                            <td>
                              <strong>{r.score}/{r.totalQuestions}</strong>{" "}
                              <span style={{ color: "var(--text-3)", fontSize: "12px" }}>
                                ({r.percentage.toFixed(1)}%)
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  r.isPassed ? "badge-passed" : "badge-failed"
                                }`}
                              >
                                {r.isPassed ? "Passed" : "Failed"}
                              </span>
                            </td>
                            <td style={{ fontSize: "12px", color: "var(--text-3)" }}>
                              {new Date(r.submittedAt).toLocaleDateString()}
                            </td>
                            <td>
                              <button
                                className="btn-sm"
                                onClick={() => setSelectedResult(r)}
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="dashboard-card">
                <div className="dashboard-card-header">
                  <div>
                    <h2>Quick Actions</h2>
                    <p>Administrative workflows</p>
                  </div>
                </div>

                <div className="quick-actions">
                  <button
                    className="action-button"
                    onClick={() => setActiveTab("candidates")}
                  >
                    <span>👥 View All Candidates</span>
                    <span>→</span>
                  </button>

                  <button
                    className="action-button"
                    onClick={() => setActiveTab("results")}
                  >
                    <span>📑 View Exam Results</span>
                    <span>→</span>
                  </button>

                  <button
                    className="action-button"
                    onClick={() => ExamStorage.exportResultsToCSV()}
                  >
                    <span>📥 Export Results to Excel / CSV</span>
                    <span>⬇</span>
                  </button>

                  <button
                    className="action-button"
                    onClick={() => setActiveTab("exams")}
                  >
                    <span>⚙️ Exam Settings & Questions</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================
            TAB 2: CANDIDATES
        ========================================= */}
        {activeTab === "candidates" && (
          <div className="dashboard-card">
            <div className="table-controls">
              <input
                className="search-input"
                type="text"
                placeholder="Search name, ID, or email..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
              />

              <div className="filter-group">
                <label style={{ fontSize: "13px", color: "var(--text-3)", fontWeight: 600 }}>
                  Status:
                </label>
                <select
                  className="filter-select"
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Registered">Registered</option>
                </select>
              </div>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Company ID</th>
                    <th>Email Address</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Highest Score</th>
                    <th>Registered Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "35px" }}>
                        No candidates found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                        </td>
                        <td>{c.companyId}</td>
                        <td style={{ color: "var(--text-3)" }}>{c.email}</td>
                        <td>
                          <span
                            className={`badge ${
                              c.status === "Completed"
                                ? "badge-completed"
                                : c.status === "In Progress"
                                ? "badge-in-progress"
                                : "badge-registered"
                            }`}
                          >
                            {c.status}
                          </span>
                        <td>
                          {c.totalAttempts > 1 ? (
                            <span
                              className="badge"
                              style={{
                                background: "var(--warning-soft)",
                                color: "var(--warning)",
                                border: "1px solid var(--warning)",
                                fontWeight: 700,
                                fontSize: "11px",
                              }}
                            >
                              🔁 {c.totalAttempts} Attempts
                            </span>
                          ) : (
                            <span>{c.totalAttempts}</span>
                          )}
                        </td>
                          {c.highestScore !== undefined ? (
                            <strong>{c.highestScore} / {questions.length}</strong>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-3)" }}>
                          {new Date(c.registeredAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="btn-sm"
                              onClick={() => setSelectedCandidate(c)}
                            >
                              History
                            </button>
                            <button
                              className="btn-sm danger"
                              onClick={() => handleDeleteCandidate(c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 3: RESULTS
        ========================================= */}
        {activeTab === "results" && (
          <div className="dashboard-card">
            <div className="table-controls">
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search candidates or company ID..."
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                />

                <select
                  className="filter-select"
                  value={resultStatusFilter}
                  onChange={(e) => setResultStatusFilter(e.target.value)}
                >
                  <option value="All">All Results</option>
                  <option value="Passed">Passed Only</option>
                  <option value="Failed">Failed Only</option>
                </select>
              </div>

              <button
                className="primary-button"
                style={{ padding: "9px 18px", fontSize: "13px" }}
                onClick={() => ExamStorage.exportResultsToCSV()}
              >
                📥 Export to Excel / CSV
              </button>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Company ID</th>
                    <th>Date & Time</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Proctoring</th>
                    <th>Part A (Interface)</th>
                    <th>Part B (Stakeholder)</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "35px" }}>
                        No examination results found.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => {
                      const mins = Math.floor(r.timeSpentSeconds / 60);
                      const secs = r.timeSpentSeconds % 60;
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <strong>{r.candidateName}</strong>
                              {r.attemptNumber && r.attemptNumber > 1 ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: "var(--warning-soft)",
                                    color: "var(--warning)",
                                    border: "1px solid var(--warning)",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                  }}
                                  title={`Repeat Attempt #${r.attemptNumber} by candidate`}
                                >
                                  🔁 Attempt #{r.attemptNumber}
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: "var(--surface-2)",
                                    color: "var(--text-3)",
                                    fontSize: "10px",
                                    padding: "2px 6px",
                                  }}
                                >
                                  Attempt #1
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                              {r.candidateEmail}
                            </div>
                          </td>
                          <td>{r.companyId}</td>
                          <td style={{ fontSize: "12px", color: "var(--text-3)" }}>
                            {new Date(r.submittedAt).toLocaleString()}
                          </td>
                          <td>
                            <strong>
                              {r.score} / {r.totalQuestions}
                            </strong>
                          </td>
                          <td>
                            <strong
                              style={{
                                color: r.isPassed ? "var(--success)" : "var(--danger)",
                              }}
                            >
                              {r.percentage.toFixed(1)}%
                            </strong>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                r.isPassed ? "badge-passed" : "badge-failed"
                              }`}
                            >
                              {r.isPassed ? "Passed" : "Failed"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span
                                className={`badge ${
                                  r.proctoringStatus === "Warnings"
                                    ? "badge-failed"
                                    : "badge-passed"
                                }`}
                              >
                                {r.proctoringStatus === "Warnings"
                                  ? `⚠️ ${r.tabSwitches || 0} Warn`
                                  : "✓ Monitored"}
                              </span>
                              {r.hasVideoRecording || r.videoFilename ? (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--primary)",
                                    fontWeight: 650,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                >
                                  🎥 Video
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            {r.partAScore} / {r.partATotal}
                          </td>
                          <td>
                            {r.partBScore} / {r.partBTotal}
                          </td>
                          <td style={{ fontSize: "12px", color: "var(--text-3)" }}>
                            {mins}m {secs < 10 ? "0" : ""}{secs}s
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button
                                className="btn-sm"
                                onClick={() => setSelectedResult(r)}
                              >
                                Review
                              </button>
                              <button
                                className="btn-sm"
                                style={{ background: "var(--surface-2)", color: "var(--text-2)", borderColor: "var(--border-strong)" }}
                                onClick={() => {
                                  const cand = candidates.find(
                                    (c) =>
                                      c.email.toLowerCase() === r.candidateEmail.toLowerCase() ||
                                      c.companyId.toLowerCase() === r.companyId.toLowerCase()
                                  );
                                  setSelectedCandidate(
                                    cand || {
                                      id: r.candidateId,
                                      name: r.candidateName,
                                      email: r.candidateEmail,
                                      companyId: r.companyId,
                                      registeredAt: r.submittedAt,
                                      status: "Completed",
                                      totalAttempts: r.attemptNumber || 1,
                                    }
                                  );
                                }}
                                title="View all attempts made by this candidate"
                              >
                                All Attempts
                              </button>
                              {r.hasVideoRecording || r.videoFilename ? (
                                <button
                                  className="btn-sm"
                                  style={{
                                    borderColor: "var(--primary-border)",
                                    color: "var(--primary)",
                                    background: "var(--primary-soft)",
                                    fontWeight: 600,
                                  }}
                                  onClick={() => setSelectedResult(r)}
                                  title="Watch proctoring webcam recording"
                                >
                                  🎥 Video
                                </button>
                              ) : null}
                              <button
                                className="btn-sm danger"
                                onClick={() => handleDeleteResult(r.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 4: EXAM MANAGEMENT
        ========================================= */}
        {activeTab === "exams" && (
          <div className="exam-mgmt-layout">
            {/* Left: Questions Bank */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <h2>Question Bank</h2>
                  <p>Manage and edit assessment questions</p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="secondary-button"
                    style={{ padding: "8px 14px", fontSize: "12px" }}
                    onClick={handleResetQuestions}
                  >
                    ↺ Reset Defaults
                  </button>

                  <button
                    className="primary-button"
                    style={{ padding: "8px 16px", fontSize: "12px" }}
                    onClick={handleOpenAddQuestion}
                  >
                    ＋ Add Question
                  </button>
                </div>
              </div>

              <div className="table-controls">
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search questions by text..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                />

                <div className="filter-group">
                  <button
                    className={`btn-sm ${
                      questionSectionFilter === "All" ? "primary" : ""
                    }`}
                    style={{
                      background:
                        questionSectionFilter === "All" ? "var(--primary)" : "white",
                      color:
                        questionSectionFilter === "All" ? "white" : "var(--text-2)",
                    }}
                    onClick={() => setQuestionSectionFilter("All")}
                  >
                    All ({questions.length})
                  </button>

                  <button
                    className={`btn-sm ${
                      questionSectionFilter === "A" ? "primary" : ""
                    }`}
                    style={{
                      background:
                        questionSectionFilter === "A" ? "var(--primary)" : "white",
                      color:
                        questionSectionFilter === "A" ? "white" : "var(--text-2)",
                    }}
                    onClick={() => setQuestionSectionFilter("A")}
                  >
                    Part A ({questions.filter((q) => q.section === "A").length})
                  </button>

                  <button
                    className={`btn-sm ${
                      questionSectionFilter === "B" ? "primary" : ""
                    }`}
                    style={{
                      background:
                        questionSectionFilter === "B" ? "var(--primary)" : "white",
                      color:
                        questionSectionFilter === "B" ? "white" : "var(--text-2)",
                    }}
                    onClick={() => setQuestionSectionFilter("B")}
                  >
                    Part B ({questions.filter((q) => q.section === "B").length})
                  </button>
                </div>
              </div>

              <div style={{ padding: "20px 22px" }}>
                {filteredQuestions.length === 0 ? (
                  <p style={{ color: "var(--text-3)", textAlign: "center" }}>
                    No questions found matching your filter.
                  </p>
                ) : (
                  filteredQuestions.map((q) => (
                    <div key={q.id} className="q-item-card">
                      <div className="q-item-header">
                        <span className="badge badge-section">
                          Q{q.id} • {q.sectionTitle}
                        </span>

                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn-sm"
                            onClick={() => handleOpenEditQuestion(q)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-sm danger"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <h4 style={{ margin: "6px 0 12px", fontSize: "14px" }}>
                        {q.question}
                      </h4>

                      <div className="q-options-list">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`q-option-pill ${
                              i === q.correctAnswer ? "correct" : ""
                            }`}
                          >
                            {opt} {i === q.correctAnswer && " ✓ (Correct)"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Exam Settings */}
            <div className="settings-card">
              <h3>Exam Settings</h3>

              {settingsSavedMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--success-soft)",
                    color: "var(--success)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    marginBottom: "14px",
                    fontWeight: 650,
                  }}
                >
                  ✓ Settings saved successfully!
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Exam Title</label>
                <input
                  className="form-input"
                  type="text"
                  value={tempSettings.examTitle}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      examTitle: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (Minutes)</label>
                <input
                  className="form-input"
                  type="number"
                  min={5}
                  max={180}
                  value={tempSettings.durationMinutes}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      durationMinutes: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Passing Score (%)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={100}
                  value={tempSettings.passingPercentage}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      passingPercentage: parseInt(e.target.value) || 70,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sector / Category Badge</label>
                <input
                  className="form-input"
                  type="text"
                  value={tempSettings.sectorBadge}
                  onChange={(e) =>
                    setTempSettings({
                      ...tempSettings,
                      sectorBadge: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Admin Alert Email(s)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    type="text"
                    placeholder="admin@gmail.com, proctor@outlook.com"
                    value={tempSettings.notifyEmail || ""}
                    onChange={(e) =>
                      setTempSettings({
                        ...tempSettings,
                        notifyEmail: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    style={{
                      whiteSpace: "nowrap",
                      padding: "8px 14px",
                      fontSize: "12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    onClick={handleSendTestEmail}
                    disabled={testingEmail}
                  >
                    {testingEmail ? "Sending..." : "📧 Test Email"}
                  </button>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-3)",
                    marginTop: "4px",
                    display: "block",
                  }}
                >
                  Receives exam completion alerts. Supports Gmail, Outlook, or multiple addresses separated by commas.
                </span>

                {testEmailMsg && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      lineHeight: "1.4",
                      background: testEmailMsg.success ? "var(--success-soft)" : "var(--danger-soft)",
                      color: testEmailMsg.success ? "var(--success)" : "var(--danger)",
                      border: `1px solid ${
                        testEmailMsg.success ? "var(--success-border)" : "var(--danger-border)"
                      }`,
                    }}
                  >
                    {testEmailMsg.text}
                  </div>
                )}
              </div>

              <button
                className="primary-button"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={handleSaveSettings}
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>

      {/* =========================================
          MODAL: VIEW RESULT DETAILS
      ========================================= */}
      {selectedResult && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedResult(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Exam Attempt Details</h2>
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {selectedResult.candidateName} • {selectedResult.companyId}
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedResult(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Summary stat row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    background: "var(--surface-2)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    Final Score
                  </div>
                  <strong style={{ fontSize: "20px" }}>
                    {selectedResult.score} / {selectedResult.totalQuestions}
                  </strong>
                </div>

                <div
                  style={{
                    background: "var(--surface-2)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    Percentage
                  </div>
                  <strong
                    style={{
                      fontSize: "20px",
                      color: selectedResult.isPassed ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {selectedResult.percentage.toFixed(1)}%
                  </strong>
                </div>

                <div
                  style={{
                    background: "var(--surface-2)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    Status
                  </div>
                  <span
                    className={`badge ${
                      selectedResult.isPassed ? "badge-passed" : "badge-failed"
                    }`}
                    style={{ marginTop: "4px" }}
                  >
                    {selectedResult.isPassed ? "PASSED" : "FAILED"}
                  </span>
                </div>

                <div
                  style={{
                    background: "var(--surface-2)",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                    Proctoring Integrity
                  </div>
                  <strong
                    style={{
                      fontSize: "13px",
                      display: "block",
                      marginTop: "6px",
                      color:
                        selectedResult.proctoringStatus === "Warnings"
                          ? "var(--danger)"
                          : "var(--success)",
                    }}
                  >
                    {selectedResult.proctoringStatus === "Warnings"
                      ? `⚠️ ${selectedResult.tabSwitches || 0} Tab Switch(es)`
                      : "✓ Monitored (0 Warnings)"}
                  </strong>
                </div>
              </div>

              {/* Proctor Video Recording if available */}
              {loadedVideoUrl ? (
                <div
                  style={{
                    marginBottom: "22px",
                    padding: "16px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          fontSize: "14px",
                          color: "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        🎥 Recorded Proctoring Video
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        Complete camera feed captured during candidate examination
                      </span>
                    </div>

                    <a
                      href={loadedVideoUrl}
                      download={`proctor_recording_${selectedResult.candidateName.replace(
                        /\s+/g,
                        "_"
                      )}_${selectedResult.id}.webm`}
                      className="btn-sm"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "var(--primary)",
                        borderColor: "var(--primary-border)",
                      }}
                    >
                      ⬇ Download Video (.webm)
                    </a>
                  </div>

                  <div
                    style={{
                      background: "var(--text)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      maxHeight: "320px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <video
                      src={loadedVideoUrl}
                      controls
                      style={{
                        width: "100%",
                        maxHeight: "320px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                </div>
              ) : selectedResult.candidatePhoto ? (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "14px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <img
                    src={selectedResult.candidatePhoto}
                    alt="Proctor Snapshot"
                    style={{
                      width: "110px",
                      height: "82px",
                      borderRadius: "8px",
                      objectFit: "cover",
                      border: "2px solid var(--border-strong)",
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: "13px", color: "var(--text)", display: "block" }}>
                      Identity Verification Snapshot
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--text-3)", display: "block", marginTop: "2px" }}>
                      Captured during assessment submission via candidate webcam.
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 650, marginTop: "4px", display: "inline-block" }}>
                      ● Stamped: {new Date(selectedResult.submittedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Questions list */}
              <h3 style={{ fontSize: "15px", marginBottom: "12px" }}>
                Answers Submitted
              </h3>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                {questions.map((q) => {
                  const selectedIdx = selectedResult.answers[q.id];
                  const isAnswered = selectedIdx !== undefined;
                  const isCorrect = selectedIdx === q.correctAnswer;

                  return (
                    <div
                      key={q.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "14px",
                        background: "var(--surface)",
                        borderLeft: isCorrect
                          ? "4px solid var(--success)"
                          : "4px solid var(--danger)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "6px",
                          fontSize: "12px",
                          color: "var(--text-3)",
                        }}
                      >
                        <span>
                          Q{q.id} • {q.sectionTitle}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isCorrect ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "0 0 10px",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        {q.question}
                      </p>

                      <div
                        style={{
                          fontSize: "12px",
                          background: "var(--surface-2)",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div>
                          <strong>Candidate answer: </strong>
                          <span
                            style={{
                              color: isCorrect
                                ? "var(--success)"
                                : isAnswered
                                ? "var(--danger)"
                                : "var(--text-3)",
                            }}
                          >
                            {isAnswered
                              ? q.options[selectedIdx]
                              : "(Not answered)"}
                          </span>
                        </div>

                        {!isCorrect && (
                          <div>
                            <strong>Correct answer: </strong>
                            <span style={{ color: "var(--success)" }}>
                              {q.options[q.correctAnswer]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setSelectedResult(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL: CANDIDATE ATTEMPTS HISTORY
      ========================================= */}
      {selectedCandidate && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCandidate(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Candidate History</h2>
                <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {selectedCandidate.name} ({selectedCandidate.companyId})
                </span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedCandidate(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {(() => {
                const candAttempts = results
                  .filter(
                    (r) =>
                      r.companyId.toLowerCase() === selectedCandidate.companyId.toLowerCase() ||
                      r.candidateEmail.toLowerCase() === selectedCandidate.email.toLowerCase()
                  )
                  .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

                const latestAttempt = candAttempts.length > 0 ? candAttempts[candAttempts.length - 1] : null;
                const lastAttemptTime = selectedCandidate.lastAttemptAt
                  ? new Date(selectedCandidate.lastAttemptAt).getTime()
                  : latestAttempt
                  ? new Date(latestAttempt.submittedAt).getTime()
                  : 0;
                const timeSince = Date.now() - lastAttemptTime;
                const isCooldownActive = lastAttemptTime > 0 && timeSince < 48 * 60 * 60 * 1000;
                const remainingHours = Math.ceil((48 * 60 * 60 * 1000 - timeSince) / (1000 * 60 * 60));
                const unlockTime = new Date(lastAttemptTime + 48 * 60 * 60 * 1000);

                return (
                  <>
                    <div
                      style={{
                        background: "var(--surface-2)",
                        padding: "16px",
                        borderRadius: "10px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <strong>Email:</strong> {selectedCandidate.email}
                      </div>
                      <div>
                        <strong>Status:</strong> {selectedCandidate.status}
                      </div>
                      <div>
                        <strong>Registered:</strong>{" "}
                        {new Date(selectedCandidate.registeredAt).toLocaleString()}
                      </div>
                      <div>
                        <strong>Total Attempts:</strong>{" "}
                        <span
                          className="badge"
                          style={{
                            background: candAttempts.length > 1 ? "var(--warning-soft)" : "var(--surface-2)",
                            color: candAttempts.length > 1 ? "var(--warning)" : "var(--text-2)",
                            fontWeight: 700,
                            marginLeft: "6px",
                          }}
                        >
                          {candAttempts.length} {candAttempts.length === 1 ? "attempt" : "attempts"}
                        </span>
                      </div>
                    </div>

                    {/* Cooldown Status Panel */}
                    {isCooldownActive ? (
                      <div
                        style={{
                          background: "var(--warning-soft)",
                          border: "1px solid var(--warning)",
                          padding: "14px 16px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--warning)", fontSize: "13px" }}>
                            ⛔ 48-Hour Re-attempt Cooldown Active
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--warning)", marginTop: "2px" }}>
                            Candidate locked until: <strong>{unlockTime.toLocaleString()}</strong> (~{remainingHours}h remaining)
                          </div>
                        </div>
                        <button
                          className="btn-sm"
                          style={{
                            background: "var(--warning)",
                            color: "var(--surface)",
                            border: "none",
                            fontWeight: 600,
                            padding: "7px 14px",
                            cursor: "pointer",
                            borderRadius: "6px",
                          }}
                          onClick={() => handleClearCandidateCooldown(selectedCandidate.id)}
                          title="Admin override to allow candidate to retake exam immediately"
                        >
                          🔓 Clear Cooldown (Allow Retest)
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "var(--success-soft)",
                          border: "1px solid var(--success-border)",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          marginBottom: "20px",
                          fontSize: "12px",
                          color: "var(--success)",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>✓</span>
                        <span>
                          Candidate is currently <strong>eligible</strong> to take the examination (no active 48-hour cooldown lockout).
                        </span>
                      </div>
                    )}

                    <h3 style={{ fontSize: "15px", marginBottom: "12px" }}>
                      Chronological Attempt History ({candAttempts.length})
                    </h3>

                    {candAttempts.length === 0 ? (
                      <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
                        No exam attempts recorded yet for this candidate.
                      </p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Attempt #</th>
                            <th>Date & Time</th>
                            <th>Score</th>
                            <th>Percentage</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candAttempts.map((r, idx) => {
                            const attemptNum = r.attemptNumber || idx + 1;
                            return (
                              <tr key={r.id}>
                                <td>
                                  <span
                                    className="badge"
                                    style={{
                                      background: attemptNum > 1 ? "var(--warning-soft)" : "var(--surface-2)",
                                      color: attemptNum > 1 ? "var(--warning)" : "var(--text-2)",
                                      border: attemptNum > 1 ? "1px solid var(--warning)" : "1px solid var(--border-strong)",
                                      fontWeight: 700,
                                      fontSize: "11px",
                                    }}
                                  >
                                    {attemptNum > 1 ? `🔁 Attempt #${attemptNum}` : `Attempt #${attemptNum}`}
                                  </span>
                                </td>
                                <td style={{ fontSize: "12px", color: "var(--text-3)" }}>
                                  {new Date(r.submittedAt).toLocaleString()}
                                </td>
                                <td>
                                  <strong>
                                    {r.score} / {r.totalQuestions}
                                  </strong>
                                </td>
                                <td>
                                  <strong
                                    style={{
                                      color: r.isPassed ? "var(--success)" : "var(--danger)",
                                    }}
                                  >
                                    {r.percentage.toFixed(1)}%
                                  </strong>
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      r.isPassed ? "badge-passed" : "badge-failed"
                                    }`}
                                  >
                                    {r.isPassed ? "Passed" : "Failed"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="btn-sm"
                                    onClick={() => {
                                      setSelectedCandidate(null);
                                      setSelectedResult(r);
                                    }}
                                  >
                                    Review
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setSelectedCandidate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL: ADD / EDIT QUESTION
      ========================================= */}
      {isQuestionModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsQuestionModalOpen(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {questionModalMode === "add"
                  ? "Add New Question"
                  : `Edit Question #${editingQuestion?.id}`}
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setIsQuestionModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Section</label>
                <select
                  className="filter-select"
                  style={{ width: "100%" }}
                  value={qSection}
                  onChange={(e) => setQSection(e.target.value as "A" | "B")}
                >
                  <option value="A">Part A — Interface Management</option>
                  <option value="B">Part B — Stakeholder Management</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Question Text</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Enter question text here..."
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Options (Mark the correct answer)</label>
                {qOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      checked={qCorrect === idx}
                      onChange={() => setQCorrect(idx)}
                    />
                    <input
                      className="form-input"
                      style={{ flex: 1, padding: "8px 12px" }}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...qOptions];
                        updated[idx] = e.target.value;
                        setQOptions(updated);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setIsQuestionModalOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={handleSaveQuestion}>
                {questionModalMode === "add" ? "Create Question" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;