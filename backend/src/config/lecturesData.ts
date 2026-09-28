import path from "path";
import fs from "fs";
import rawSlidesData from "./lecturesSlides.json";

export interface LectureSlideTopic {
  slideNumber: number;
  title: string;
  summary?: string;
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  content: string[];
}

export interface CheckpointItem {
  id: string;
  label: string;
  description?: string;
}

export interface LectureItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Procedure Briefing" | "Comparative Analysis" | "Site Operations";
  docRef: string;
  policyRef?: string;
  description: string;
  durationSeconds: number;
  durationFormatted: string;
  slideCount: number;
  videoFilename: string;
  pptxFilename: string;
  srtFilename?: string;
  keyTopics: string[];
  outline: LectureSlideTopic[];
  slides: SlideItem[];
  checkpoints: CheckpointItem[];
}

const rawSlides = rawSlidesData as Record<string, SlideItem[]>;

const SLIDES_MAP: Record<string, SlideItem[]> = {
  "interface-management": rawSlides["interface-management"] || [],
  "stakeholder-management": rawSlides["stakeholder-management"] || [],
  "interface-vs-stakeholder": rawSlides["comparison"] || rawSlides["interface-vs-stakeholder"] || [],
  "logistics-management": rawSlides["logistics"] || rawSlides["logistics-management"] || [],
};

