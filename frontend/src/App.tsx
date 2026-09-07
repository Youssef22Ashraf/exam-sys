import { useState, useEffect, lazy, Suspense } from "react";
import { Icon } from "./components/Icon";

import ExamRegistration from "./pages/ExamRegistration";
import ExamInstructions from "./pages/ExamInstructions";
import Exam from "./pages/Exam";
import ExamResults from "./pages/ExamResults";
import { ExamStorage, type ExamResult } from "./services/storage";
import { api, ADMIN_SESSION_EXPIRED_EVENT } from "./services/api";
import { releaseCamera } from "./services/camera";
import { reconnectSocket } from "./services/socket";

// The admin portal is a large bundle a candidate never opens, and it carried
// the whole dashboard plus its CSS into every candidate's first load. React's
// own lazy(); no router library, per ADR 002.
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

function AdminChunkFallback() {
  return (
    <main className="page-container" role="status" aria-live="polite">
      <p style={{ textAlign: "center", margin: "80px auto" }}>
        Loading the admin portal…
      </p>
    </main>
  );
}

import "./styles.css";
import "./App.css";

interface UserData {
  name: string;
  email: string;
  companyId: string;
}

/** Marks an exam the candidate has actually started, so a refresh can resume it. */
const ACTIVE_EXAM_KEY = "exam_active_candidate";

/**
 * The candidate of an exam still in progress, or null.
 *
 * `page` and `userData` are component state, so a mid-exam refresh used to
 * drop the candidate on the marketing hero: the answer draft survived but was
 * only reachable by re-registering with the identical email, which the
 * cooldown check could refuse outright. The sitting id is the marker --
 * Exam.tsx clears it on a successful submit, so a restored exam is always one
 * that was genuinely still running.
 */
function readExamInProgress(): UserData | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_EXAM_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as UserData;
    if (!saved?.email) return null;
    if (!sessionStorage.getItem(`exam_sid_${saved.email}`)) {
      // The sitting was submitted; nothing to resume.
      sessionStorage.removeItem(ACTIVE_EXAM_KEY);
      return null;
    }
    return saved;
  } catch (err) {
    console.warn("Could not restore the exam in progress:", err);
    return null;
  }
}

