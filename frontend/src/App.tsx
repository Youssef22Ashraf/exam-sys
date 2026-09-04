import { useState } from "react";
import ExamRegistration from "./pages/ExamRegistration";
import ExamInstructions from "./pages/ExamInstructions";
import Exam from "./pages/Exam";

interface UserData {
  name: string;
  email: string;
  companyId: string;
}

function App() {
  const [page, setPage] = useState("home");
  const [userData, setUserData] = useState<UserData | null>(null);

  function startExam() {
    setPage("registration");
  }

  function openAdmin() {
    alert("Admin page coming soon!");
  }

  function handleRegistration(data: UserData) {
    setUserData(data);
    setPage("instructions");
  }

  function beginExam() {
    console.log("Exam started for:", userData);
    setPage("exam");
  }
  
  if (page === "exam") {
    return <Exam />;
  }
  
  if (page === "registration") {
    return (
      <ExamRegistration
        onContinue={handleRegistration}
      />
    );
  }

  if (page === "instructions") {
    return (
      <ExamInstructions
        onStart={beginExam}
      />
    );
  }

  return (
    <div>
      <h1>EXAM SYSTEM</h1>

      <p>Welcome to the Exam Portal</p>

      <button onClick={startExam}>
        Take an Exam
      </button>

      <button onClick={openAdmin}>
        Admin
      </button>
    </div>
  );
}

export default App;