export const LECTURES: LectureItem[] = [
  {
    id: "interface-management",
    title: "Interface Management Procedure Briefing",
    subtitle: "Procedures, Roles & Coordination Team Briefing",
    category: "Procedure Briefing",
    docRef: "Projects Interface Management Procedure",
    policyRef: "MAH-ENC-INT-OP-POL-001",
    description:
      "Mandatory framework for identifying, classifying, managing, and closing interface points across all MAH E&C projects — preventing design conflicts, construction delays, and cost overruns.",
    durationSeconds: 674,
    durationFormatted: "11:14",
    slideCount: 28,
    videoFilename: "WhatsApp Video 2026-09-28 at 7.42.35 AM.mp4",
    pptxFilename: "Interface_Management_Procedure_Briefing.pptx",
    srtFilename: "Interface_Management_Procedure_Briefing.srt",
    keyTopics: [
      "Purpose & Non-Negotiable Principles",
      "Definitions & Interface Types (Internal, External, Sister-Company)",
      "Roles, Responsibilities & RACI Matrix",
      "Interface Lifecycle Process & Tools (IPR, Web App)",
      "Escalation Matrix, Risk & Schedule Links, and KPIs",
      "Third-Party Assets & Formal Closeout Criteria",
    ],
    outline: [
      { slideNumber: 1, title: "Title: Interface Management Procedures & Roles" },
      { slideNumber: 2, title: "Briefing Agenda & 6 Core Sections" },
      { slideNumber: 3, title: "Section 01: Purpose & Governing Principles" },
      { slideNumber: 4, title: "Purpose & Objectives: Zero Unregistered Interfaces" },
      { slideNumber: 5, title: "Governing Non-Negotiables & Rules We Never Bend" },
      { slideNumber: 6, title: "Section 02: Definitions & Interface Types" },
      { slideNumber: 7, title: "Interface Point (IP) Definition & Core Boundary Types" },
      { slideNumber: 8, title: "Internal, External & Sister-Company Interfaces" },
      { slideNumber: 9, title: "Physical, Functional & Environmental Interface Categories" },
      { slideNumber: 10, title: "Section 03: Roles & Responsibilities (RACI)" },
      { slideNumber: 11, title: "Key Role Owners: Project Director to Discipline Leads" },
      { slideNumber: 12, title: "Interface Manager & Coordinator Core Duties" },
      { slideNumber: 13, title: "RACI Governance Matrix for Interface Workflow" },
      { slideNumber: 14, title: "Section 04: Process Flow, Meetings & Tools" },
      { slideNumber: 15, title: "6-Stage Interface Point Lifecycle (IP-01 to IP-06)" },
      { slideNumber: 16, title: "Interface Points Register (IPR) Mandatory Structure" },
      { slideNumber: 17, title: "Weekly & Monthly Interface Coordination Meetings" },
      { slideNumber: 18, title: "Digital Tools & Documentation Standards" },
      { slideNumber: 19, title: "Section 05: Escalation, Schedule & KPIs" },
      { slideNumber: 20, title: "6-Level Interface Escalation Protocol" },
      { slideNumber: 21, title: "Critical Path Integration & Schedule Risk Mapping" },
      { slideNumber: 22, title: "Key Performance Indicators (Resolution Rate & Timeliness)" },
      { slideNumber: 23, title: "Section 06: Third-Party Assets, Awareness & Closeout" },
      { slideNumber: 24, title: "Third-Party & Utility Interface Clearances" },
      { slideNumber: 25, title: "Subcontractor Induction & Interface Awareness" },
      { slideNumber: 26, title: "Formal Handover & Interface Closeout Sign-off" },
      { slideNumber: 27, title: "Summary Takeaways & Document Reference Library" },
      { slideNumber: 28, title: "Q&A Session & Next Steps" },
    ],
    slides: SLIDES_MAP["interface-management"] || [],
    checkpoints: [
      {
        id: "ip_identification",
        label: "Interface Point (IP) Definition & Types",
        description: "Understand Physical, Functional, and Organizational boundary definitions across project disciplines.",
      },
      {
        id: "ipr_principles",
        label: "Interface Points Register (IPR) Non-Negotiables",
        description: "Zero unregistered interfaces, named owners, mandatory target dates, and formal change tracking.",
      },
      {
        id: "raci_matrix",
        label: "Roles, Responsibilities & RACI Governance",
        description: "Clear mandates for Interface Manager, Engineering Leads, Subcontractors, and Project Management.",
      },
      {
        id: "escalation_matrix",
        label: "Escalation Matrix & SLA Timelines",
        description: "3-tier escalation framework for unresolved interfaces without delaying the critical path.",
      },
      {
        id: "closeout_criteria",
        label: "Formal Interface Closeout Sign-Off",
        description: "Technical sign-off by all concerned parties with verification evidence and closeout transmittals.",
      },
    ],
  },
  {
    id: "stakeholder-management",
    title: "Stakeholder Management Procedure Briefing",
    subtitle: "Procedures, Roles & Engagement Team Briefing",
    category: "Procedure Briefing",
    docRef: "MAH-ENC-CNS-PM-PRO-002",
    policyRef: "POL-002",
    description:
      "Structured framework to identify, analyse, engage, and communicate with internal and external stakeholders in every project phase — ensuring expectations, concerns, and inputs are systematically recorded and governed.",
    durationSeconds: 876,
    durationFormatted: "14:36",
    slideCount: 29,
    videoFilename: "WhatsApp Video 2026-09-28 at 7.42.34 AM.mp4",
    pptxFilename: "Stakeholder Management Procedure Briefing  .pptx",
    srtFilename: "Stakeholder_Management_Procedure_Briefing.srt",
    keyTopics: [
      "Purpose & Policy Principles",
      "Stakeholder Categories & Power-Interest Analysis",
      "Roles, Responsibilities & RACI Framework",
      "Stakeholder Engagement Plan (SEP) & Process Map",
      "6-Level Escalation Matrix & Governance KPIs",
      "Priority Governance, Exceptions & Project Closeout",
    ],
    outline: [
      { slideNumber: 1, title: "Title: Stakeholder Management Procedures & Engagement" },
      { slideNumber: 2, title: "Briefing Agenda & Strategic Pillars" },
      { slideNumber: 3, title: "Section 01: Purpose & Policy Principles" },
      { slideNumber: 4, title: "Purpose & Objectives: Proactive Relationship Governance" },
      { slideNumber: 5, title: "Governing Non-Negotiables & Mandatory Stakeholder Register" },
      { slideNumber: 6, title: "Section 02: Stakeholders, Categories & Analysis" },
      { slideNumber: 7, title: "Stakeholder Definitions & Impact Scope" },
      { slideNumber: 8, title: "Internal vs External Stakeholder Classifications" },
      { slideNumber: 9, title: "Power-Interest Matrix & Engagement Priority Quadrants" },
      { slideNumber: 10, title: "Section 03: Roles & Responsibilities" },
      { slideNumber: 11, title: "Leadership Roles: Project Director & Stakeholder Lead" },
      { slideNumber: 12, title: "Cross-Functional Discipline & Site Rep Roles" },
      { slideNumber: 13, title: "RACI Governance Chart for Stakeholder Interaction" },
      { slideNumber: 14, title: "Section 04: Process, Engagement Planning & Tools" },
      { slideNumber: 15, title: "Stakeholder Identification & Analysis Workflow" },
      { slideNumber: 16, title: "Stakeholder Engagement Plan (SEP) Template Structure" },
      { slideNumber: 17, title: "Communication Protocols & Multi-Channel Engagement" },
      { slideNumber: 18, title: "Feedback, Grievance Mechanism & Issue Log" },
      { slideNumber: 19, title: "Section 05: 6-Level Escalation & KPIs" },
      { slideNumber: 20, title: "Level 1 to Level 6 Stakeholder Escalation Trigger Chain" },
      { slideNumber: 21, title: "Stakeholder Satisfaction & Response Timeliness KPIs" },
      { slideNumber: 22, title: "Auditability & Controlled Meeting Minutes" },
      { slideNumber: 23, title: "Section 06: Governance Priority, Exceptions & Closeout" },
      { slideNumber: 24, title: "Contractual vs Regulatory Stakeholder Precedence" },
      { slideNumber: 25, title: "Handling Deviations, Emergencies & Exception Log" },
      { slideNumber: 26, title: "Demobilization, Final Clearances & Handover" },
      { slideNumber: 27, title: "Procedure Controlled Reference Library" },
      { slideNumber: 28, title: "Key Briefing Summary & Action Items" },
      { slideNumber: 29, title: "Open Floor Q&A" },
    ],
    slides: SLIDES_MAP["stakeholder-management"] || [],
    checkpoints: [
      {
        id: "power_interest_matrix",
        label: "Power–Interest Matrix Quadrants",
        description: "Master the 4 engagement quadrants: Manage Closely, Keep Satisfied, Keep Informed, and Monitor.",
      },
      {
        id: "engagement_planning",
        label: "Stakeholder Engagement Plan (SEP)",
        description: "Tailored communication strategies, frequency, and verified channels per stakeholder group.",
      },
      {
        id: "gro_authority",
        label: "Government & Authority Coordination via GRO",
        description: "Direct all municipal, utility, and regulatory interactions through the Government Relations Officer.",
      },
      {
        id: "grievance_disputes",
        label: "Grievance Mechanism & Issue Logging",
        description: "Systematic logging, investigation, escalation, and resolution of external community grievances.",
      },
      {
        id: "sentiment_audit",
        label: "Stakeholder Audit & Sentiment Tracking",
        description: "Regular updates to the Stakeholder Register and proactive relationship health checks.",
      },
    ],
  },
  {
    id: "interface-vs-stakeholder",
    title: "Interface vs. Stakeholder Management Comparison",
    subtitle: "A Comparative Analysis of Two Complementary MAH Governance Systems",
    category: "Comparative Analysis",
    docRef: "Comparative Governance Analysis",
    policyRef: "MAH-ENC Governance Framework",
    description:
      "Deep comparative analysis of how the Engineering & Construction Sector coordinates technical connection points on one side and stakeholder relationships on the other — explaining why they remain connected but never merged.",
    durationSeconds: 355,
    durationFormatted: "05:55",
    slideCount: 9,
    videoFilename: "WhatsApp Video 2026-09-28 at 10.15.04 AM.mp4",
    pptxFilename: "Interface vs Stakeholder Management Comparison 2.pptx",
    srtFilename: "Interface_vs_Stakeholder_Management_Comparison.srt",
    keyTopics: [
      "The Core Distinction: Physical/Technical vs Relational Risks",
      "Scope & Structure Across the 5 Dimensions",
      "Role Comparison: Interface Manager vs Stakeholder Manager",
      "Where They Intersect: Connected but Never Merged",
      "Organizational Separation: Why Separate Reporting Lines Protect Projects",
    ],
    outline: [
      { slideNumber: 1, title: "Title: Comparative Governance Analysis" },
      { slideNumber: 2, title: "Agenda: Core Distinction to Organizational Separation" },
      { slideNumber: 3, title: "01 The Core Distinction: Different Disciplines, Different Risks" },
      { slideNumber: 4, title: "02 Scope & Structure: The 5 Dimensions Side-by-Side" },
      { slideNumber: 5, title: "03 Roles Comparison: Interface Manager vs Stakeholder Manager" },
      { slideNumber: 6, title: "04 Where They Intersect: Technical Trigger vs Relational Execution" },
      { slideNumber: 7, title: "05 Organizational Separation: Why They Sit in Separate Departments" },
      { slideNumber: 8, title: "Summary Matrix: Key Takeaways & Delivery Protections" },
      { slideNumber: 9, title: "Controlled Reference Documents & Discussion" },
    ],
    slides: SLIDES_MAP["interface-vs-stakeholder"] || [],
    checkpoints: [
      {
        id: "core_distinction",
        label: "The Core Distinction: Technical vs. Relational",
        description: "Interface controls connection points and physical/functional clashes; Stakeholder controls human expectations and influence.",
      },
      {
        id: "mandate_separation",
        label: "Organizational & Departmental Separation",
        description: "Why separate reporting lines protect delivery: avoiding dilution of technical rigor and stakeholder diplomacy.",
      },
      {
        id: "tools_comparison",
        label: "Tools & Registers Contrast",
        description: "Compare Interface Points Register (IPR) structure vs. Stakeholder Power-Interest Matrix.",
      },
      {
        id: "joint_touchpoints",
        label: "Joint Alignment & Technical Handoffs",
        description: "Understand joint protocols when an external technical interface impacts a third-party stakeholder.",
      },
    ],
  },
  {
    id: "logistics-management",
    title: "Logistics Management Procedure Briefing",
    subtitle: "Procedures, Roles & Site Interfaces Team Briefing",
    category: "Site Operations",
    docRef: "MAH-ENC-CNS-PM-PRO-001",
    policyRef: "MG / E&C Logistics Policy",
    description:
      "Mandatory framework for planning, approving, coordinating, executing, monitoring, and closing logistics activities across construction and infrastructure projects — covering freight forwarding, material handling, customs, and laydown areas.",
    durationSeconds: 821,
    durationFormatted: "13:41",
    slideCount: 23,
    videoFilename: "WhatsApp Video 2026-09-28 at 7.42.35 AM (1).mp4",
    pptxFilename: "Logistics Management Procedure Briefing.pptx",
    keyTopics: [
      "Purpose & Non-Negotiables: No Logistics Activity Without Confirmed Workfront",
      "Roles & Responsibilities: Leadership, Site Execution & Support Functions",
      "Material Staging, Warehousing & Laydown Area Control",
      "Heavy Haulage, Traffic Management & Road Permits",
      "Customs Clearance, Port Handling & Inspection Workflows",
      "Site Logistics Coordination & Interface Management Alignment",
    ],
    outline: [
      { slideNumber: 1, title: "Title: Logistics Management Procedures & Site Interfaces" },
      { slideNumber: 2, title: "Briefing Agenda & Operational Pillars" },
      { slideNumber: 3, title: "Section 01: Purpose & Governing Principles" },
      { slideNumber: 4, title: "Purpose & Objectives: Seamless On-Time Site Delivery" },
      { slideNumber: 5, title: "Governing Non-Negotiables: Approved Requirements & Safety Clearance" },
      { slideNumber: 6, title: "Section 02: Roles & Responsibilities" },
      { slideNumber: 7, title: "Leadership Roles: Project Director & Logistics Manager" },
      { slideNumber: 8, title: "Site Execution Team: Construction & Materials Superintendents" },
      { slideNumber: 9, title: "Support Functions: Procurement, QA/QC & Safety/HSE Officers" },
      { slideNumber: 10, title: "Section 03: Process Flow & Staging Logistics" },
      { slideNumber: 11, title: "Inbound Supply Chain: Supplier Factory to Site Gate" },
      { slideNumber: 12, title: "Laydown Area Management & Material Preservation Standards" },
      { slideNumber: 13, title: "Handling Equipment, Rigging & Crane Operations Plan" },
      { slideNumber: 14, title: "Section 04: Heavy Transport & Traffic Safety" },
      { slideNumber: 15, title: "Oversized Cargo & Heavy Route Permit Coordination" },
      { slideNumber: 16, title: "Internal Site Traffic Routing & Vehicle Access Control" },
      { slideNumber: 17, title: "Section 05: Interface Touchpoints & Schedule Integration" },
      { slideNumber: 18, title: "Coordination with Interface Points & Workfront Availability" },
      { slideNumber: 19, title: "Logistics Risk Register & Contingency Routing" },
      { slideNumber: 20, title: "Key Performance Indicators: Delivery Timeliness & Damage-Free Rate" },
      { slideNumber: 21, title: "Section 06: Closeout & Demobilization" },
      { slideNumber: 22, title: "Material Surplus Return & Laydown Remediation" },
      { slideNumber: 23, title: "Summary Takeaways & Controlled Reference Library" },
    ],
    slides: SLIDES_MAP["logistics-management"] || [],
    checkpoints: [
      {
        id: "supply_chain_inbound",
        label: "Inbound Supply Chain & Delivery Windows",
        description: "Enforce scheduled delivery windows and verified site gate clearances from supplier factory to laydown.",
      },
      {
        id: "laydown_preservation",
        label: "Laydown Management & Material Preservation",
        description: "Strict staging area zones, environmental protection, and preservation maintenance protocols.",
      },
      {
        id: "crane_rigging",
        label: "Handling Equipment & Rigging Safety",
        description: "Certified rigging plans, crane permits, and exclusion zones during offloading operations.",
      },
      {
        id: "heavy_transport_permits",
        label: "Oversized Cargo & Heavy Route Permits",
        description: "Highway permits, police escorts, and bridge capacity clearances for oversized structural components.",
      },
      {
        id: "traffic_control",
        label: "Site Traffic Routing & Gate Logistics",
        description: "One-way traffic circulation, speed limit enforcement, and pedestrian segregation on active project sites.",
      },
    ],
  },
];

