import { useState, useEffect } from "react";

import ExamRegistration from "./pages/ExamRegistration";
import ExamInstructions from "./pages/ExamInstructions";
import Exam from "./pages/Exam";
import ExamResults from "./pages/ExamResults";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { ExamStorage, type ExamResult } from "./services/storage";
import { api } from "./services/api";
import { releaseCamera } from "./services/camera";

import "./styles.css";
import "./App.css";

interface UserData {
  name: string;
  email: string;
  companyId: string;
}

function App() {
  const [page, setPage] = useState("home");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Synchronize latest exam settings & questions from backend on launch
  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        ExamStorage.saveSettings(settings);
      })
      .catch(() => {});

    api
      .getQuestions()
      .then((questions) => {
        if (questions && questions.length > 0) {
          ExamStorage.saveQuestions(questions);
        }
      })
      .catch(() => {});
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
    console.log("Exam started for:", userData);
    setPage("exam");
  }

  function handleFinishExam(result: ExamResult) {
    setExamResult(result);
    setPage("results");
  }

  function openCandidateHome() {
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

        <AdminLogin
          onLogin={openAdminDashboard}
          onBack={openCandidateHome}
        />

        <AppFooter />
      </div>
    );
  }

  if (page === "admin-dashboard") {
    return <AdminDashboard onLogout={logoutAdmin} />;
  }

  return (
    <div className="app">
      <AppHeader />

      <main className="page-container home-page">
        <section className="home-hero">
          <div className="hero-content">
            <div className="hero-badge">WORKPLACE ASSESSMENT</div>

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
            <div className="hero-panel-icon">✓</div>

            <h3>Secure Assessment</h3>

            <p>
              Your examination is timed and your results are recorded for
              authorized management review.
            </p>

            <div className="hero-feature">
              <span>✓</span>
              Timed examination
            </div>

            <div className="hero-feature">
              <span>✓</span>
              Multiple question types
            </div>

            <div className="hero-feature">
              <span>✓</span>
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
        <div className="brand-icon">E</div>

        <div className="brand-text">
          <span className="brand-title">EXAM SYSTEM</span>

          <span className="brand-subtitle">Workplace Assessment Portal</span>
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">Workplace Assessment System</footer>
  );
}

export default App;