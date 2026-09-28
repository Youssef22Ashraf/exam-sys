import { useState } from "react";
import { Icon } from "../components/Icon";
import { api } from "../services/api";
import "./LecturesLogin.css";

export interface LectureUserData {
  name: string;
  email: string;
  companyId: string;
  department: string;
  attendanceId?: string;
}

interface LecturesLoginProps {
  onLoginSuccess: (user: LectureUserData) => void;
  onBack: () => void;
}

const DEPARTMENTS = [
  "Engineering",
  "Construction",
  "Project Controls",
  "Interface Management",
  "Logistics & Site Services",
  "Quality Assurance & QC",
  "HSE & Occupational Safety",
  "Procurement & Contracts",
  "Operations & Maintenance",
  "Site Management & Supervision",
  "Project Management Office (PMO)",
  "Commercial & Estimation",
  "Executive & General Management",
  "Other / Contractor",
];

export default function LecturesLogin({ onLoginSuccess, onBack }: LecturesLoginProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(val: string): boolean {
    const trimmed = val.trim().toLowerCase();
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(trimmed)) return false;
    const parts = trimmed.split("@");
    return parts.length === 2 && parts[1].includes(".") && !parts[1].startsWith(".") && !parts[1].endsWith(".");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCompanyId = companyId.trim().toUpperCase();
    const finalDepartment = department.trim();

    if (!trimmedName || !trimmedEmail || !trimmedCompanyId || !finalDepartment) {
      setError("Please fill in all required fields (Name, Corporate Email, Company ID, and Department).");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError("Please provide a valid corporate email address (e.g. employee@mofarreh.com).");
      return;
    }

    setLoading(true);
    try {
      const res = await api.recordLectureAccess({
        name: trimmedName,
        email: trimmedEmail,
        companyId: trimmedCompanyId,
        department: finalDepartment,
        action: "PORTAL_ACCESS",
      });

      if (!res.success) {
        setError(res.error || "Failed to register access. Please try again.");
        setLoading(false);
        return;
      }

      onLoginSuccess({
        name: trimmedName,
        email: trimmedEmail,
        companyId: trimmedCompanyId,
        department: finalDepartment,
        attendanceId: res.attendanceId,
      });
    } catch (err: unknown) {
      console.warn("Could not register access:", err);
      // Still allow entry if offline
      onLoginSuccess({
        name: trimmedName,
        email: trimmedEmail,
        companyId: trimmedCompanyId,
        department: finalDepartment,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-container lectures-login-container">
      <div className="lectures-login-card">
        <div className="login-header-badge">
          <Icon name="book" size={16} />
          <span>E&C TRAINING & LEARNING HUB</span>
        </div>

        <h2>Access Procedure Briefings & Lectures</h2>
        <p className="login-subtitle">
          Please provide your identification and department to access the official procedure videos,
          comparative analysis briefings, and slide presentations.
        </p>

        {error && (
          <div className="login-error-alert" role="alert">
            <Icon name="alert-triangle" size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="lectures-form">
          <div className="form-group">
            <label htmlFor="lec-name">
              Full Name <span className="req">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon"><Icon name="user" /></span>
              <input
                id="lec-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Eng. Ahmed Hassan"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="lec-email">
              Corporate / Work Email <span className="req">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon"><Icon name="mail" /></span>
              <input
                id="lec-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. ahmed.hassan@mofarreh.com"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="lec-company-id">
                Company / Badge ID <span className="req">*</span>
              </label>
              <div className="input-with-icon">
                <span className="input-icon"><Icon name="shield" /></span>
                <input
                  id="lec-company-id"
                  type="text"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. EMP-1042"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="lec-department">
                Department / Sector <span className="req">*</span>
              </label>
              <div className="input-with-icon">
                <span className="input-icon"><Icon name="users" /></span>
                <input
                  id="lec-department"
                  type="text"
                  list="lec-dept-datalist"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Type or choose your department"
                  required
                />
                <datalist id="lec-dept-datalist">
                  {DEPARTMENTS.filter((d) => d !== "Other / Contractor").map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>
              <div className="dept-quick-chips">
                <span className="chips-label">Quick select:</span>
                {["Interface Management", "Engineering", "Construction", "Project Controls", "Quality Assurance", "HSE", "Procurement"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`dept-chip-btn ${department === chip ? "active" : ""}`}
                    onClick={() => setDepartment(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onBack}
              disabled={loading}
            >
              ← Back to Home
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Enter Learning Portal →"}
            </button>
          </div>
        </form>

        <div className="login-security-notice">
          <Icon name="lock" size={14} />
          <span>Attendance and lecture viewing duration are audited for compliance records.</span>
        </div>
      </div>
    </main>
  );
}