/**
 * Calculate completion percentage based on finished items:
 * - video: 35%
 * - slides: 35%
 * - checkpoints: 20% (split evenly)
 * - download: 10%
 */
export function calculateLectureCompletion(
  completedItemIds: string[],
  lectureId: string
): number {
  const lecture = LECTURES.find((l) => l.id === lectureId);
  if (!lecture) return 0;

  let percent = 0;
  if (completedItemIds.includes("video")) percent += 35;
  if (completedItemIds.includes("slides")) percent += 35;
  if (completedItemIds.includes("download")) percent += 10;

  const cpList = lecture.checkpoints || [];
  if (cpList.length > 0) {
    const finishedCps = cpList.filter((cp) => completedItemIds.includes(cp.id));
    percent += Math.round((finishedCps.length / cpList.length) * 20);
  }

  return Math.min(100, Math.max(0, percent));
}

/**
 * Robust resolution of the lectures directory on local dev or production container
 */
export function getLecturesDirectory(): string {
  const candidates = [
    path.resolve(__dirname, "../../../lectures"),
    path.resolve(__dirname, "../../lectures"),
    path.resolve(__dirname, "../lectures"),
    path.resolve(process.cwd(), "lectures"),
    path.resolve(process.cwd(), "../lectures"),
  ];

  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    // Fall back to relative from process.cwd()
    return path.resolve(process.cwd(), "lectures");
  }
  return found;
}

/**
 * Convert SRT subtitle content to WebVTT format for browser HTML5 <video> <track>
 */
export function convertSrtToVtt(srtContent: string): string {
  // Replace Windows CRLF with LF
  const normalized = srtContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Replace time comma with dot: 00:00:00,600 -> 00:00:00.600
  const vttTimes = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  );
  return `WEBVTT\n\n${vttTimes.trim()}\n`;
}
