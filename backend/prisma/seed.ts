import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const QUESTIONS = [
  // Part A — Interface Management (1 to 23)
  {
    id: 1,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is an Interface Point (IP)?",
    options: JSON.stringify([
      "A. A location, activity, or information flow where two or more parties, systems, or scopes meet and require coordination",
      "B. A financial approval between departments",
      "C. A document issued only by the Client",
      "D. A construction delay report",
    ]),
    correctAnswer: 0,
  },
  {
    id: 2,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is the main purpose of the Interface Register?",
    options: JSON.stringify([
      "A. Record employee attendance",
      "B. Record, track, and monitor interface points",
      "C. Record only contractual claims",
      "D. Monitor procurement costs",
    ]),
    correctAnswer: 1,
  },
  {
    id: 3,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Who is primarily responsible for developing and maintaining the Interface Register?",
    options: JSON.stringify([
      "A. Planning Engineer",
      "B. HSE Engineer",
      "C. Interface Manager",
      "D. Procurement Department",
    ]),
    correctAnswer: 2,
  },
  {
    id: 4,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Interface points are categorized as:",
    options: JSON.stringify([
      "A. Design and Construction",
      "B. Critical and Non-Critical",
      "C. Open and Closed only",
      "D. Internal and External",
    ]),
    correctAnswer: 3,
  },
  {
    id: 5,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "When should general interface points be identified?",
    options: JSON.stringify([
      "A. During design and pre-construction stages",
      "B. During project handover only",
      "C. Only during commissioning",
      "D. After testing begins",
    ]),
    correctAnswer: 0,
  },
  {
    id: 6,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is the key difference between Internal and External interfaces?",
    options: JSON.stringify([
      "A. Internal are within the project team; external involve outside entities",
      "B. Internal are technical; external are contractual only",
      "C. Internal cost money; external do not",
      "D. There is no practical difference",
    ]),
    correctAnswer: 0,
  },
  {
    id: 7,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What does an Interface Agreement (IA) document?",
    options: JSON.stringify([
      "A. Only supplier invoices",
      "B. Mutual agreement on scope, responsibility, and schedule between interface parties",
      "C. Safety inspection records",
      "D. Employee vacation schedules",
    ]),
    correctAnswer: 1,
  },
  {
    id: 8,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What triggers an Interface Request (IR)?",
    options: JSON.stringify([
      "A. Daily attendance reporting",
      "B. A need for information, coordination, or action across scopes",
      "C. Financial audit initiation",
      "D. Software update releases",
    ]),
    correctAnswer: 1,
  },
  {
    id: 9,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What role does the Lead Party play in an interface?",
    options: JSON.stringify([
      "A. Pay for all interface costs",
      "B. Take ownership of driving resolution, coordination, and documentation",
      "C. Sign safety permits only",
      "D. Perform quality testing only",
    ]),
    correctAnswer: 1,
  },
  {
    id: 10,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Which document sets the framework for interface management on a project?",
    options: JSON.stringify([
      "A. Interface Management Plan (IMP)",
      "B. Health & Safety Plan",
      "C. Site Security Log",
      "D. Daily Work Log",
    ]),
    correctAnswer: 0,
  },
  {
    id: 11,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "How frequently should interface coordination meetings generally occur during active phases?",
    options: JSON.stringify([
      "A. Once a year",
      "B. Weekly or bi-weekly depending on project intensity",
      "C. Only after delays occur",
      "D. Once at project kickoff only",
    ]),
    correctAnswer: 1,
  },
  {
    id: 12,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is an Interface Clash?",
    options: JSON.stringify([
      "A. Verbal argument on site",
      "B. A physical, schedule, or operational conflict between two or more scopes",
      "C. Invoice billing dispute",
      "D. Labor union disagreement",
    ]),
    correctAnswer: 1,
  },
  {
    id: 13,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "When an interface issue cannot be resolved at the team level, what is the proper step?",
    options: JSON.stringify([
      "A. Ignore it and proceed",
      "B. Escalate to Project Management / PMC according to the dispute matrix",
      "C. Stop all project operations immediately",
      "D. Assign blame to the subcontractor",
    ]),
    correctAnswer: 1,
  },
  {
    id: 14,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What does 'Interface Closeout' require?",
    options: JSON.stringify([
      "A. Formal sign-off and mutual verification that agreed requirements were fulfilled",
      "B. Archiving emails without review",
      "C. Ending project contracts prematurely",
      "D. Verbal agreement during lunch",
    ]),
    correctAnswer: 0,
  },
  {
    id: 15,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Which of the following is an example of an External Interface?",
    options: JSON.stringify([
      "A. HVAC duct routing vs. structural beams",
      "B. Coordination with municipal utility authorities (water, electrical)",
      "C. Electrical wiring vs. plumbing pipes",
      "D. Architecture drawings vs. interior finishes",
    ]),
    correctAnswer: 1,
  },
  {
    id: 16,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "An Interface Matrix is used to:",
    options: JSON.stringify([
      "A. Track payroll distribution",
      "B. Map and visualize boundaries and interaction points between multiple packages/contractors",
      "C. Record weather conditions",
      "D. Schedule equipment maintenance",
    ]),
    correctAnswer: 1,
  },
  {
    id: 17,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Which tool or software is most commonly utilized for 3D spatial interface coordination?",
    options: JSON.stringify([
      "A. BIM / Navisworks Clash Detection",
      "B. Microsoft Word",
      "C. Adobe Photoshop",
      "D. Accounting ERP",
    ]),
    correctAnswer: 0,
  },
  {
    id: 18,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is the status of an Interface Point once all obligations and verifications are signed off?",
    options: JSON.stringify(["A. Open", "B. Pending", "C. Closed", "D. In Review"]),
    correctAnswer: 2,
  },
  {
    id: 19,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Who approves the final closure of an Interface Point in the Interface Register?",
    options: JSON.stringify([
      "A. Both participating parties and the Interface Manager / PMC",
      "B. Junior draughtsman",
      "C. Security guard",
      "D. Supplier delivery driver",
    ]),
    correctAnswer: 0,
  },
  {
    id: 20,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "Failure to manage interfaces effectively most commonly results in:",
    options: JSON.stringify([
      "A. Rework, schedule delays, and cost overruns",
      "B. Early project handover",
      "C. Reduction in project scope",
      "D. Better team morale",
    ]),
    correctAnswer: 0,
  },
  {
    id: 21,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "An Interface Boundary Definition typically specifies:",
    options: JSON.stringify([
      "A. Exact battery limit, physical terminal points, and scope demarcation",
      "B. Contractor profit margin",
      "C. Daily meal allowance",
      "D. Insurance premium rates",
    ]),
    correctAnswer: 0,
  },
  {
    id: 22,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "When should an Interface Risk Assessment be conducted?",
    options: JSON.stringify([
      "A. Concurrently with interface identification throughout design and execution",
      "B. Only after a catastrophic failure",
      "C. At final financial settlement",
      "D. Never",
    ]),
    correctAnswer: 0,
  },
  {
    id: 23,
    section: "A",
    sectionTitle: "Part A — Interface Management",
    question: "What is a 'Battery Limit' in industrial and civil construction interfaces?",
    options: JSON.stringify([
      "A. The designated boundary perimeter separating one contractor's work from another's",
      "B. The storage life of equipment batteries",
      "C. Electrical substation fencing only",
      "D. Working hour limitations",
    ]),
    correctAnswer: 0,
  },

  // Part B — Stakeholder Management (24 to 40)
  {
    id: 24,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Who is defined as a project stakeholder?",
    options: JSON.stringify([
      "A. Only investors and project sponsors",
      "B. Any individual, group, or organization who may affect, be affected by, or perceive itself to be affected by the project",
      "C. Only full-time internal company employees",
      "D. Only government inspectors",
    ]),
    correctAnswer: 1,
  },
  {
    id: 25,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "What is the primary objective of a Stakeholder Register?",
    options: JSON.stringify([
      "A. Record names, interest, power/influence, requirements, and engagement strategy",
      "B. Log daily visitor gate passes",
      "C. Calculate payroll deductions",
      "D. Track office equipment",
    ]),
    correctAnswer: 0,
  },
  {
    id: 26,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "In the Power/Interest Grid, how should high-power, high-interest stakeholders be managed?",
    options: JSON.stringify([
      "A. Monitor with minimum effort",
      "B. Keep satisfied",
      "C. Manage closely and engage frequently",
      "D. Keep informed only",
    ]),
    correctAnswer: 2,
  },
  {
    id: 27,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "In the Power/Interest Grid, how should high-power, low-interest stakeholders be treated?",
    options: JSON.stringify([
      "A. Keep satisfied",
      "B. Ignore completely",
      "C. Manage closely",
      "D. Micro-manage daily",
    ]),
    correctAnswer: 0,
  },
  {
    id: 28,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "What is the purpose of a Stakeholder Engagement Plan (SEP)?",
    options: JSON.stringify([
      "A. Outline targeted strategies to effectively interact with and influence stakeholders throughout the project lifecycle",
      "B. Plan annual corporate dinners",
      "C. Calculate bonus allocations",
      "D. Order marketing merchandise",
    ]),
    correctAnswer: 0,
  },
  {
    id: 29,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Which of the following is an internal stakeholder in a construction project?",
    options: JSON.stringify([
      "A. Project Engineering Team",
      "B. Environmental Protection Agency",
      "C. Neighboring community residents",
      "D. City Municipal Council",
    ]),
    correctAnswer: 0,
  },
  {
    id: 30,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Which of the following is an external stakeholder?",
    options: JSON.stringify([
      "A. Utility providers (Electricity & Water Authority)",
      "B. Project Quality Manager",
      "C. Site Construction Superintendent",
      "D. Lead Mechanical Engineer",
    ]),
    correctAnswer: 0,
  },
  {
    id: 31,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "When should stakeholder identification begin on a project?",
    options: JSON.stringify([
      "A. During the project initiation / conception phase",
      "B. Midway through concrete pouring",
      "C. Only during the testing phase",
      "D. After project completion",
    ]),
    correctAnswer: 0,
  },
  {
    id: 32,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "How should negative or resistant stakeholders be handled?",
    options: JSON.stringify([
      "A. Understand their concerns, maintain transparent communication, and seek mitigation strategies",
      "B. Exclude them from all communications",
      "C. Threaten legal retaliation",
      "D. Dismiss their feedback",
    ]),
    correctAnswer: 0,
  },
  {
    id: 33,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "What does a RACI matrix define in stakeholder governance?",
    options: JSON.stringify([
      "A. Responsible, Accountable, Consulted, and Informed roles",
      "B. Real-time Automated Cost Index",
      "C. Regulatory Action Committee Items",
      "D. Resource Allocation and Construction Index",
    ]),
    correctAnswer: 0,
  },
  {
    id: 34,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "What is the purpose of regular stakeholder status updates and reporting?",
    options: JSON.stringify([
      "A. Ensure alignment, build trust, manage expectations, and minimize surprises",
      "B. Fulfill paperwork quotas only",
      "C. Hide project defects",
      "D. Delay project approvals",
    ]),
    correctAnswer: 0,
  },
  {
    id: 35,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Which method is best for gathering expectations from critical project stakeholders early on?",
    options: JSON.stringify([
      "A. Structured interviews, workshops, and requirement elicitation sessions",
      "B. Automated spam emails",
      "C. Guessing based on previous projects",
      "D. Social media polls",
    ]),
    correctAnswer: 0,
  },
  {
    id: 36,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "All stakeholder communications, feedback, and meeting outcomes should be formally recorded.",
    options: JSON.stringify(["A. True", "B. False"]),
    correctAnswer: 0,
  },
  {
    id: 37,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "An overdue stakeholder item should be escalated to the Project Manager and PMC.",
    options: JSON.stringify(["A. True", "B. False"]),
    correctAnswer: 0,
  },
  {
    id: 38,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder commitments beyond delegated authority may be accepted without escalation if the stakeholder has high influence.",
    options: JSON.stringify(["A. True", "B. False"]),
    correctAnswer: 1,
  },
  {
    id: 39,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder awareness and collaboration sessions should include records of the agenda, attendees, and outcomes.",
    options: JSON.stringify(["A. True", "B. False"]),
    correctAnswer: 0,
  },
  {
    id: 40,
    section: "B",
    sectionTitle: "Part B — Stakeholder Management",
    question: "Stakeholder KPI results should only be reviewed at the end of the project.",
    options: JSON.stringify(["A. True", "B. False"]),
    correctAnswer: 1,
  },
];

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed Admin User
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminPassword },
    create: {
      username: "admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("👤 Admin user seeded: admin");

  // 2. Seed Exam Settings
  await prisma.examSetting.upsert({
    where: { id: "default-settings" },
    update: {},
    create: {
      id: "default-settings",
      examTitle: "Workplace Assessment System",
      durationMinutes: 30,
      passingPercentage: 70,
      sectorBadge: "Engineering & Construction Sector",
      allowReviewAnswers: true,
      notifyEmail: "admin@harbico.com",
    },
  });
  console.log("⚙️  Exam settings seeded");

  // 3. Seed Questions
  for (const q of QUESTIONS) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        section: q.section,
        sectionTitle: q.sectionTitle,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      },
      create: {
        id: q.id,
        section: q.section,
        sectionTitle: q.sectionTitle,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      },
    });
  }
  console.log(`📚 Seeded ${QUESTIONS.length} assessment questions`);

  // 4. Seed Sample Candidates
  const cand1 = await prisma.candidate.upsert({
    where: { email: "ahmed.youssef@harbico.com" },
    update: {},
    create: {
      id: "cand-1",
      name: "Ahmed Ashraf Youssef",
      email: "ahmed.youssef@harbico.com",
      companyId: "9353",
      status: "Completed",
      totalAttempts: 1,
      highestScore: 36,
      latestScore: 36,
      registeredAt: new Date("2026-09-02T11:20:00.000Z"),
    },
  });

  const cand2 = await prisma.candidate.upsert({
    where: { email: "sarah.jenkins@al-bayan.com" },
    update: {},
    create: {
      id: "cand-2",
      name: "Sarah M. Jenkins",
      email: "sarah.jenkins@al-bayan.com",
      companyId: "8412",
      status: "Completed",
      totalAttempts: 1,
      highestScore: 31,
      latestScore: 31,
      registeredAt: new Date("2026-09-03T09:15:00.000Z"),
    },
  });

  const cand3 = await prisma.candidate.upsert({
    where: { email: "omar.mansoor@harbico.com" },
    update: {},
    create: {
      id: "cand-3",
      name: "Omar Tariq Al-Mansoor",
      email: "omar.mansoor@harbico.com",
      companyId: "9104",
      status: "Completed",
      totalAttempts: 1,
      highestScore: 24,
      latestScore: 24,
      registeredAt: new Date("2026-09-03T14:40:00.000Z"),
    },
  });

  const cand4 = await prisma.candidate.upsert({
    where: { email: "khaled.nasser@apexbuild.com" },
    update: {},
    create: {
      id: "cand-4",
      name: "Khaled Nasser",
      email: "khaled.nasser@apexbuild.com",
      companyId: "7720",
      status: "Registered",
      totalAttempts: 0,
      registeredAt: new Date("2026-09-04T08:30:00.000Z"),
    },
  });

  // 5. Seed Sample Attempts
  await prisma.examAttempt.upsert({
    where: { id: "res-1" },
    update: {},
    create: {
      id: "res-1",
      candidateId: cand1.id,
      candidateName: cand1.name,
      candidateEmail: cand1.email,
      companyId: cand1.companyId,
      submittedAt: new Date("2026-09-02T11:48:30.000Z"),
      score: 36,
      totalQuestions: 40,
      percentage: 90.0,
      isPassed: true,
      timeSpentSeconds: 1710,
      partAScore: 21,
      partATotal: 23,
      partBScore: 15,
      partBTotal: 17,
      answers: JSON.stringify({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 1, 10: 0 }),
      tabSwitches: 0,
      proctoringStatus: "Verified",
      hasVideoRecording: false,
    },
  });

  await prisma.examAttempt.upsert({
    where: { id: "res-2" },
    update: {},
    create: {
      id: "res-2",
      candidateId: cand2.id,
      candidateName: cand2.name,
      candidateEmail: cand2.email,
      companyId: cand2.companyId,
      submittedAt: new Date("2026-09-03T09:47:00.000Z"),
      score: 31,
      totalQuestions: 40,
      percentage: 77.5,
      isPassed: true,
      timeSpentSeconds: 1920,
      partAScore: 18,
      partATotal: 23,
      partBScore: 13,
      partBTotal: 17,
      answers: JSON.stringify({ 1: 0, 2: 1, 3: 1, 4: 3, 5: 0 }),
      tabSwitches: 1,
      proctoringStatus: "Warnings",
      hasVideoRecording: false,
    },
  });

  await prisma.examAttempt.upsert({
    where: { id: "res-3" },
    update: {},
    create: {
      id: "res-3",
      candidateId: cand3.id,
      candidateName: cand3.name,
      candidateEmail: cand3.email,
      companyId: cand3.companyId,
      submittedAt: new Date("2026-09-03T15:18:00.000Z"),
      score: 24,
      totalQuestions: 40,
      percentage: 60.0,
      isPassed: false,
      timeSpentSeconds: 2280,
      partAScore: 14,
      partATotal: 23,
      partBScore: 10,
      partBTotal: 17,
      answers: JSON.stringify({ 1: 0, 2: 0, 3: 2, 4: 1 }),
      tabSwitches: 3,
      proctoringStatus: "Warnings",
      hasVideoRecording: false,
    },
  });

  console.log("✅ Database seeding successfully completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