function App() {
  // Restored once, during the first render, rather than by a mount effect
  // that immediately calls setState.
  const [restoredExam] = useState(readExamInProgress);
  const [page, setPage] = useState(restoredExam ? "exam" : "home");
  const [userData, setUserData] = useState<UserData | null>(restoredExam);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Synchronize latest exam settings & questions from backend on launch
  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        ExamStorage.saveSettings(settings);
      })
      .catch((err) => console.warn("Could not sync exam settings:", err));

    api
      .getQuestions()
      .then((questions) => {
        if (questions && questions.length > 0) {
          ExamStorage.saveQuestions(questions);
        }
      })
      .catch((err) => console.warn("Could not sync the question bank:", err));
  }, []);

  // Dedicated route listener for Admin Portal:
  // Access via URL pathname (/admin, /admin/login) or URL hash (#admin, #admin-login)
  useEffect(() => {
    function handleRouting() {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const isAdminRoute =
        pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        hash === "#admin" ||
        hash === "#admin-login";

      if (isAdminRoute) {
        const token = sessionStorage.getItem("adminToken");
        if (token) {
          setPage("admin-dashboard");
        } else {
          setPage("admin-login");
        }
      }
    }

    handleRouting();
    window.addEventListener("hashchange", handleRouting);
    window.addEventListener("popstate", handleRouting);
    return () => {
      window.removeEventListener("hashchange", handleRouting);
      window.removeEventListener("popstate", handleRouting);
    };
  }, []);

  // An expired or revoked admin token used to go unnoticed: every call fell
  // back to the localStorage cache, so the dashboard stayed up showing stale
  // data as though it were live. api.ts raises this; sign the admin out.
  useEffect(() => {
    function onSessionExpired() {
      setPage((prev) =>
        prev === "admin-dashboard" || prev === "admin-login" ? "admin-login" : prev
      );
    }
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () =>
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  // Hidden proctor hotkey (Ctrl + Shift + A) to toggle Admin Portal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "A" || e.key === "a")
      ) {
        e.preventDefault();
        setPage((prev) => {
          if (prev === "admin-login" || prev === "admin-dashboard") {
            window.history.pushState(null, "", "/");
            return "home";
          } else {
            window.history.pushState(null, "", "/admin");
            const token = sessionStorage.getItem("adminToken");
            return token ? "admin-dashboard" : "admin-login";
          }
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function startExam() {
    setPage("registration");
  }

  function handleRegistration(data: UserData) {
    ExamStorage.registerOrUpdateCandidate(data);
    setUserData(data);
    setPage("instructions");
  }

  function beginExam() {
    if (userData) {
      try {
        sessionStorage.setItem(ACTIVE_EXAM_KEY, JSON.stringify(userData));
      } catch (err) {
        console.warn("Could not mark the exam as in progress:", err);
      }
    }
    setPage("exam");
  }

  function clearActiveExam() {
    try {
      sessionStorage.removeItem(ACTIVE_EXAM_KEY);
    } catch (err) {
      console.warn("Could not clear the exam-in-progress marker:", err);
    }
  }

  function handleFinishExam(result: ExamResult) {
    clearActiveExam();
    setExamResult(result);
    setPage("results");
  }

  function openCandidateHome() {
    clearActiveExam();
    releaseCamera();
    window.history.pushState(null, "", "/");
    window.location.hash = "";
    setPage("home");
  }

  function openAdminDashboard() {
    window.history.pushState(null, "", "/admin");
    setPage("admin-dashboard");
  }

  function logoutAdmin() {
    sessionStorage.removeItem("adminToken");
    // Drop the authenticated socket so this browser stops receiving admin:*
    // events the moment the token is gone.
    reconnectSocket();
    window.history.pushState(null, "", "/");
    window.location.hash = "";
    setPage("home");
  }

  if (page === "registration") {
    return (
      <div className="app">
        <AppHeader />

        <ExamRegistration onContinue={handleRegistration} />

        <AppFooter />
      </div>
    );
  }

  if (page === "instructions") {
    return (
      <div className="app">
        <AppHeader />

        <ExamInstructions onStart={beginExam} />

        <AppFooter />
      </div>
    );
  }

  if (page === "exam") {
    return (
      <Exam userData={userData} onFinishExam={handleFinishExam} />
    );
  }

  if (page === "results" && examResult) {
    return (
      <ExamResults
        result={examResult}
        onReturnHome={openCandidateHome}
      />
    );
  }

  if (page === "admin-login") {
    return (
      <div className="app">
        <AppHeader />

        <Suspense fallback={<AdminChunkFallback />}>
          <AdminLogin
            onLogin={openAdminDashboard}
            onBack={openCandidateHome}
          />
        </Suspense>

        <AppFooter />
      </div>
    );
  }

  if (page === "admin-dashboard") {
    return (
      <Suspense fallback={<AdminChunkFallback />}>
        <AdminDashboard onLogout={logoutAdmin} />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <AppHeader />

      <main className="page-container home-page">
        <section className="home-hero">
          <div className="hero-content">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div className="company-logo-badge" title="Mofarreh Group — Engineering & Construction">
                <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" />
              </div>
              <div className="hero-badge">WORKPLACE ASSESSMENT</div>
            </div>

            <h1>
              Employee & Workplace
              <br />
              Examination System
            </h1>

            <p>
              Complete your required assessment before workplace or site access.
            </p>

            <div className="hero-actions">
              <button className="primary-button" onClick={startExam}>
                Start Assessment →
              </button>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-icon"><Icon name="check" /></div>

            <h3>Secure Assessment</h3>

            <p>
              Your examination is timed and your results are recorded for
              authorized management review.
            </p>

            <div className="hero-feature">
              <span><Icon name="check" /></span>
              Timed examination
            </div>

            <div className="hero-feature">
              <span><Icon name="check" /></span>
              Multiple question types
            </div>

            <div className="hero-feature">
              <span><Icon name="check" /></span>
              Automated scoring
            </div>
          </div>
        </section>

        <section className="home-info">
          <div className="info-card">
            <strong>01</strong>
            <h3>Register</h3>
            <p>Enter your identification and contact information.</p>
          </div>

          <div className="info-card">
            <strong>02</strong>
            <h3>Complete Assessment</h3>
            <p>Answer all required questions within the allocated time.</p>
          </div>

          <div className="info-card">
            <strong>03</strong>
            <h3>Submit</h3>
            <p>Your result is calculated after submitting the examination.</p>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="company-logo-badge" title="Mofarreh Group — Engineering & Construction">
          <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" />
        </div>

        <div className="brand-text">
          <span className="brand-title">EXAM SYSTEM</span>
          <span className="brand-subtitle">Workplace Assessment Portal</span>
        </div>
      </div>

      <div className="powered-by-tag">
        <span className="powered-by-icon"><Icon name="zap" /></span>
        <span className="powered-by-prefix">Powered by</span>
        <span className="powered-by-name">Eng. Youssef Ashraf</span>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-left">
        <div className="company-logo-badge" style={{ height: "40px", padding: "3px 8px" }}>
          <img src="/mofarreh-logo.png" alt="Mofarreh Group Logo" style={{ height: "30px" }} />
        </div>
        <span>Mofarreh Group • Engineering & Construction Assessment Portal</span>
      </div>
      <div className="footer-right">
        <div className="powered-by-tag">
          <span className="powered-by-icon"><Icon name="zap" /></span>
          <span className="powered-by-prefix">System Engineered & Powered by</span>
          <span className="powered-by-name">Eng. Youssef Ashraf</span>
        </div>
      </div>
    </footer>
  );
}

export default App;