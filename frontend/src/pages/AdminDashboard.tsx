import { useEffect, useState, useMemo, useCallback } from "react";
import { Icon } from "../components/Icon";
import { PoweredBy } from "../components/PoweredBy";
import {
  ExamStorage,
  onStorageSync,
  type Candidate,
  type ExamResult,
  type Question,
  type ExamSettings,
  type LectureAttendanceRecord,
  type LectureProgressRecord,
  type AdminLectureStats,
} from "../services/storage";
import { VideoStorage } from "../services/videoStorage";
import { socketService } from "../services/socket";
import { api } from "../services/api";
import "./AdminDashboard.css";

const LECTURE_TITLES: Record<string, string> = {
  "interface-management": "Interface Management Procedure",
  "stakeholder-management": "Stakeholder Management Procedure",
  "interface-vs-stakeholder": "Interface vs Stakeholder Comparison",
  "logistics-management": "Logistics Management Procedure",
};

const LECTURE_CHECKPOINTS_META: Record<string, { id: string; label: string; description: string }[]> = {
  "interface-management": [
    { id: "ip_identification", label: "Interface Point (IP) Definition & Boundary Types", description: "Understand Physical, Functional, and Organizational boundary definitions." },
    { id: "ipr_principles", label: "Interface Points Register (IPR) Non-Negotiables", description: "Zero unregistered interfaces, named owners, and target dates." },
    { id: "raci_matrix", label: "Roles, Responsibilities & RACI Governance", description: "Mandates for Interface Manager, Leads, Subcontractors, and PM." },
    { id: "escalation_matrix", label: "Escalation Matrix & SLA Timelines", description: "3-tier escalation framework for unresolved interfaces." },
    { id: "closeout_criteria", label: "Formal Interface Closeout Sign-Off", description: "Technical sign-off with verification evidence and closeout transmittals." },
  ],
  "stakeholder-management": [
    { id: "power_interest_matrix", label: "Power–Interest Matrix Quadrants", description: "4 quadrants: Manage Closely, Keep Satisfied, Keep Informed, and Monitor." },
    { id: "engagement_planning", label: "Stakeholder Engagement Plan (SEP)", description: "Communication strategies, frequency, and verified channels." },
    { id: "gro_authority", label: "Government Coordination via GRO", description: "Direct municipal and regulatory interactions through GRO." },
    { id: "grievance_disputes", label: "Grievance Mechanism & Issue Logging", description: "Systematic logging, investigation, escalation, and resolution." },
    { id: "sentiment_audit", label: "Stakeholder Audit & Sentiment Tracking", description: "Proactive relationship health checks and register maintenance." },
  ],
  "interface-vs-stakeholder": [
    { id: "core_distinction", label: "Technical vs. Relational Distinction", description: "Interface controls physical clashes; Stakeholder controls human expectations." },
    { id: "mandate_separation", label: "Organizational & Departmental Separation", description: "Independent reporting lines protect technical integrity." },
    { id: "intersection_rules", label: "Technical Trigger vs. Relational Execution", description: "Workflow when physical interfaces touch external parties." },
    { id: "raci_overlap", label: "Independent RACI & Reporting Structures", description: "Dual-matrix governance safeguarding corporate reputation." },
    { id: "governance_synergy", label: "Dual System Project Shielding", description: "Complementary frameworks prevent construction delays." },
  ],
  "logistics-management": [
    { id: "supply_chain_inbound", label: "Inbound Supply Chain & Delivery Windows", description: "Scheduled delivery windows and verified site gate clearances." },
    { id: "laydown_preservation", label: "Laydown Management & Material Preservation", description: "Staging zones, environmental protection, and preservation protocols." },
    { id: "crane_rigging", label: "Handling Equipment & Rigging Safety", description: "Certified rigging plans and crane exclusion zones." },
    { id: "heavy_transport_permits", label: "Oversized Cargo & Heavy Route Permits", description: "Highway permits, police escorts, and bridge capacity clearances." },
    { id: "traffic_control", label: "Site Traffic Routing & Gate Logistics", description: "One-way traffic circulation and pedestrian segregation." },
  ],
};

interface AdminDashboardProps {
  onLogout: () => void;
}

type TabType = "overview" | "candidates" | "results" | "exams" | "lectures";

