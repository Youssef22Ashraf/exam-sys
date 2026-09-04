import { useEffect, useState } from "react";
import "./Exam.css";
interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

const partA: Question[] = [
  {
    id: 1,
    question: "What is an Interface Point (IP)?",
    options: [
      "A. A location, activity, or information flow where two or more parties, systems, or scopes meet and require coordination",
      "B. A financial approval between departments",
      "C. A document issued only by the Client",
      "D. A construction delay report",
    ],
    correctAnswer: 0,
  },
  {
    id: 2,
    question: "What is the main purpose of the Interface Register?",
    options: [
      "A. Record employee attendance",
      "B. Record, track, and monitor interface points",
      "C. Record only contractual claims",
      "D. Monitor procurement costs",
    ],
    correctAnswer: 1,
  },
  {
    id: 3,
    question:
      "Who is primarily responsible for developing and maintaining the Interface Register?",
    options: [
      "A. Planning Engineer",
      "B. HSE Engineer",
      "C. Interface Manager",
      "D. Procurement Department",
    ],
    correctAnswer: 2,
  },
  {
    id: 4,
    question: "Interface points are categorized as:",
    options: [
      "A. Design and Construction",
      "B. Critical and Non-Critical",
      "C. Open and Closed only",
      "D. Internal and External",
    ],
    correctAnswer: 3,
  },
  {
    id: 5,
    question: "When should general interface points be identified?",
    options: [
      "A. During project initiation and design coordination stages",
      "B. Only during construction",
      "C. After a conflict occurs",
      "D. Only during handover",
    ],
    correctAnswer: 0,
  },
  {
    id: 6,
    question:
      "How frequently are regular Interface Coordination Meetings conducted according to the procedure?",
    options: [
      "A. Daily",
      "B. Weekly or bi-weekly",
      "C. Quarterly",
      "D. Annually",
    ],
    correctAnswer: 1,
  },
  {
    id: 7,
    question:
      "How far in advance should an Internal Interface Coordination Meeting call normally be issued?",
    options: [
      "A. 24 hours",
      "B. 72 hours",
      "C. At least 48 hours",
      "D. One week",
    ],
    correctAnswer: 2,
  },
  {
    id: 8,
    question:
      "How far in advance should an External Interface Coordination Meeting invitation normally be issued?",
    options: [
      "A. 24 hours",
      "B. 48 hours",
      "C. Two weeks",
      "D. At least 72 hours",
    ],
    correctAnswer: 3,
  },
  {
    id: 9,
    question:
      "True or False: An interface point can be closed before all involved parties verify and sign off on it.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 10,
    question:
      "Where should interface closure evidence be uploaded according to the procedure?",
    options: [
      "A. Aconex",
      "B. Personal email",
      "C. SharePoint only",
      "D. Procurement system",
    ],
    correctAnswer: 0,
  },
  {
    id: 11,
    question:
      "Who coordinates authority representatives’ attendance/access and ensures authorization letters are valid for External Interface Meetings?",
    options: [
      "A. QA/QC Manager",
      "B. Government Relations Officer (GRO)",
      "C. Planning Engineer",
      "D. Procurement Manager",
    ],
    correctAnswer: 1,
  },
  {
    id: 12,
    question: "Which of the following is an External Interface Point?",
    options: [
      "A. Coordination between Civil and Structural teams",
      "B. Coordination between Planning and Construction",
      "C. Coordination with an authority for permits and NOCs",
      "D. Internal document revision control",
    ],
    correctAnswer: 2,
  },
  {
    id: 13,
    question:
      "Who should approve major interface decisions that impact cost, schedule, or scope?",
    options: [
      "A. Surveyor",
      "B. Document Controller",
      "C. Interface Engineer alone",
      "D. Client / Employer",
    ],
    correctAnswer: 3,
  },
  {
    id: 14,
    question: "What is the primary purpose of the Interface Matrix?",
    options: [
      "A. Define who interfaces with whom, on what scope, and where coordination boundaries exist",
      "B. Record NCRs",
      "C. Record employee responsibilities only",
      "D. Record contractual payments",
    ],
    correctAnswer: 0,
  },
  {
    id: 15,
    question:
      "What is the primary purpose of the Interface Points Register?",
    options: [
      "A. Define company organization",
      "B. Monitor individual coordination points and their progress",
      "C. Record only escalated claims",
      "D. Replace meeting minutes",
    ],
    correctAnswer: 1,
  },
  {
    id: 16,
    question:
      "What is the primary purpose of the Interface Issue Log?",
    options: [
      "A. Record all employee activities",
      "B. Track material delivery",
      "C. Record and manage interface conflicts/issues that have escalated from coordination points",
      "D. Replace the Interface Matrix",
    ],
    correctAnswer: 2,
  },
  {
    id: 17,
    question:
      "True or False: Escalation should replace normal coordination whenever an interface issue is identified.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 18,
    question:
      "True or False: Safety-related interface issues may be escalated immediately regardless of the normal hierarchy.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 19,
    question:
      "Within what period should the Interface Manager issue the Minutes of Meeting (MoM) after an Interface Meeting?",
    options: [
      "A. 24 hours",
      "B. 5 working days",
      "C. 7 working days",
      "D. 48 hours",
    ],
    correctAnswer: 3,
  },
  {
    id: 20,
    question: "How long should Interface Management records be retained?",
    options: [
      "A. As per project contract terms or project duration + 1 year",
      "B. Six months",
      "C. One year only",
      "D. Five years",
    ],
    correctAnswer: 0,
  },
  {
    id: 21,
    question:
      "All interface points should have a defined owner and target resolution date.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 22,
    question:
      "An unresolved interface point may remain open beyond its target date without formal escalation.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 23,
    question:
      "The Interface Matrix should be updated whenever new scopes or packages are added.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
];

const partB: Question[] = [
  {
    id: 24,
    question: "What is the purpose of the Power–Interest Matrix?",
    options: [
      "A. Evaluate project costs",
      "B. Categorize stakeholders to determine communication and engagement priority",
      "C. Prioritize construction activities",
      "D. Evaluate subcontractor payments",
    ],
    correctAnswer: 1,
  },
  {
    id: 25,
    question:
      "A stakeholder with High Power and High Interest should be categorized as:",
    options: [
      "A. Monitor",
      "B. Keep Informed",
      "C. Manage Closely",
      "D. Keep Satisfied",
    ],
    correctAnswer: 2,
  },
  {
    id: 26,
    question:
      "A stakeholder with High Power and Low Interest should be categorized as:",
    options: [
      "A. Manage Closely",
      "B. Keep Informed",
      "C. Monitor",
      "D. Keep Satisfied",
    ],
    correctAnswer: 3,
  },
  {
    id: 27,
    question:
      "A stakeholder with Low Power and High Interest should be categorized as:",
    options: [
      "A. Keep Informed",
      "B. Monitor",
      "C. Keep Satisfied",
      "D. Manage Closely",
    ],
    correctAnswer: 0,
  },
  {
    id: 28,
    question:
      "True or False: The Stakeholder Register should be reviewed and updated regularly to include new stakeholders or remove inactive stakeholders.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 29,
    question:
      "Which information should the Communication and Engagement Plan define for each stakeholder?",
    options: [
      "A. Salary and employee number",
      "B. Communication method, frequency, responsible person, and type of information to be shared",
      "C. Only meeting dates",
      "D. Only stakeholder contact information",
    ],
    correctAnswer: 1,
  },
  {
    id: 30,
    question:
      "Who is responsible for leading the preparation, implementation, and maintenance of the Stakeholder Management Plan and Stakeholder Register?",
    options: [
      "A. Interface Manager",
      "B. Project Manager",
      "C. Stakeholder Manager",
      "D. Planning Engineer",
    ],
    correctAnswer: 2,
  },
  {
    id: 31,
    question:
      "If a stakeholder conflict cannot be resolved at Project Level, what is the next escalation level stated in the procedure?",
    options: [
      "A. Legal Level",
      "B. Procurement Level",
      "C. HSE Level",
      "D. Sector Level",
    ],
    correctAnswer: 3,
  },
  {
    id: 32,
    question:
      "True or False: A stakeholder commitment that exceeds the project team’s delegated authority can be confirmed first and approved later.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 33,
    question:
      "How frequently should Stakeholder KPIs be evaluated according to the procedure?",
    options: [
      "A. Monthly",
      "B. Weekly",
      "C. Quarterly",
      "D. Annually",
    ],
    correctAnswer: 0,
  },
  {
    id: 34,
    question:
      "The Power–Interest Matrix should be reviewed periodically or whenever major project or stakeholder changes occur.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 35,
    question:
      "Stakeholder communication should use the same frequency and method for every stakeholder regardless of influence or interest.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 36,
    question:
      "All stakeholder communications, feedback, and meeting outcomes should be formally recorded.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 37,
    question:
      "An overdue stakeholder item should be escalated to the Project Manager and PMC.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 38,
    question:
      "Stakeholder commitments beyond delegated authority may be accepted without escalation if the stakeholder has high influence.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
  {
    id: 39,
    question:
      "Stakeholder awareness and collaboration sessions should include records of the agenda, attendees, and outcomes.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 0,
  },
  {
    id: 40,
    question:
      "Stakeholder KPI results should only be reviewed at the end of the project.",
    options: [
      "A. True",
      "B. False",
    ],
    correctAnswer: 1,
  },
];

const questions = [...partA, ...partB];

function Exam() {
    const EXAM_DURATION = 30 * 60;
  
    const [currentQuestion, setCurrentQuestion] = useState(0);
  
    const [selectedAnswers, setSelectedAnswers] = useState<
      Record<number, number>
    >({});
  
    const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  
    const [submitted, setSubmitted] = useState(false);
  
    const question = questions[currentQuestion];
  
    const answeredCount = Object.keys(selectedAnswers).length;
  
    const progress =
      ((currentQuestion + 1) / questions.length) * 100;
  
    function selectAnswer(answerIndex: number) {
      setSelectedAnswers({
        ...selectedAnswers,
        [question.id]: answerIndex,
      });
    }
  
    function goToQuestion(index: number) {
      setCurrentQuestion(index);
    }
  
    function nextQuestion() {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    }
  
    function previousQuestion() {
      if (currentQuestion > 0) {
        setCurrentQuestion(currentQuestion - 1);
      }
    }
  
    function calculateScore() {
      let score = 0;
  
      questions.forEach((question) => {
        if (
          selectedAnswers[question.id] ===
          question.correctAnswer
        ) {
          score++;
        }
      });
  
      return score;
    }
  
    function submitExam() {
      if (submitted) {
        return;
      }
  
      const score = calculateScore();
  
      setSubmitted(true);
  
      alert(
        `Exam submitted!\n\nScore: ${score}/${questions.length}`
      );
    }
  
    function confirmSubmit() {
      const unanswered =
        questions.length - answeredCount;
  
      if (unanswered > 0) {
        const confirmSubmission = window.confirm(
          `You have ${unanswered} unanswered question${
            unanswered === 1 ? "" : "s"
          }.\n\nAre you sure you want to submit the exam?`
        );
  
        if (confirmSubmission) {
          submitExam();
        }
  
        return;
      }
  
      const confirmSubmission = window.confirm(
        "You have answered all questions.\n\nAre you sure you want to submit the exam?"
      );
  
      if (confirmSubmission) {
        submitExam();
      }
    }
  
    useEffect(() => {
      if (submitted) {
        return;
      }
  
      if (timeLeft <= 0) {
        submitExam();
        return;
      }
  
      const timer = setInterval(() => {
        setTimeLeft((previousTime) => previousTime - 1);
      }, 1000);
  
      return () => clearInterval(timer);
    }, [timeLeft, submitted]);
  
    function formatTime(seconds: number) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
  
      return `${String(minutes).padStart(2, "0")}:${String(
        remainingSeconds
      ).padStart(2, "0")}`;
    }
  
    const isLowTime = timeLeft <= 5 * 60;
  
    const isLastQuestion =
      currentQuestion === questions.length - 1;
  
    const currentPart =
      currentQuestion < partA.length
        ? "Part A — Interface Management"
        : "Part B — Stakeholder Management";
  
    return (
      <div className="exam-page">
        {/* Header */}
        <header className="exam-header">
          <div>
            <h1>Examination</h1>
            <p>Workplace Assessment System</p>
          </div>
  
          <div
            className={`timer ${
              isLowTime ? "timer-warning" : ""
            }`}
          >
            <span>Time Remaining</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
        </header>
  
        {/* Progress */}
        <div className="progress-section">
          <div className="progress-info">
            <span>
              Question {currentQuestion + 1} of{" "}
              {questions.length}
            </span>
  
            <span>
              {answeredCount}/{questions.length} answered
            </span>
          </div>
  
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
  
        <div className="exam-layout">
          {/* Question Navigator */}
          <aside className="question-sidebar">
            <h3>Questions</h3>
  
            <div className="legend">
              <div>
                <span className="legend-box current" />
                Current
              </div>
  
              <div>
                <span className="legend-box answered" />
                Answered
              </div>
  
              <div>
                <span className="legend-box unanswered" />
                Unanswered
              </div>
            </div>
  
            <h4>Part A</h4>
  
            <div className="question-grid">
              {partA.map((item, index) => (
                <button
                  key={item.id}
                  className={`
                    question-number
                    ${
                      currentQuestion === index
                        ? "current"
                        : ""
                    }
                    ${
                      selectedAnswers[item.id] !== undefined
                        ? "answered"
                        : ""
                    }
                  `}
                  onClick={() => goToQuestion(index)}
                >
                  {item.id}
                </button>
              ))}
            </div>
  
            <h4>Part B</h4>
  
            <div className="question-grid">
              {partB.map((item) => {
                const index = questions.findIndex(
                  (q) => q.id === item.id
                );
  
                return (
                  <button
                    key={item.id}
                    className={`
                      question-number
                      ${
                        currentQuestion === index
                          ? "current"
                          : ""
                      }
                      ${
                        selectedAnswers[item.id] !== undefined
                          ? "answered"
                          : ""
                      }
                    `}
                    onClick={() => goToQuestion(index)}
                  >
                    {item.id}
                  </button>
                );
              })}
            </div>
          </aside>
  
          {/* Main Question */}
          <main className="question-area">
            <div className="section-badge">
              {currentPart}
            </div>
  
            <div className="question-card">
              <div className="question-top">
                <span>Question {question.id}</span>
  
                {selectedAnswers[question.id] !==
                  undefined && (
                  <span className="answered-label">
                    ✓ Answered
                  </span>
                )}
              </div>
  
              <h2>{question.question}</h2>
  
              <div className="answers">
                {question.options.map((option, index) => {
                  const selected =
                    selectedAnswers[question.id] === index;
  
                  return (
                    <label
                      key={index}
                      className={`answer-option ${
                        selected ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={selected}
                        onChange={() =>
                          selectAnswer(index)
                        }
                      />
  
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>
  
            {/* Navigation */}
            <div className="navigation">
              <button
                className="nav-button secondary"
                onClick={previousQuestion}
                disabled={currentQuestion === 0}
              >
                ← Previous
              </button>
  
              {!isLastQuestion ? (
                <button
                  className="nav-button primary"
                  onClick={nextQuestion}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="nav-button submit"
                  onClick={confirmSubmit}
                >
                  Submit Exam
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }
  
  export default Exam;