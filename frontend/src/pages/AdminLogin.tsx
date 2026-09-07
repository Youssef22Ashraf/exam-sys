import { useState } from "react";
import { Icon } from "../components/Icon";
import { api } from "../services/api";
import { reconnectSocket } from "../services/socket";

interface AdminLoginProps {
  onLogin: () => void;
  onBack: () => void;
}

function AdminLogin({ onLogin, onBack }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMsg("");

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setLoading(true);

    // The server is the only authority. There is deliberately no local
    // credential check here: the previous one hardcoded the real admin
    // password into the bundle and minted a "dev_admin_session" token that
    // the dashboard accepted.
    const res = await api.loginAdmin({ username: cleanUsername, password });
    setLoading(false);

    if (res.success && res.token) {
      sessionStorage.setItem("adminToken", res.token);
      // Re-handshake so this socket joins the server's `admins` room.
      reconnectSocket();
      onLogin();
      return;
    }

    setErrorMsg(res.error || "Invalid administrator credentials. Access denied.");
  }

  return (
    <main className="page-container">
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          className="company-logo-badge"
          style={{
            height: "60px",
            padding: "8px 18px",
            margin: "0 auto 16px auto",
            borderRadius: "12px",
          }}
          title="Mofarreh Group — Engineering & Construction"
        >
          <img
            src="/mofarreh-logo.png"
            alt="Mofarreh Group Logo"
            style={{ height: "46px", width: "auto" }}
          />
        </div>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <Icon name="shield" /> Administrator Portal
        </h1>
        <p className="page-description">
          Mofarreh Group Management • Restricted authorized access only.
        </p>
      </div>

      <div className="card form-card">
        {errorMsg && (
          <div
            style={{
              padding: "12px 14px",
              background: "var(--danger-soft)",
              border: "1px solid var(--danger-border)",
              borderRadius: "8px",
              color: "var(--danger)",
              fontSize: "13px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="alert-triangle" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Administrator Username</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. mofarreh.admin"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                className="form-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                autoComplete="current-password"
                style={{ paddingRight: "40px", width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#64748b",
                  padding: "4px",
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <Icon name="eye-off" label="Hide password" /> : <Icon name="eye" label="Show password" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="primary-button"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            disabled={loading}
          >
            {loading ? "Verifying Credentials..." : <><Icon name="lock" /> Secure Sign In →</>}
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
          ← Exit to Candidate Portal
        </button>
      </div>
    </main>
  );
}

export default AdminLogin;