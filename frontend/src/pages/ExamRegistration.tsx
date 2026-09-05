interface ExamRegistrationProps {
    onContinue: (userData: {
      name: string;
      email: string;
      companyId: string;
    }) => void;
  }
  
  import { useState } from "react";
  
  function ExamRegistration({
    onContinue,
  }: ExamRegistrationProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [companyId, setCompanyId] = useState("");
  
    function handleContinue() {
      if (!name || !email || !companyId) {
        alert("Please fill in all fields.");
        return;
      }
  
      onContinue({
        name,
        email,
        companyId,
      });
    }
  
    return (
      <main className="page-container">
        <div style={{ textAlign: "center" }}>
          <h1 className="page-title">
            Candidate Registration
          </h1>
  
          <p className="page-description">
            Enter your information before starting the
            examination.
          </p>
        </div>
  
        <div className="card form-card">
          <div className="form-group">
            <label className="form-label">
              Full Name
            </label>
  
            <input
              className="form-input"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
            />
          </div>
  
          <div className="form-group">
            <label className="form-label">
              Email Address
            </label>
  
            <input
              className="form-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
            />
          </div>
  
          <div className="form-group">
            <label className="form-label">
              Company ID
            </label>
  
            <input
              className="form-input"
              type="text"
              placeholder="Enter your company ID"
              value={companyId}
              onChange={(event) =>
                setCompanyId(event.target.value)
              }
            />
          </div>
  
          <button
            className="primary-button"
            style={{ width: "100%" }}
            onClick={handleContinue}
          >
            Continue to Instructions →
          </button>
        </div>
      </main>
    );
  }
  
  export default ExamRegistration;