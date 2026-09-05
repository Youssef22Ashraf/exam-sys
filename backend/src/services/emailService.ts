import nodemailer from "nodemailer";
import { prisma } from "../config/db";

export interface ExamCompletionEmailData {
  candidateName: string;
  candidateEmail: string;
  companyId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  isPassed: boolean;
  timeSpentSeconds: number;
  proctoringStatus: string;
  tabSwitches: number;
}

// Configured nodemailer transport if SMTP env variables are present
const createTransporter = () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

export async function sendExamCompletionAlert(data: ExamCompletionEmailData) {
  let recipient = process.env.ADMIN_ALERT_EMAIL || "admin@harbico.com";
  try {
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    if (settings?.notifyEmail) {
      recipient = settings.notifyEmail.trim();
    }
  } catch (err) {
    // Fallback to env
  }
  const statusEmoji = data.isPassed ? "✅ PASSED" : "❌ FAILED";
  const subject = `[Assessment Alert] ${data.candidateName} - ${statusEmoji} (${data.percentage.toFixed(1)}%)`;

  const body = `
=========================================
EXAM SUBMISSION NOTIFICATION
=========================================
Candidate:       ${data.candidateName}
Email:           ${data.candidateEmail}
Company ID:      ${data.companyId}
Result:          ${data.isPassed ? "PASSED" : "FAILED"}
Score:           ${data.score} / ${data.totalQuestions} (${data.percentage.toFixed(1)}%)
Time Spent:      ${Math.floor(data.timeSpentSeconds / 60)}m ${data.timeSpentSeconds % 60}s
Proctoring:      ${data.proctoringStatus} (Tab switches: ${data.tabSwitches})
Submitted:       ${new Date().toISOString()}
=========================================
`;

  try {
    const transporter = createTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: `"Workplace Assessment System" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject,
        text: body,
      });
      console.log(`📧 [Email Alert Sent] Notification delivered to ${recipient}`);
    } else {
      console.log(`📧 [Email Mock Logged - No SMTP Configured]:`);
      console.log(body);
    }
  } catch (error) {
    console.error("⚠️ Failed to send email alert:", error);
  }
}

