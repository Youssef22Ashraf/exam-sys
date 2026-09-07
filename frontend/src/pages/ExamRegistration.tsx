import { useState } from "react";
import { Icon } from "../components/Icon";
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
  const [formError, setFormError] = useState<string | null>(null);
  const [emailFormatError, setEmailFormatError] = useState<string | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<{
    eligible: boolean;
    error?: string;
    message?: string;
    remainingHours?: number;
    nextAttemptAvailableAt?: string;
  } | null>(null);

  function validateEmailFormat(val: string): boolean {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setEmailFormatError(null);
      return false;
    }
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(trimmed)) {
      setEmailFormatError(
        "Please enter a valid email address (e.g. employee@gmail.com, candidate@outlook.com, or company email)."
      );
      return false;
    }
    const parts = trimmed.split("@");
    if (parts.length !== 2 || !parts[1].includes(".") || parts[1].startsWith(".") || parts[1].endsWith(".")) {
      setEmailFormatError("Email domain is incomplete or invalid.");
      return false;
    }
    setEmailFormatError(null);
    return true;
  }

  function handleFieldChange(setter: (val: string) => void, val: string) {
    setter(val);
    if (formError) setFormError(null);
    if (cooldownInfo) setCooldownInfo(null);
  }

  async function handleContinue() {
    setFormError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCompanyId = companyId.trim();

    if (!trimmedName || !trimmedEmail || !trimmedCompanyId) {
      setFormError("Please fill in all fields (Full Name, Email Address, and Company ID).");
      return;
    }

    if (!validateEmailFormat(trimmedEmail)) {
      setFormError("Please enter a valid email address before proceeding.");
      return;
    }

    setIsChecking(true);
    try {
      const cooldown = await api.checkCandidateCooldown(trimmedEmail, trimmedCompanyId, trimmedName);
      if (!cooldown.eligible) {
        setCooldownInfo(cooldown);
        if (cooldown.error === "IDENTITY_CONFLICT" || cooldown.error === "INVALID_EMAIL") {
          setFormError(cooldown.message || "Identity conflict detected. Please verify your registered details.");
        }
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
            height: "56px",
            padding: "6px 16px",
            margin: "0 auto 14px auto",
            borderRadius: "10px",
          }}
          title="Mofarreh Group — Engineering & Construction"
        >
          <img
            src="/mofarreh-logo.png"
            alt="Mofarreh Group Logo"
            style={{ height: "42px", width: "auto" }}
          />
        </div>
        <h1 className="page-title">Candidate Registration</h1>
        <p className="page-description">
          Mofarreh Group Assessment • Enter your employee details before starting.
        </p>
      </div>

      <div className="card form-card">
        {formError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #f87171",
              borderRadius: "10px",
              padding: "14px 16px",
              marginBottom: "18px",
              color: "#991b1b",
              fontSize: "13px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              lineHeight: "1.4",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "18px" }}><Icon name="alert-triangle" /></span>
            <div>
              <strong style={{ display: "block", marginBottom: "2px" }}>
                Identity & Registration Notice:
              </strong>
              <span>{formError}</span>
            </div>
          </div>
        )}

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
              <span style={{ fontSize: "18px" }}><Icon name="ban" /></span> 48-Hour Re-attempt Cooldown Active
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
                <Icon name="clock" /> <strong>Remaining lockout:</strong> Approx.{" "}
                {cooldownInfo.remainingHours ?? 48} hour(s)
              </div>
              {cooldownInfo.nextAttemptAvailableAt && (
                <div style={{ marginTop: "4px" }}>
                  <Icon name="calendar" /> <strong>Next eligible attempt:</strong>{" "}
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
            placeholder="Enter your full legal name"
            value={name}
            onChange={(event) => handleFieldChange(setName, event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            className="form-input"
            type="email"
            placeholder="e.g. employee@gmail.com, candidate@outlook.com"
            value={email}
            onChange={(event) => {
              handleFieldChange(setEmail, event.target.value);
              if (emailFormatError) validateEmailFormat(event.target.value);
            }}
            onBlur={(event) => validateEmailFormat(event.target.value)}
            style={{
              borderColor: emailFormatError ? "#ef4444" : undefined,
            }}
          />
          {emailFormatError ? (
            <span style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px", display: "block" }}>
              <Icon name="alert-triangle" /> {emailFormatError}
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              Accepted: Google (@gmail.com), Microsoft/Outlook (@outlook.com, @hotmail.com), or company email.
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Company ID</label>
          <input
            className="form-input"
            type="text"
            placeholder="Enter your unique company / employee ID"
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
            ? "Verifying Cooldown & Identity..."
            : cooldownInfo && !cooldownInfo.eligible
            ? <><Icon name="ban" /> Re-attempt Locked (48h Policy)</>
            : "Continue to Instructions →"}
        </button>
      </div>
    </main>
  );
}

export default ExamRegistration;