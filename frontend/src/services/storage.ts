export interface Question {
  id: number;
  section: "A" | "B";
  sectionTitle: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  companyId: string;
  registeredAt: string;
  status: "Registered" | "In Progress" | "Completed";
  totalAttempts: number;
  highestScore?: number;
  latestScore?: number;
}

export interface ExamResult {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  companyId: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  timeSpentSeconds: number;
  partAScore: number;
  partATotal: number;
  partBScore: number;
  partBTotal: number;
  answers: Record<number, number>; // questionId -> selectedOptionIndex
  tabSwitches?: number;
  proctoringStatus?: "Verified" | "Warnings" | "Camera Disabled";
  candidatePhoto?: string;
  hasVideoRecording?: boolean;
}

export interface ExamSettings {
  examTitle: string;
  durationMinutes: number;
  passingPercentage: number;
  sectorBadge: string;
  allowReviewAnswers: boolean;
}

const DEFAULT_SETTINGS: ExamSettings = {
  examTitle: "Workplace Assessment System",
  durationMinutes: 30,
  passingPercentage: 70,
  sectorBadge: "Engineering & Construction Sector",
  allowReviewAnswers: true,
};

export const INITIAL_QUESTIONS: Question[] = [
  // Part A — Interface Management (1 to 23)
  {
    id: 1,
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Who is primarily responsible for developing and maintaining the Interface Register?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "How frequently are regular Interface Coordination Meetings conducted according to the procedure?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "How far in advance should an Internal Interface Coordination Meeting call normally be issued?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "How far in advance should an External Interface Coordination Meeting invitation normally be issued?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "True or False: An interface point can be closed before all involved parties verify and sign off on it.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 10,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Where should interface closure evidence be uploaded according to the procedure?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Who coordinates authority representatives’ attendance/access and ensures authorization letters are valid for External Interface Meetings?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Who should approve major interface decisions that impact cost, schedule, or scope?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is the primary purpose of the Interface Points Register?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is the primary purpose of the Interface Issue Log?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "True or False: Escalation should replace normal coordination whenever an interface issue is identified.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 18,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "True or False: Safety-related interface issues may be escalated immediately regardless of the normal hierarchy.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 19,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Within what period should the Interface Manager issue the Minutes of Meeting (MoM) after an Interface Meeting?",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
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
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "All interface points should have a defined owner and target resolution date.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 22,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "An unresolved interface point may remain open beyond its target date without formal escalation.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 23,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "The Interface Matrix should be updated whenever new scopes or packages are added.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },

  // Part B — Stakeholder Management (24 to 40)
  {
    id: 24,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "A stakeholder with High Power and High Interest should be categorized as:",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "A stakeholder with High Power and Low Interest should be categorized as:",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "A stakeholder with Low Power and High Interest should be categorized as:",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "True or False: The Stakeholder Register should be reviewed and updated regularly to include new stakeholders or remove inactive stakeholders.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 29,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Which information should the Communication and Engagement Plan define for each stakeholder?",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Who is responsible for leading the preparation, implementation, and maintenance of the Stakeholder Management Plan and Stakeholder Register?",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "If a stakeholder conflict cannot be resolved at Project Level, what is the next escalation level stated in the procedure?",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "True or False: A stakeholder commitment that exceeds the project team’s delegated authority can be confirmed first and approved later.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 33,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "How frequently should Stakeholder KPIs be evaluated according to the procedure?",
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
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "The Power–Interest Matrix should be reviewed periodically or whenever major project or stakeholder changes occur.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 35,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder communication should use the same frequency and method for every stakeholder regardless of influence or interest.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 36,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "All stakeholder communications, feedback, and meeting outcomes should be formally recorded.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 37,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "An overdue stakeholder item should be escalated to the Project Manager and PMC.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 38,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder commitments beyond delegated authority may be accepted without escalation if the stakeholder has high influence.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
  {
    id: 39,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder awareness and collaboration sessions should include records of the agenda, attendees, and outcomes.",
    options: ["A. True", "B. False"],
    correctAnswer: 0,
  },
  {
    id: 40,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder KPI results should only be reviewed at the end of the project.",
    options: ["A. True", "B. False"],
    correctAnswer: 1,
  },
];

const SEED_CANDIDATES: Candidate[] = [
  {
    id: "cand-1",
    name: "Ahmed Ashraf Youssef",
    email: "ahmed.youssef@harbico.com",
    companyId: "9353",
    registeredAt: "2026-09-02T11:20:00.000Z",
    status: "Completed",
    totalAttempts: 1,
    highestScore: 36,
    latestScore: 36,
  },
  {
    id: "cand-2",
    name: "Sarah M. Jenkins",
    email: "sarah.jenkins@al-bayan.com",
    companyId: "8412",
    registeredAt: "2026-09-03T09:15:00.000Z",
    status: "Completed",
    totalAttempts: 1,
    highestScore: 31,
    latestScore: 31,
  },
  {
    id: "cand-3",
    name: "Omar Tariq Al-Mansoor",
    email: "omar.mansoor@harbico.com",
    companyId: "9104",
    registeredAt: "2026-09-03T14:40:00.000Z",
    status: "Completed",
    totalAttempts: 1,
    highestScore: 24,
    latestScore: 24,
  },
  {
    id: "cand-4",
    name: "Khaled Nasser",
    email: "khaled.nasser@apexbuild.com",
    companyId: "7720",
    registeredAt: "2026-09-04T08:30:00.000Z",
    status: "Registered",
    totalAttempts: 0,
  },
];

const SEED_RESULTS: ExamResult[] = [
  {
    id: "res-1",
    candidateId: "cand-1",
    candidateName: "Ahmed Ashraf Youssef",
    candidateEmail: "ahmed.youssef@harbico.com",
    companyId: "9353",
    submittedAt: "2026-09-02T11:48:30.000Z",
    score: 36,
    totalQuestions: 40,
    percentage: 90.0,
    isPassed: true,
    timeSpentSeconds: 1710,
    partAScore: 21,
    partATotal: 23,
    partBScore: 15,
    partBTotal: 17,
    answers: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 1, 10: 0 },
  },
  {
    id: "res-2",
    candidateId: "cand-2",
    candidateName: "Sarah M. Jenkins",
    candidateEmail: "sarah.jenkins@al-bayan.com",
    companyId: "8412",
    submittedAt: "2026-09-03T09:43:10.000Z",
    score: 31,
    totalQuestions: 40,
    percentage: 77.5,
    isPassed: true,
    timeSpentSeconds: 1692,
    partAScore: 18,
    partATotal: 23,
    partBScore: 13,
    partBTotal: 17,
    answers: { 1: 0, 2: 1, 3: 2 },
  },
  {
    id: "res-3",
    candidateId: "cand-3",
    candidateName: "Omar Tariq Al-Mansoor",
    candidateEmail: "omar.mansoor@harbico.com",
    companyId: "9104",
    submittedAt: "2026-09-03T15:10:00.000Z",
    score: 24,
    totalQuestions: 40,
    percentage: 60.0,
    isPassed: false,
    timeSpentSeconds: 1800,
    partAScore: 14,
    partATotal: 23,
    partBScore: 10,
    partBTotal: 17,
    answers: { 1: 1, 2: 1, 3: 0 },
  },
];

const STORAGE_KEYS = {
  SETTINGS: "exam_system_settings",
  QUESTIONS: "exam_system_questions",
  CANDIDATES: "exam_system_candidates",
  RESULTS: "exam_system_results",
};

const syncChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("exam_system_sync_channel")
    : null;

export function notifyStorageChange(action: string): void {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ action, timestamp: Date.now() });
    } catch {}
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("exam_storage_change", { detail: { action } })
    );
  }
}

