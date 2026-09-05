import { useState } from "react";

interface AdminLoginProps {
  onLogin: () => void;
  onBack: () => void;
}

function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMsg("");

    /*
      PROTOTYPE LOGIN
      Default credentials: admin / admin123
    */
    if (username === "admin" && password === "admin123") {
      onLogin();
    } else {
      setErrorMsg("Invalid credentials. Use admin / admin123 for prototype access.");
    }
  }

  function handleAutofill() {
    setUsername("admin");
    setPassword("admin123");
    setErrorMsg("");
  }

  return (
    <main className="page-container">
      <div style={{ textAlign: "center" }}>
        <h1 className="page-title">Admin Portal</h1>
        <p className="page-description">Authorized personnel only.</p>
      </div>

      <div className="card form-card">
        {/* Quick Autofill Helper */}
        <div
          onClick={handleAutofill}
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            background: "#eff6ff",
            border: "1px dashed #93c5fd",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#1d4ed8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "background 0.2s",
          }}
          title="Click to fill prototype credentials"
        >
          <span>🔑 <strong>Prototype Login:</strong> admin / admin123</span>
          <span style={{ fontSize: "12px", textDecoration: "underline", fontWeight: 650 }}>
            Click to Autofill
          </span>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "12px 14px",
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              color: "#991b1b",
              fontSize: "13px",
              marginBottom: "18px",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
            />
          </div>

          <button
            type="submit"
            className="primary-button"
            style={{ width: "100%" }}
          >
            Sign In to Dashboard →
          </button>
        </form>

        <button
          type="button"
          className="secondary-button"
          style={{
            width: "100%",
            marginTop: "12px",
          }}
          onClick={onBack}
        >
          ← Back to Candidate Portal
        </button>
      </div>
    </main>
  );
}

export default AdminLogin;