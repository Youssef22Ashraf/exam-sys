import { useState, useEffect } from "react";

import ExamRegistration from "./pages/ExamRegistration";
import ExamInstructions from "./pages/ExamInstructions";
import Exam from "./pages/Exam";
import ExamResults from "./pages/ExamResults";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { ExamStorage, type ExamResult } from "./services/storage";

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

  // Support direct access via URL hash (e.g. http://localhost:5173/#admin)
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#admin" || hash === "#admin-login") {
        setPage("admin-login");
      }
    }
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  function startExam() {
    setPage("registration");
  }

  function openAdmin() {
    setPage("admin-login");
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
    window.location.hash = "";
    setPage("home");
  }

  function openAdminDashboard() {
    setPage("admin-dashboard");
  }

  function logoutAdmin() {
    window.location.hash = "";
    setPage("home");
  }

  if (page === "registration") {
    return (
      <div className="app">
        <AppHeader onOpenAdmin={openAdmin} />

        <ExamRegistration onContinue={handleRegistration} />

        <AppFooter />
      </div>
    );
  }

  if (page === "instructions") {
    return (
      <div className="app">
        <AppHeader onOpenAdmin={openAdmin} />

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
        questions={ExamStorage.getQuestions()}
        onReturnHome={openCandidateHome}
        onOpenAdmin={openAdmin}
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
      <AppHeader onOpenAdmin={openAdmin} />

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
                Take an Exam →
              </button>

              <button className="secondary-button" onClick={openAdmin}>
                Admin Portal
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

function AppHeader({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">E</div>

        <div className="brand-text">
          <span className="brand-title">EXAM SYSTEM</span>

          <span className="brand-subtitle">Workplace Assessment Portal</span>
        </div>
      </div>

      {onOpenAdmin && (
        <button
          onClick={onOpenAdmin}
          className="secondary-button"
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Admin Portal</span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>🔒</span>
        </button>
      )}
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">Workplace Assessment System</footer>
  );
}

export default App;