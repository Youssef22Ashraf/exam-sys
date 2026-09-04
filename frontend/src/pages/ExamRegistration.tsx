import { useState } from "react";

interface ExamRegistrationprops {
  onContinue: (userData: {
    name: string;
    email: string;
    companyId: string;
  }) => void;
}

function ExamRegistration({ onContinue }: ExamRegistrationprops) {
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
    <div>
      <h1>Take Exam</h1>

      <div>
        <label>Name</label>
        <br />
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Email</label>
        <br />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <br />

      <div>
        <label>Company ID</label>
        <br />
        <input
          type="text"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        />
      </div>

      <br />

      <button onClick={handleContinue}>
        Continue
      </button>
    </div>
  );
}

export default ExamRegistration;