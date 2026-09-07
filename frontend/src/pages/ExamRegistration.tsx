import { useState } from "react";
import { api } from "../services/api";

interface ExamRegistrationProps {
  onContinue: (userData: {
    name: string;
    email: string;
    companyId: string;
  }) => void;
}

function ExamRegistration({ onContinue }: ExamRegistrationProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<{
    eligible: boolean;
    message?: string;
    remainingHours?: number;
    nextAttemptAvailableAt?: string;
  } | null>(null);

  function handleFieldChange(setter: (val: string) => void, val: string) {
    setter(val);
    if (cooldownInfo) {
      setCooldownInfo(null);
    }
  }

  async function handleContinue() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCompanyId = companyId.trim();

    if (!trimmedName || !trimmedEmail || !trimmedCompanyId) {
      alert("Please fill in all fields.");
      return;
    }

    setIsChecking(true);
    try {
      const cooldown = await api.checkCandidateCooldown(trimmedEmail, trimmedCompanyId);
      if (!cooldown.eligible) {
        setCooldownInfo(cooldown);
        setIsChecking(false);
        return;
      }
    } catch (err) {
      console.warn("Could not check cooldown:", err);
    } finally {
      setIsChecking(false);
    }

    onContinue({
      name: trimmedName,
      email: trimmedEmail,
      companyId: trimmedCompanyId,
    });
  }

  return (
    <main className="page-container">
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div
          className="company-logo-badge"
          style={{
            height: "52px",
            padding: "6px 16px",
            margin: "0 auto 14px auto",
            borderRadius: "10px",
          }}
          title="Combined Group Contracting Company"
        >
          <img
            src="/Group-252.webp"
            alt="Combined Group Logo"
            style={{ height: "38px", width: "auto" }}
          />
        </div>
        <h1 className="page-title">Candidate Registration</h1>
        <p className="page-description">
          Combined Group Assessment • Enter your employee details before starting.
        </p>
      </div>

      <div className="card form-card">
        {cooldownInfo && !cooldownInfo.eligible && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              color: "#92400e",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "14px",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "18px" }}>⛔</span> 48-Hour Re-attempt Cooldown Active
            </div>
            <p style={{ margin: "0 0 10px 0", fontSize: "13px", lineHeight: "1.5" }}>
              {cooldownInfo.message ||
                "You have already completed an attempt within the last 48 hours. Per workplace assessment policy, re-attempts are only permitted after 48 hours."}
            </p>
            <div
              style={{
                fontSize: "12px",
                background: "rgba(245, 158, 11, 0.15)",
                padding: "8px 12px",
                borderRadius: "6px",
              }}
            >
              <div>
                ⏱️ <strong>Remaining lockout:</strong> Approx.{" "}
                {cooldownInfo.remainingHours ?? 48} hour(s)
              </div>
              {cooldownInfo.nextAttemptAvailableAt && (
                <div style={{ marginTop: "4px" }}>
                  📅 <strong>Next eligible attempt:</strong>{" "}
                  {new Date(cooldownInfo.nextAttemptAvailableAt).toLocaleString()}
                </div>
              )}
            </div>
            <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "#b45309" }}>
              If you require an early retest or an exception has been authorized, please contact your examination administrator.
            </p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            className="form-input"
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => handleFieldChange(setName, event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => handleFieldChange(setEmail, event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Company ID</label>
          <input
            className="form-input"
            type="text"
            placeholder="Enter your company ID"
            value={companyId}
            onChange={(event) => handleFieldChange(setCompanyId, event.target.value)}
          />
        </div>

        <button
          className="primary-button"
          style={{
            width: "100%",
            cursor: isChecking || (cooldownInfo && !cooldownInfo.eligible) ? "not-allowed" : "pointer",
            opacity: isChecking || (cooldownInfo && !cooldownInfo.eligible) ? 0.7 : 1,
          }}
          onClick={handleContinue}
          disabled={isChecking || (cooldownInfo !== null && !cooldownInfo.eligible)}
        >
          {isChecking
            ? "Verifying Cooldown Eligibility..."
            : cooldownInfo && !cooldownInfo.eligible
            ? "⛔ Re-attempt Locked (48h Policy)"
            : "Continue to Instructions →"}
        </button>
      </div>
    </main>
  );
}

export default ExamRegistration;