function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Enforce administrator authentication on dashboard mount
  useEffect(() => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      onLogout();
    }
  }, [onLogout]);

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

  // Lectures Attendance & Checklist states
  const [lectureAttendance, setLectureAttendance] = useState<LectureAttendanceRecord[]>([]);
  const [lectureUserProgress, setLectureUserProgress] = useState<LectureProgressRecord[]>([]);
  const [inspectedProgress, setInspectedProgress] = useState<LectureProgressRecord | null>(null);
  const [lectureSubTab, setLectureSubTab] = useState<"checklist" | "attendance">("checklist");
  const [lectureStats, setLectureStats] = useState<AdminLectureStats | null>(null);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [lectureSearch, setLectureSearch] = useState("");
  const [lectureDeptFilter, setLectureDeptFilter] = useState("All");
  const [lectureTopicFilter, setLectureTopicFilter] = useState("All");
  const [lectureActionFilter, setLectureActionFilter] = useState("All");

  // Modals state
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );
  const [loadedVideoUrl, setLoadedVideoUrl] = useState<string | null>(null);

  // Load video recording from backend streaming endpoint or IndexedDB fallback
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;
    if (!selectedResult) {
      // Releasing the object URL when the modal closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadedVideoUrl(null);
      return;
    }

    const videoBase =
      import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
        ? `${window.location.origin}/api`
        : "http://localhost:5000/api");
    const adminToken = sessionStorage.getItem("adminToken") || "";

    if (selectedResult.videoFilename) {
      // Backend streaming URL with auth token
      setLoadedVideoUrl(
        `${videoBase}/proctor/video/${selectedResult.videoFilename}?token=${encodeURIComponent(adminToken)}`
      );
    } else {
      // IndexedDB local fallback
      VideoStorage.getVideo(selectedResult.id)
        .then((blob) => {
          if (!isMounted) return;
          if (blob && blob.size > 0) {
            currentObjectUrl = URL.createObjectURL(blob);
            setLoadedVideoUrl(currentObjectUrl);
          } else {
            setLoadedVideoUrl(null);
          }
        })
        .catch(() => {
          if (isMounted) setLoadedVideoUrl(null);
        });
    }

    return () => {
      isMounted = false;
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
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ success: boolean; text: string } | null>(null);

  const [testEmailMsg, setTestEmailMsg] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  // Surfaces a mutation the server refused. Every admin action used to be
  // applied to localStorage first and fired at the API with `.catch(() => {})`,
  // so a 401 or 403 still looked like success and the row came back on the
  // next sync.
  const [adminError, setAdminError] = useState<string | null>(null);
  // Calling Date.now() during render is impure: the cooldown countdown only
  // refreshed when something unrelated re-rendered. Ticked alongside the
  // periodic server refresh below.
  const [now, setNow] = useState(() => Date.now());
  const [liveSocketToast, setLiveSocketToast] = useState<{
    message: string;
    type: "info" | "warning" | "success";
  } | null>(null);

  /** Read the local cache. Cheap; used by the cross-tab sync listeners. */
  function reloadData() {
    setCandidates(ExamStorage.getCandidates());
    setResults(ExamStorage.getResults());
    setQuestions(ExamStorage.getQuestions());
    setSettings(ExamStorage.getSettings());
  }

  const fetchLectureAttendance = useCallback(async () => {
    try {
      setLoadingLectures(true);
      const data = await api.getAdminLectureAttendance({
        search: lectureSearch,
        department: lectureDeptFilter,
        lectureId: lectureTopicFilter,
        action: lectureActionFilter,
      });
      setLectureAttendance(data.attendance);
      if (data.userProgress) {
        setLectureUserProgress(data.userProgress);
      }
      setLectureStats(data.stats);
    } catch (err) {
      console.warn("Could not fetch lecture attendance:", err);
    } finally {
      setLoadingLectures(false);
    }
  }, [lectureSearch, lectureDeptFilter, lectureTopicFilter, lectureActionFilter]);

  const filteredUserProgress = useMemo(() => {
    return lectureUserProgress.filter((prog) => {
      const q = lectureSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prog.candidateName.toLowerCase().includes(q) ||
        prog.candidateEmail.toLowerCase().includes(q) ||
        prog.companyId.toLowerCase().includes(q) ||
        prog.department.toLowerCase().includes(q) ||
        (LECTURE_TITLES[prog.lectureId] || prog.lectureId).toLowerCase().includes(q);

      const matchesDept =
        lectureDeptFilter === "All" ||
        prog.department.toLowerCase() === lectureDeptFilter.toLowerCase();

      const matchesTopic =
        lectureTopicFilter === "All" ||
        prog.lectureId === lectureTopicFilter;

      return matchesSearch && matchesDept && matchesTopic;
    });
  }, [lectureUserProgress, lectureSearch, lectureDeptFilter, lectureTopicFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLectureAttendance();
  }, [fetchLectureAttendance]);

  /**
   * Pull from the server.
   *
   * `reloadData` reads localStorage, so a socket event about a submission on a
   * different machine fired a toast but never updated the table — that record
   * was not in this browser's cache.
   */
  const refreshFromServer = useCallback(async () => {
    const [c, r, q, st] = await Promise.allSettled([
      api.getCandidates(),
      api.getResults(),
      api.getQuestions(),
      api.getSettings(),
    ]);
    if (c.status === "fulfilled" && c.value) setCandidates(c.value);
    if (r.status === "fulfilled" && r.value) setResults(r.value);
    if (q.status === "fulfilled" && q.value) setQuestions(q.value);
    if (st.status === "fulfilled" && st.value) setSettings(st.value);
    fetchLectureAttendance();
  }, [fetchLectureAttendance]);

  useEffect(() => {
    // refreshFromServer is async and only sets state once the requests
    // resolve, so this cannot cascade renders; fetching on mount is the point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFromServer();
  }, [refreshFromServer]);

  // Real-time live synchronization across tabs, windows, and remote computers via WebSocket
  useEffect(() => {
    // 1. Local BroadcastChannel & Storage events
    const unsubscribe = onStorageSync(() => {
      reloadData();
    });

    // 2. Remote WebSocket live proctoring events
    const unSubSubmit = socketService.onAdminExamSubmitted((data) => {
      refreshFromServer();
      setLiveSocketToast({
        message: `Candidate ${data.candidateName} (${data.companyId}) submitted exam: ${data.score}/${data.totalQuestions} (${data.percentage.toFixed(1)}%) - ${data.isPassed ? "PASSED" : "FAILED"}`,
        type: "success",
      });
    });

    const unSubWarn = socketService.onAdminCandidateWarning((data) => {
      refreshFromServer();
      setLiveSocketToast({
        message: `Proctor Alert: ${data.candidateName} (${data.companyId}) - ${data.warningType} (Total Warnings: ${data.totalWarnings})`,
        type: "warning",
      });
    });

    const unSubStart = socketService.onAdminCandidateStarted((data) => {
      refreshFromServer();
      setLiveSocketToast({
        message: `Candidate ${data.candidateName} (${data.companyId}) just started the assessment.`,
        type: "info",
      });
    });

    const unSubLecture = socketService.onAdminLectureAccess((data) => {
      fetchLectureAttendance();
      setLiveSocketToast({
        message: `Training Portal: ${data.candidateName} (${data.department}) accessed ${data.lectureTitle}`,
        type: "info",
      });
    });

    const unSubLectureChecklist = socketService.onAdminLectureChecklist((data) => {
      fetchLectureAttendance();
      setLiveSocketToast({
        message: `Checklist Update: ${data.candidateName} (${data.department}) is ${data.completionPercent}% complete on ${LECTURE_TITLES[data.lectureId] || data.lectureId}`,
        type: "info",
      });
    });

    // Was a 2-second localStorage re-read that re-rendered this whole
    // component and recomputed every filter. Sockets already push the events
    // that matter; this is just a slow safety net.
    const interval = setInterval(() => {
      setNow(Date.now());
      refreshFromServer();
    }, 30000);

    return () => {
      unsubscribe();
      unSubSubmit();
      unSubWarn();
      unSubStart();
      unSubLecture();
      unSubLectureChecklist();
      clearInterval(interval);
    };
  }, [refreshFromServer, fetchLectureAttendance]);

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
    setQCorrect(q.correctAnswer ?? 0);
    setIsQuestionModalOpen(true);
  }

  async function handleSaveQuestion() {
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
      try {
        await api.createQuestion(newQ);
        ExamStorage.addQuestion(newQ);
      } catch (err) {
        setAdminError(err instanceof Error ? err.message : "Could not add the question.");
        return;
      }
    } else if (editingQuestion) {
      const updatedQ = {
        ...editingQuestion,
        section: qSection,
        sectionTitle,
        question: qText,
        options: qOptions,
        correctAnswer: qCorrect,
      };
      try {
        await api.updateQuestion(updatedQ);
        ExamStorage.updateQuestion(updatedQ);
      } catch (err) {
        setAdminError(err instanceof Error ? err.message : "Could not update the question.");
        return;
      }
    }

    setIsQuestionModalOpen(false);
    await refreshFromServer();
  }

  async function handleDeleteQuestion(id: number) {
    if (!window.confirm(`Are you sure you want to delete question #${id}?`)) return;
    setAdminError(null);
    try {
      await api.deleteQuestion(id);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not delete the question.");
      return;
    }
    ExamStorage.deleteQuestion(id);
    await refreshFromServer();
  }

  function handleResetQuestions() {
    if (
      window.confirm(
        "Are you sure you want to restore the default 40 questions? Custom changes will be overwritten."
      )
    ) {
      setAdminError(null);
      api
        .resetQuestions()
        .then(() => {
          ExamStorage.resetQuestions();
          return refreshFromServer();
        })
        .catch((err) =>
          setAdminError(err instanceof Error ? err.message : "Could not reset the questions.")
        );
    }
  }

  // Handlers for Candidates
  async function handleDeleteCandidate(id: string) {
    if (!window.confirm("Are you sure you want to remove this candidate record?")) return;
    setAdminError(null);
    try {
      // This used to delete from localStorage only, so the candidate stayed on
      // the server and reappeared on the next sync.
      await api.deleteCandidate(id);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not delete the candidate.");
      return;
    }
    await refreshFromServer();
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
  async function handleDeleteResult(id: string) {
    if (!window.confirm("Are you sure you want to delete this exam result?")) return;
    setAdminError(null);
    try {
      // Local-only before, so the attempt survived on the server.
      await api.deleteResult(id);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not delete the result.");
      return;
    }
    VideoStorage.deleteVideo(id);
    await refreshFromServer();
  }

  function handleSaveSettings() {
    setAdminError(null);
    ExamStorage.saveSettings(tempSettings);
    api
      .saveSettings(tempSettings)
      .catch((err) =>
        setAdminError(
          err instanceof Error ? err.message : "Settings were not saved on the server."
        )
      );
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
          text: res.message || "Test email sent successfully.",
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

  async function handleChangePassword() {
    setPwMsg(null);

    if (pwNew.length < 12) {
      setPwMsg({ success: false, text: "The new password must be at least 12 characters." });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ success: false, text: "The two new passwords do not match." });
      return;
    }

    setPwBusy(true);
    const res = await api.changePassword(pwCurrent, pwNew);
    setPwBusy(false);

    if (res.success) {
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setPwMsg({ success: true, text: "Password updated." });
    } else {
      setPwMsg({ success: false, text: res.error || "Could not change the password." });
    }
  }

  return (
    <div className="admin-page">
      {/* A server-refused admin action. Previously these failed silently. */}
      {adminError && (
        <div className="admin-error-banner" role="alert">
          <span>{adminError}</span>
          <button
            type="button"
            className="admin-error-dismiss"
            onClick={() => setAdminError(null)}
            aria-label="Dismiss"
          >
            <Icon name="x" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="admin-header">
        <div className="brand">
          <div className="company-logo-badge" title="Mofarreh Group — Engineering & Construction">
            <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" className="company-logo" />
          </div>
          <div className="brand-text">
            <span className="brand-title">EXAM ADMIN</span>
            <span className="brand-subtitle">Workplace Assessment Command Center</span>
          </div>
        </div>

        <div className="admin-header-actions">
          <PoweredBy />
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
          <button className="dismiss-toast-btn" type="button" aria-label="Dismiss"><Icon name="x" /></button>
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
            <Icon name="chart" /> Dashboard Overview
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "candidates" ? "active" : ""}`}
            onClick={() => setActiveTab("candidates")}
          >
            <Icon name="users" /> Candidates
            <span className="tab-badge">{candidates.length}</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "results" ? "active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            <Icon name="file-text" /> Exam Results
            <span className="tab-badge">{results.length}</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "exams" ? "active" : ""}`}
            onClick={() => setActiveTab("exams")}
          >
            <Icon name="settings" /> Exam Management
            <span className="tab-badge">{questions.length} Qs</span>
          </button>

          <button
            className={`admin-tab-btn ${activeTab === "lectures" ? "active" : ""}`}
            onClick={() => setActiveTab("lectures")}
          >
            <Icon name="video" /> Lectures & Attendance
            <span className="tab-badge">{lectureAttendance.length}</span>
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
                    <div><Icon name="clipboard" size={32} /></div>
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
                    <span><Icon name="users" /> View All Candidates</span>
                    <span>→</span>
                  </button>

                  <button
                    className="action-button"
                    onClick={() => setActiveTab("results")}
                  >
                    <span><Icon name="file-text" /> View Exam Results</span>
                    <span>→</span>
                  </button>

                  <button
                    className="action-button"
                    onClick={() => ExamStorage.exportResultsToCSV()}
                  >
                    <span><Icon name="download" /> Export Results to Excel / CSV</span>
                    <span><Icon name="download" /></span>
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
                    filteredCandidates.map((c: Candidate) => (
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
                        </td>
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
                              <Icon name="repeat" /> {c.totalAttempts} Attempts
                            </span>
                          ) : (
                            <span>{c.totalAttempts}</span>
                          )}
                        </td>
                        <td>
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
                <Icon name="download" /> Export to Excel / CSV
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
                    filteredResults.map((r: ExamResult) => {
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
                                  <Icon name="repeat" /> Attempt #{r.attemptNumber}
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
                              {/* "Camera Disabled" used to render as a green
                                  "Monitored" badge, because anything that was
                                  not "Warnings" was treated as clean. */}
                              <span
                                className={`badge ${
                                  r.proctoringStatus === "Verified"
                                    ? "badge-passed"
                                    : "badge-failed"
                                }`}
                              >
                                {r.proctoringStatus === "Warnings" ? (
                                  <>
                                    <Icon name="alert-triangle" /> {r.tabSwitches || 0} Warn
                                  </>
                                ) : r.proctoringStatus === "Camera Disabled" ? (
                                  <>
                                    <Icon name="alert-triangle" /> No Camera
                                  </>
                                ) : (
                                  <>
                                    <Icon name="check" /> Monitored
                                  </>
                                )}
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
                                  <Icon name="video" /> Video
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
                                  <Icon name="video" /> Video
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
                    <Icon name="rotate-ccw" /> Reset Defaults
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
                  filteredQuestions.map((q: Question) => (
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
                        {q.options.map((opt: string, i: number) => (
                          <div
                            key={i}
                            className={`q-option-pill ${
                              i === q.correctAnswer ? "correct" : ""
                            }`}
                          >
                            {opt} {i === q.correctAnswer && <> <Icon name="check" /> (Correct)</>}
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
                  <Icon name="check" /> Settings saved successfully!
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
                    {testingEmail ? "Sending..." : <><Icon name="mail" /> Test Email</>}
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
                  Receives exam entry and completion alerts. Supports Gmail, Outlook, or multiple addresses separated by commas.
                </span>

                {tempSettings.isSmtpConfigured ? (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: "rgba(22, 163, 74, 0.1)",
                      color: "#16a34a",
                      border: "1px solid rgba(22, 163, 74, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Icon name="check" size={14} />
                    <span><strong>Email Alerts Active ({tempSettings.smtpHost || "Connected"}):</strong> Real email alerts are dispatched when examinees enter and complete assessments.</span>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: "rgba(245, 158, 11, 0.1)",
                      color: "#b45309",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                    }}
                  >
                    <Icon name="alert-triangle" size={16} style={{ marginTop: "1px", flexShrink: 0 }} />
                    <div>
                      <strong>Email Provider Missing in Railway:</strong> Real email alerts cannot be delivered until <code>RESEND_API_KEY</code> (recommended for Railway over HTTPS 443) or <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> are added to Railway Variables.
                    </div>
                  </div>
                )}

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

            <div className="settings-card">
              <h3>Change Password</h3>
              <p style={{ fontSize: "12px", color: "var(--text-3)", marginTop: 0 }}>
                Changes the password of the account you are signed in as. Do this
                on first login — both admin accounts start on the same password.
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="pw-current">Current password</label>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  className="form-input"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pw-new">New password</label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  className="form-input"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                  Minimum 12 characters.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pw-confirm">Confirm new password</label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  className="form-input"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                />
              </div>

              {pwMsg && (
                <div
                  role="status"
                  style={{
                    marginTop: "8px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    background: pwMsg.success ? "var(--success-soft)" : "var(--danger-soft)",
                    color: pwMsg.success ? "var(--success)" : "var(--danger)",
                    border: `1px solid ${
                      pwMsg.success ? "var(--success-border)" : "var(--danger-border)"
                    }`,
                  }}
                >
                  {pwMsg.text}
                </div>
              )}

              <button
                className="primary-button"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={handleChangePassword}
                disabled={pwBusy || !pwCurrent || !pwNew || !pwConfirm}
              >
                {pwBusy ? "Updating…" : "Change Password"}
              </button>
            </div>
          </div>
        )}

        {/* =========================================
            TAB 5: LECTURES & ATTENDANCE AUDITING
        ========================================= */}
        {activeTab === "lectures" && (
          <div>
            {/* Stats Grid */}
            <section className="stats-grid">
              <div className="stat-card">
                <span>Unique Attendees</span>
                <strong>{lectureStats?.totalAttendees || 0}</strong>
                <small>Employees & candidates</small>
              </div>

              <div className="stat-card">
                <span>Total Engagements</span>
                <strong>{lectureStats?.totalEngagements || 0}</strong>
                <small>Viewing & study sessions</small>
              </div>

              <div className="stat-card">
                <span>Total Learning Time</span>
                <strong>{lectureStats?.totalWatchHours || 0} hrs</strong>
                <small>{Math.round((lectureStats?.totalWatchSeconds || 0) / 60)} minutes total</small>
              </div>

              <div className="stat-card">
                <span>Top Department</span>
                <strong style={{ fontSize: "18px", color: "var(--primary)" }}>
                  {lectureStats?.topDepartment || "None"}
                </strong>
                <small>Highest portal engagement</small>
              </div>
            </section>

            {/* Department Breakdown Pill Bar */}
            {lectureStats && lectureStats.departments && lectureStats.departments.length > 0 && (
              <div
                className="dashboard-card"
                style={{ marginBottom: "24px", padding: "16px 20px" }}
              >
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", marginBottom: "10px" }}>
                  Attendance by Department ("Where they are from")
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {lectureStats.departments.map((dept) => (
                    <button
                      key={dept.department}
                      type="button"
                      onClick={() => setLectureDeptFilter(dept.department)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        background: lectureDeptFilter === dept.department ? "var(--primary)" : "var(--surface-2)",
                        color: lectureDeptFilter === dept.department ? "#ffffff" : "var(--text)",
                        border: "1px solid var(--border)",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      <span>{dept.department}</span>
                      <span
                        style={{
                          background: lectureDeptFilter === dept.department ? "rgba(255,255,255,0.25)" : "var(--border)",
                          padding: "1px 6px",
                          borderRadius: "10px",
                          fontSize: "11px",
                        }}
                      >
                        {dept.uniqueUsers} users
                      </span>
                    </button>
                  ))}
                  {lectureDeptFilter !== "All" && (
                    <button
                      type="button"
                      onClick={() => setLectureDeptFilter("All")}
                      style={{
                        background: "transparent",
                        border: "1px dashed var(--border)",
                        color: "var(--text-3)",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Clear Filter (Show All)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sub-Navigation: Learner Checklists vs Attendance Activity Stream */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "14px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setLectureSubTab("checklist")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: lectureSubTab === "checklist" ? "var(--primary)" : "var(--surface-2)",
                  color: lectureSubTab === "checklist" ? "#ffffff" : "var(--text)",
                  fontWeight: 650,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: lectureSubTab === "checklist" ? "0 2px 6px rgba(37, 99, 235, 0.25)" : "none",
                }}
              >
                <Icon name="check-square" size={15} />
                <span>Learner Checklists & Progress ({filteredUserProgress.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setLectureSubTab("attendance")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: lectureSubTab === "attendance" ? "var(--primary)" : "var(--surface-2)",
                  color: lectureSubTab === "attendance" ? "#ffffff" : "var(--text)",
                  fontWeight: 650,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: lectureSubTab === "attendance" ? "0 2px 6px rgba(37, 99, 235, 0.25)" : "none",
                }}
              >
                <Icon name="clock" size={15} />
                <span>Detailed Activity & Attendance Log ({lectureAttendance.length})</span>
              </button>
            </div>

            {/* Data Table Card */}
            <div className="dashboard-card">
              <div className="table-controls">
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search learner, email, company ID, or department..."
                  value={lectureSearch}
                  onChange={(e) => setLectureSearch(e.target.value)}
                />

                <div className="table-filters" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <select
                    className="filter-select"
                    value={lectureDeptFilter}
                    onChange={(e) => setLectureDeptFilter(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {lectureStats?.departments.map((d) => (
                      <option key={d.department} value={d.department}>
                        {d.department} ({d.uniqueUsers})
                      </option>
                    ))}
                  </select>

                  <select
                    className="filter-select"
                    value={lectureTopicFilter}
                    onChange={(e) => setLectureTopicFilter(e.target.value)}
                  >
                    <option value="All">All Lecture Modules</option>
                    <option value="interface-management">Interface Management Procedure</option>
                    <option value="stakeholder-management">Stakeholder Management Procedure</option>
                    <option value="interface-vs-stakeholder">Interface vs Stakeholder Comparison</option>
                    <option value="logistics-management">Logistics Management Procedure</option>
                    {lectureSubTab === "attendance" && <option value="portal">General Portal Access</option>}
                  </select>

                  {lectureSubTab === "attendance" && (
                    <select
                      className="filter-select"
                      value={lectureActionFilter}
                      onChange={(e) => setLectureActionFilter(e.target.value)}
                    >
                      <option value="All">All Actions</option>
                      <option value="CHECKLIST_UPDATED">Checklist Updated</option>
                      <option value="VIDEO_WATCHED">Video Watched</option>
                      <option value="VIDEO_COMPLETED">Video Completed</option>
                      <option value="SLIDES_DOWNLOADED">Slides Downloaded</option>
                      <option value="PORTAL_ACCESS">Portal Entry</option>
                      <option value="LECTURE_VIEWED">Lecture Selected</option>
                    </select>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="secondary-button"
                    style={{ padding: "9px 14px", fontSize: "13px" }}
                    onClick={fetchLectureAttendance}
                    title="Refresh data"
                    disabled={loadingLectures}
                  >
                    <Icon name="rotate-ccw" />
                  </button>

                  <button
                    className="primary-button"
                    style={{ padding: "9px 18px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px" }}
                    onClick={() => {
                      window.open(api.getLectureExportUrl(), "_blank");
                    }}
                    title="Export all lecture attendance & checklist completion data to an Excel-compatible spreadsheet"
                  >
                    <Icon name="download" />
                    <span>Export to Excel / CSV</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: LEARNER CHECKLISTS & MODULE PROGRESS */}
              {lectureSubTab === "checklist" && (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Learner Name</th>
                        <th>Email Address</th>
                        <th>Company ID</th>
                        <th>Department</th>
                        <th>Module Briefing</th>
                        <th style={{ minWidth: "150px" }}>Checklist Progress</th>
                        <th>Milestone Status</th>
                        <th>Last Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLectures ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: "35px" }}>
                            Loading learner checklist records...
                          </td>
                        </tr>
                      ) : filteredUserProgress.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: "center", padding: "35px" }}>
                            No learner checklist records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredUserProgress.map((prog) => {
                          const pct = prog.completionPercent || 0;
                          const isFullyDone = pct === 100;

                          return (
                            <tr key={`${prog.candidateEmail}_${prog.lectureId}`}>
                              <td>
                                <strong>{prog.candidateName}</strong>
                              </td>
                              <td style={{ color: "var(--text-3)", fontSize: "12px" }}>
                                {prog.candidateEmail}
                              </td>
                              <td>
                                <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text)" }}>
                                  {prog.companyId}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: "rgba(37, 99, 235, 0.12)",
                                    color: "var(--primary)",
                                    fontWeight: 650,
                                    fontSize: "12px",
                                  }}
                                >
                                  {prog.department}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600 }}>
                                  {LECTURE_TITLES[prog.lectureId] || prog.lectureId}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 700 }}>
                                    <span style={{ color: isFullyDone ? "var(--success)" : "var(--primary)" }}>
                                      {pct}%
                                    </span>
                                    <span style={{ color: "var(--text-3)", fontSize: "11px" }}>
                                      {isFullyDone ? "Completed" : "In Progress"}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      width: "100%",
                                      height: "6px",
                                      background: "var(--border)",
                                      borderRadius: "3px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, pct))}%`,
                                        height: "100%",
                                        background: isFullyDone ? "var(--success)" : "var(--primary)",
                                        borderRadius: "3px",
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                  <span
                                    className="badge"
                                    style={{
                                      background: prog.videoCompleted ? "var(--success-soft)" : "var(--surface-2)",
                                      color: prog.videoCompleted ? "var(--success)" : "var(--text-3)",
                                      border: `1px solid ${prog.videoCompleted ? "var(--success-border)" : "var(--border)"}`,
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                    }}
                                    title={prog.videoCompleted ? "Video Briefing Completed (35%)" : "Video Briefing Incomplete"}
                                  >
                                    <Icon name={prog.videoCompleted ? "check-circle" : "square"} size={11} /> Video
                                  </span>
                                  <span
                                    className="badge"
                                    style={{
                                      background: prog.slidesViewed ? "var(--success-soft)" : "var(--surface-2)",
                                      color: prog.slidesViewed ? "var(--success)" : "var(--text-3)",
                                      border: `1px solid ${prog.slidesViewed ? "var(--success-border)" : "var(--border)"}`,
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                    }}
                                    title={prog.slidesViewed ? "Slide Deck Reviewed (35%)" : "Slide Deck Pending"}
                                  >
                                    <Icon name={prog.slidesViewed ? "check-circle" : "square"} size={11} /> Slides
                                  </span>
                                  <span
                                    className="badge"
                                    style={{
                                      background: prog.checkpointsFinished ? "var(--success-soft)" : "var(--surface-2)",
                                      color: prog.checkpointsFinished ? "var(--success)" : "var(--text-3)",
                                      border: `1px solid ${prog.checkpointsFinished ? "var(--success-border)" : "var(--border)"}`,
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                    }}
                                    title={prog.checkpointsFinished ? "All Key Checkpoints Finished (20%)" : "Key Checkpoints Incomplete"}
                                  >
                                    <Icon name={prog.checkpointsFinished ? "check-circle" : "square"} size={11} /> Checkpoints
                                  </span>
                                  <span
                                    className="badge"
                                    style={{
                                      background: prog.slidesDownloaded ? "rgba(56, 189, 248, 0.15)" : "var(--surface-2)",
                                      color: prog.slidesDownloaded ? "#0284c7" : "var(--text-3)",
                                      border: `1px solid ${prog.slidesDownloaded ? "rgba(56, 189, 248, 0.3)" : "var(--border)"}`,
                                      fontSize: "11px",
                                      padding: "2px 6px",
                                    }}
                                    title={prog.slidesDownloaded ? "PPTX Slides Downloaded (10%)" : "PPTX Slides Not Downloaded"}
                                  >
                                    <Icon name={prog.slidesDownloaded ? "download" : "square"} size={11} /> PPTX
                                  </span>
                                </div>
                              </td>
                              <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                                {prog.updatedAt ? new Date(prog.updatedAt).toLocaleString() : "—"}
                              </td>
                              <td>
                                <button
                                  className="btn-sm secondary-button"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    fontSize: "12px",
                                    padding: "5px 10px",
                                  }}
                                  onClick={() => setInspectedProgress(prog)}
                                  title="Inspect individual checklist items and completion breakdown"
                                >
                                  <Icon name="eye" size={13} />
                                  <span>Inspect</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2: DETAILED ATTENDANCE ACTIVITY STREAM */}
              {lectureSubTab === "attendance" && (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Attendee Name</th>
                        <th>Email Address</th>
                        <th>Company ID</th>
                        <th>Department</th>
                        <th>Lecture / Briefing</th>
                        <th>Activity Type</th>
                        <th>Duration / Progress</th>
                        <th>Checklist %</th>
                        <th>Date & Time</th>
                        <th>Device / IP</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLectures ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: "center", padding: "35px" }}>
                            Loading attendance records...
                          </td>
                        </tr>
                      ) : lectureAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: "center", padding: "35px" }}>
                            No lecture attendance records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        lectureAttendance.map((rec) => {
                          const mins = Math.floor(rec.watchDurationSeconds / 60);
                          const secs = rec.watchDurationSeconds % 60;
                          const durationStr = `${mins}m ${secs}s`;

                          return (
                            <tr key={rec.id}>
                              <td>
                                <strong>{rec.candidateName}</strong>
                              </td>
                              <td style={{ color: "var(--text-3)", fontSize: "12px" }}>
                                {rec.candidateEmail}
                              </td>
                              <td>
                                <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text)" }}>
                                  {rec.companyId}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: "rgba(37, 99, 235, 0.12)",
                                    color: "var(--primary)",
                                    fontWeight: 650,
                                    fontSize: "12px",
                                  }}
                                >
                                  {rec.department}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600 }}>{rec.lectureTitle}</span>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background:
                                      rec.action === "CHECKLIST_UPDATED"
                                        ? "rgba(16, 185, 129, 0.15)"
                                        : rec.action === "VIDEO_COMPLETED"
                                        ? "var(--success-soft)"
                                        : rec.action === "SLIDES_DOWNLOADED"
                                        ? "rgba(56, 189, 248, 0.15)"
                                        : "var(--surface-2)",
                                    color:
                                      rec.action === "CHECKLIST_UPDATED"
                                        ? "#059669"
                                        : rec.action === "VIDEO_COMPLETED"
                                        ? "var(--success)"
                                        : rec.action === "SLIDES_DOWNLOADED"
                                        ? "#0284c7"
                                        : "var(--text-2)",
                                  }}
                                >
                                  {rec.action === "CHECKLIST_UPDATED"
                                    ? "Checklist Updated"
                                    : rec.action === "SLIDES_DOWNLOADED"
                                    ? "Slides Downloaded"
                                    : rec.action === "VIDEO_COMPLETED"
                                    ? "Video Completed"
                                    : rec.action === "VIDEO_WATCHED"
                                    ? "Video Watched"
                                    : rec.action === "PORTAL_ACCESS"
                                    ? "Portal Entry"
                                    : rec.action}
                                </span>
                              </td>
                              <td>
                                {rec.watchDurationSeconds > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{durationStr}</span>
                                    {rec.maxProgressPercent > 0 && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <div
                                          style={{
                                            width: "60px",
                                            height: "5px",
                                            background: "var(--border)",
                                            borderRadius: "3px",
                                            overflow: "hidden",
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: `${Math.min(100, rec.maxProgressPercent)}%`,
                                              height: "100%",
                                              background: "var(--success)",
                                            }}
                                          />
                                        </div>
                                        <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                                          {Math.round(rec.maxProgressPercent)}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-3)", fontSize: "12px" }}>—</span>
                                )}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                {rec.completionPercent !== undefined ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      background: rec.completionPercent === 100 ? "var(--success-soft)" : "rgba(37, 99, 235, 0.1)",
                                      color: rec.completionPercent === 100 ? "var(--success)" : "var(--primary)",
                                    }}
                                  >
                                    {rec.completionPercent}%
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-3)", fontSize: "12px" }}>—</span>
                                )}
                              </td>
                              <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                                {new Date(rec.createdAt).toLocaleString()}
                              </td>
                              <td style={{ fontSize: "11px", color: "var(--text-3)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${rec.ipAddress || "127.0.0.1"} • ${rec.userAgent || ""}`}>
                                {rec.ipAddress || "127.0.0.1"}
                              </td>
                              <td>
                                <button
                                  className="btn-sm"
                                  style={{ color: "var(--danger)", background: "transparent", border: "none", cursor: "pointer" }}
                                  onClick={async () => {
                                    if (window.confirm(`Delete attendance record for ${rec.candidateName}?`)) {
                                      try {
                                        await api.deleteLectureAttendance(rec.id);
                                        fetchLectureAttendance();
                                      } catch (err: unknown) {
                                        alert(err instanceof Error ? err.message : "Failed to delete record.");
                                      }
                                    }
                                  }}
                                  title="Delete attendance record"
                                >
                                  <Icon name="x" size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
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
                <Icon name="x" label="Close" />
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
                        selectedResult.proctoringStatus === "Verified"
                          ? "var(--success)"
                          : "var(--danger)",
                    }}
                  >
                    {selectedResult.proctoringStatus === "Warnings" ? (
                      <>
                        <Icon name="alert-triangle" /> {selectedResult.tabSwitches || 0} Tab
                        Switch(es)
                      </>
                    ) : selectedResult.proctoringStatus === "Camera Disabled" ? (
                      <>
                        <Icon name="alert-triangle" /> Camera Disabled — no recording
                      </>
                    ) : (
                      <>
                        <Icon name="check" /> Monitored (0 Warnings)
                      </>
                    )}
                  </strong>
                </div>
              </div>

              {/* Proctor Video Recording if available */}
              {(loadedVideoUrl || selectedResult.hasVideoRecording || selectedResult.videoFilename) ? (
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
                        <Icon name="video" /> Recorded Proctoring Video
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
                        Complete camera feed captured during candidate examination
                      </span>
                    </div>

                    {(() => {
                      const videoBase =
                        import.meta.env.VITE_API_URL ||
                        (typeof window !== "undefined" &&
                        window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1"
                          ? `${window.location.origin}/api`
                          : "http://localhost:5000/api");
                      const adminToken = sessionStorage.getItem("adminToken") || "";
                      const dlUrl = selectedResult.videoFilename
                        ? `${videoBase}/proctor/download/${selectedResult.videoFilename}?token=${encodeURIComponent(adminToken)}&name=${encodeURIComponent(
                            `proctor_${selectedResult.candidateName.replace(/\s+/g, "_")}_${selectedResult.id}.webm`
                          )}`
                        : loadedVideoUrl || "#";

                      return (
                        <a
                          href={dlUrl}
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
                            color: "var(--surface)",
                            background: "var(--primary)",
                            borderColor: "var(--primary-border)",
                            fontWeight: 650,
                            padding: "6px 14px",
                            borderRadius: "6px",
                          }}
                          title="Directly download full video recording"
                        >
                          <Icon name="download" /> Download Full Video (.webm)
                        </a>
                      );
                    })()}
                  </div>

                  {loadedVideoUrl ? (
                    <div
                      style={{
                        background: "var(--text, #0f172a)",
                        borderRadius: "8px",
                        overflow: "hidden",
                        maxHeight: "340px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <video
                        src={loadedVideoUrl}
                        controls
                        playsInline
                        style={{
                          width: "100%",
                          maxHeight: "340px",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "20px",
                        background: "#0f172a",
                        borderRadius: "8px",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: "13px",
                      }}
                    >
                      ⏳ Loading video recording stream...
                    </div>
                  )}
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
                          {isCorrect ? <><Icon name="check" /> Correct</> : <><Icon name="x" /> Incorrect</>}
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

                        {!isCorrect && q.correctAnswer !== undefined && (
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
                <Icon name="x" label="Close" />
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
                const timeSince = now - lastAttemptTime;
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
                            <Icon name="ban" /> 48-Hour Re-attempt Cooldown Active
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
                          <Icon name="unlock" /> Clear Cooldown (Allow Retest)
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
                        <span><Icon name="check" /></span>
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
                                    {attemptNum > 1 ? <><Icon name="repeat" /> Attempt #{attemptNum}</> : `Attempt #${attemptNum}`}
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
                <Icon name="x" label="Close" />
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

      {/* =========================================
          MODAL: INSPECT LEARNER CHECKLIST BREAKDOWN
      ========================================= */}
      {inspectedProgress && (
        <div className="modal-backdrop" onClick={() => setInspectedProgress(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "700px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: "rgba(37, 99, 235, 0.12)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check-square" size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 750 }}>
                    Learner Checklist & Content Audit
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-3)" }}>
                    {inspectedProgress.candidateName} • {inspectedProgress.department} • {inspectedProgress.companyId}
                  </p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setInspectedProgress(null)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {(() => {
                let itemsList: string[] = [];
                try {
                  if (typeof inspectedProgress.completedItems === "string") {
                    itemsList = JSON.parse(inspectedProgress.completedItems);
                  } else if (Array.isArray(inspectedProgress.completedItems)) {
                    itemsList = inspectedProgress.completedItems;
                  }
                } catch {
                  itemsList = [];
                }

                const isVideoDone = itemsList.includes("video") || inspectedProgress.videoCompleted;
                const isSlidesDone = itemsList.includes("slides") || inspectedProgress.slidesViewed;
                const isDownloadDone = itemsList.includes("download") || inspectedProgress.slidesDownloaded;

                const moduleTitle = LECTURE_TITLES[inspectedProgress.lectureId] || inspectedProgress.lectureId;
                const cps = LECTURE_CHECKPOINTS_META[inspectedProgress.lectureId] || [];
                const doneCpCount = cps.filter(
                  (cp) => itemsList.includes(cp.id) || itemsList.includes(`checkpoint:${cp.id}`)
                ).length;
                const pct = inspectedProgress.completionPercent || 0;

                return (
                  <>
                    {/* Header Progress Banner */}
                    <div
                      style={{
                        padding: "16px 20px",
                        background: "var(--surface-2)",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "12px",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase" }}>
                            Module Content Sitting
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 750, color: "var(--text)", marginTop: "2px" }}>
                            {moduleTitle}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                            {inspectedProgress.candidateEmail}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span
                            className="badge"
                            style={{
                              padding: "4px 10px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: pct === 100 ? "var(--success-soft)" : "rgba(37, 99, 235, 0.12)",
                              color: pct === 100 ? "var(--success)" : "var(--primary)",
                            }}
                          >
                            {pct === 100 ? "100% Completed" : `${pct}% In Progress`}
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div
                        style={{
                          width: "100%",
                          height: "8px",
                          background: "var(--border)",
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            height: "100%",
                            background: pct === 100 ? "var(--success)" : "var(--primary)",
                            borderRadius: "4px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "11px",
                          color: "var(--text-3)",
                          marginTop: "6px",
                        }}
                      >
                        <span>Weighted: 35% Video + 35% Slides + 20% Checkpoints + 10% PPTX</span>
                        <span>Last Active: {inspectedProgress.updatedAt ? new Date(inspectedProgress.updatedAt).toLocaleString() : "—"}</span>
                      </div>
                    </div>

                    {/* 4 Core Pillars Checklist */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                        Module Content Verification Breakdown
                      </div>

                      {/* 1. Video */}
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: `1px solid ${isVideoDone ? "var(--success-border)" : "var(--border)"}`,
                          background: isVideoDone ? "var(--success-soft)" : "var(--surface)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ color: isVideoDone ? "var(--success)" : "var(--text-3)", marginTop: "2px" }}>
                            <Icon name={isVideoDone ? "check-circle" : "square"} size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: isVideoDone ? "var(--success)" : "var(--text)" }}>
                              Video Briefing Recording (35% weight)
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                              {isVideoDone
                                ? "Learner watched the full video briefing (at least 80% streamed or verified finish)."
                                : "Learner has not yet completed the full briefing playback."}
                            </div>
                          </div>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: isVideoDone ? "var(--success)" : "var(--surface-2)",
                            color: isVideoDone ? "#ffffff" : "var(--text-3)",
                            fontWeight: 700,
                            fontSize: "11px",
                          }}
                        >
                          {isVideoDone ? "35% Awarded" : "0 / 35%"}
                        </span>
                      </div>

                      {/* 2. Slides Review */}
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: `1px solid ${isSlidesDone ? "var(--success-border)" : "var(--border)"}`,
                          background: isSlidesDone ? "var(--success-soft)" : "var(--surface)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ color: isSlidesDone ? "var(--success)" : "var(--text-3)", marginTop: "2px" }}>
                            <Icon name={isSlidesDone ? "check-circle" : "square"} size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: isSlidesDone ? "var(--success)" : "var(--text)" }}>
                              Slide Deck Portal Review (35% weight)
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                              {isSlidesDone
                                ? "Learner opened and reviewed all slides inside the interactive slide reader."
                                : "Learner has not yet completed browsing the slide deck."}
                            </div>
                          </div>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: isSlidesDone ? "var(--success)" : "var(--surface-2)",
                            color: isSlidesDone ? "#ffffff" : "var(--text-3)",
                            fontWeight: 700,
                            fontSize: "11px",
                          }}
                        >
                          {isSlidesDone ? "35% Awarded" : "0 / 35%"}
                        </span>
                      </div>

                      {/* 3. Checkpoints */}
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ color: doneCpCount === cps.length ? "var(--success)" : "var(--primary)" }}>
                              <Icon name="check-square" size={20} />
                            </div>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>
                                Key Procedure Takeaways & Checkpoints (20% weight)
                              </span>
                              <span style={{ fontSize: "12px", color: "var(--text-3)", marginLeft: "8px" }}>
                                ({doneCpCount} of {cps.length} verified)
                              </span>
                            </div>
                          </div>
                          <span
                            className="badge"
                            style={{
                              background: doneCpCount === cps.length ? "var(--success-soft)" : "rgba(37, 99, 235, 0.12)",
                              color: doneCpCount === cps.length ? "var(--success)" : "var(--primary)",
                              fontWeight: 700,
                              fontSize: "11px",
                            }}
                          >
                            {Math.round((doneCpCount / (cps.length || 1)) * 20)}% / 20%
                          </span>
                        </div>

                        {/* Checklist items list */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                          {cps.map((cp) => {
                            const isDone =
                              itemsList.includes(cp.id) ||
                              itemsList.includes(`checkpoint:${cp.id}`);

                            return (
                              <div
                                key={cp.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  background: isDone ? "var(--success-soft)" : "var(--surface-2)",
                                  border: `1px solid ${isDone ? "var(--success-border)" : "var(--border)"}`,
                                }}
                              >
                                <div style={{ color: isDone ? "var(--success)" : "var(--text-3)", marginTop: "1px" }}>
                                  <Icon name={isDone ? "check" : "square"} size={16} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 650,
                                      color: isDone ? "var(--success)" : "var(--text)",
                                    }}
                                  >
                                    {cp.label}
                                  </div>
                                  <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: "1px" }}>
                                    {cp.description}
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: isDone ? "var(--success)" : "var(--text-3)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isDone ? "✓ Checked" : "Pending"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. PPTX Download */}
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: `1px solid ${isDownloadDone ? "rgba(56, 189, 248, 0.3)" : "var(--border)"}`,
                          background: isDownloadDone ? "rgba(56, 189, 248, 0.1)" : "var(--surface)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ color: isDownloadDone ? "#0284c7" : "var(--text-3)", marginTop: "2px" }}>
                            <Icon name={isDownloadDone ? "check-circle" : "square"} size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: isDownloadDone ? "#0284c7" : "var(--text)" }}>
                              Offline Presentation (PPTX) Download (10% weight)
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "2px" }}>
                              {isDownloadDone
                                ? "Learner downloaded the authentic .pptx slide deck for offline review."
                                : "Learner has not yet downloaded the offline PowerPoint presentation."}
                            </div>
                          </div>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background: isDownloadDone ? "#0284c7" : "var(--surface-2)",
                            color: isDownloadDone ? "#ffffff" : "var(--text-3)",
                            fontWeight: 700,
                            fontSize: "11px",
                          }}
                        >
                          {isDownloadDone ? "10% Awarded" : "0 / 10%"}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button
                className="primary-button"
                onClick={() => setInspectedProgress(null)}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Dashboard Attribution Footer */}
      <footer
        style={{
          marginTop: "60px",
          padding: "20px 36px",
          borderTop: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          fontSize: "13px",
          color: "#64748b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="company-logo-badge" style={{ height: "40px", padding: "3px 8px" }}>
            <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" style={{ height: "30px" }} />
          </div>
          <span>Mofarreh Group • Assessment Management Command Center</span>
        </div>
        <PoweredBy prefix="Architected & Powered by" />
      </footer>
    </div>
  );
}

export default AdminDashboard;