export function onStorageSync(callback: () => void): () => void {
  const handleMessage = () => callback();
  if (syncChannel) {
    syncChannel.addEventListener("message", handleMessage);
  }

  const handleCustomEvent = () => callback();
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key && e.key.startsWith("exam_system_")) {
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("exam_storage_change", handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
  }

  return () => {
    if (syncChannel) {
      syncChannel.removeEventListener("message", handleMessage);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("exam_storage_change", handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

export const ExamStorage = {
  // Settings
  getSettings(): ExamSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: ExamSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    notifyStorageChange("SETTINGS");
  },

  // Questions
  getQuestions(): Question[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      this.saveQuestions(INITIAL_QUESTIONS);
      return INITIAL_QUESTIONS;
    } catch {
      return INITIAL_QUESTIONS;
    }
  },

  saveQuestions(questions: Question[]): void {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    notifyStorageChange("QUESTIONS");
  },

  resetQuestions(): Question[] {
    this.saveQuestions(INITIAL_QUESTIONS);
    return INITIAL_QUESTIONS;
  },

  addQuestion(q: Omit<Question, "id">): Question {
    const list = this.getQuestions();
    const newId = list.length > 0 ? Math.max(...list.map((item) => item.id)) + 1 : 1;
    const newQ: Question = { ...q, id: newId };
    list.push(newQ);
    this.saveQuestions(list);
    return newQ;
  },

  updateQuestion(updated: Question): void {
    const list = this.getQuestions().map((q) => (q.id === updated.id ? updated : q));
    this.saveQuestions(list);
  },

  deleteQuestion(id: number): void {
    const list = this.getQuestions().filter((q) => q.id !== id);
    this.saveQuestions(list);
  },

  // Candidates
  getCandidates(): Candidate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CANDIDATES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
      this.saveCandidates(SEED_CANDIDATES);
      return SEED_CANDIDATES;
    } catch {
      return SEED_CANDIDATES;
    }
  },

  saveCandidates(candidates: Candidate[]): void {
    localStorage.setItem(STORAGE_KEYS.CANDIDATES, JSON.stringify(candidates));
    notifyStorageChange("CANDIDATES");
  },

  registerOrUpdateCandidate(userData: { name: string; email: string; companyId: string }): Candidate {
    const candidates = this.getCandidates();
    const existingIndex = candidates.findIndex(
      (c) =>
        c.companyId.trim().toLowerCase() === userData.companyId.trim().toLowerCase() ||
        c.email.trim().toLowerCase() === userData.email.trim().toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = candidates[existingIndex];
      existing.name = userData.name;
      existing.email = userData.email;
      existing.companyId = userData.companyId;
      existing.status = existing.status === "Completed" ? "Completed" : "In Progress";
      this.saveCandidates(candidates);
      return existing;
    }

    const newCandidate: Candidate = {
      id: "cand-" + Date.now(),
      name: userData.name,
      email: userData.email,
      companyId: userData.companyId,
      registeredAt: new Date().toISOString(),
      status: "In Progress",
      totalAttempts: 0,
    };
    candidates.unshift(newCandidate);
    this.saveCandidates(candidates);
    return newCandidate;
  },

  deleteCandidate(id: string): void {
    const list = this.getCandidates().filter((c) => c.id !== id);
    this.saveCandidates(list);
  },

  // Exam Results
  getResults(): ExamResult[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
      this.saveResults(SEED_RESULTS);
      return SEED_RESULTS;
    } catch {
      return SEED_RESULTS;
    }
  },

  saveResults(results: ExamResult[]): void {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
    notifyStorageChange("RESULTS");
  },

  recordExamResult(result: ExamResult): void {
    const results = this.getResults();
    results.unshift(result);
    this.saveResults(results);

    // Also update candidate summary
    const candidates = this.getCandidates();
    const cand = candidates.find(
      (c) =>
        c.id === result.candidateId ||
        c.companyId.toLowerCase() === result.companyId.toLowerCase() ||
        c.email.toLowerCase() === result.candidateEmail.toLowerCase()
    );

    if (cand) {
      cand.status = "Completed";
      cand.totalAttempts = (cand.totalAttempts || 0) + 1;
      cand.latestScore = result.score;
      cand.highestScore = Math.max(cand.highestScore || 0, result.score);
      this.saveCandidates(candidates);
    }
  },

  deleteResult(id: string): void {
    const list = this.getResults().filter((r) => r.id !== id);
    this.saveResults(list);
  },

  // Export to CSV/Excel
  exportResultsToCSV(): void {
    const results = this.getResults();
    if (results.length === 0) {
      alert("No results available to export.");
      return;
    }

    const headers = [
      "Result ID",
      "Candidate Name",
      "Company ID",
      "Email Address",
      "Submission Date",
      "Score",
      "Total Questions",
      "Percentage",
      "Status",
      "Part A Score (Interface)",
      "Part A Total",
      "Part B Score (Stakeholder)",
      "Part B Total",
      "Time Spent (Seconds)",
      "Proctoring Status",
      "Tab Switches",
    ];

    const rows = results.map((r) => [
      `"${r.id}"`,
      `"${r.candidateName.replace(/"/g, '""')}"`,
      `"${r.companyId}"`,
      `"${r.candidateEmail}"`,
      `"${new Date(r.submittedAt).toLocaleString()}"`,
      r.score,
      r.totalQuestions,
      `"${r.percentage.toFixed(1)}%"`,
      `"${r.isPassed ? "PASSED" : "FAILED"}"`,
      r.partAScore,
      r.partATotal,
      r.partBScore,
      r.partBTotal,
      r.timeSpentSeconds,
      `"${r.proctoringStatus || "Verified"}"`,
      r.tabSwitches || 0,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `exam_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

