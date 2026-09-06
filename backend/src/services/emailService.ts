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

export function parseRecipients(raw: string | undefined): string {
  if (!raw) return process.env.ADMIN_ALERT_EMAIL || "admin@harbico.com";
  const list = raw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  return list.length > 0 ? list.join(", ") : (process.env.ADMIN_ALERT_EMAIL || "admin@harbico.com");
}

// Configured nodemailer transport supporting Gmail, Outlook / Office 365, Resend, SendGrid, etc.
export const createTransporter = () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const isSecure = port === 465;

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    });
  }
  return null;
};

export async function sendExamCompletionAlert(data: ExamCompletionEmailData) {
  let rawRecipient = process.env.ADMIN_ALERT_EMAIL || "admin@harbico.com";
  try {
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    if (settings?.notifyEmail) {
      rawRecipient = settings.notifyEmail;
    }
  } catch (err) {
    // Fallback to env
  }

  const recipient = parseRecipients(rawRecipient);

  const statusEmoji = data.isPassed ? "PASSED" : "FAILED";
  const statusColor = data.isPassed ? "#16a34a" : "#dc2626";
  const subject = `[Assessment Alert] ${data.candidateName} - ${statusEmoji} (${data.percentage.toFixed(1)}%)`;

  const minutes = Math.floor(data.timeSpentSeconds / 60);
  const seconds = data.timeSpentSeconds % 60;
  const formattedTime = `${minutes}m ${seconds < 10 ? "0" : ""}${seconds}s`;

  const textBody = `
=========================================
EXAM SUBMISSION NOTIFICATION
=========================================
Candidate:       ${data.candidateName}
Email:           ${data.candidateEmail}
Company ID:      ${data.companyId}
Result:          ${data.isPassed ? "PASSED" : "FAILED"}
Score:           ${data.score} / ${data.totalQuestions} (${data.percentage.toFixed(1)}%)
Time Spent:      ${formattedTime}
Proctoring:      ${data.proctoringStatus} (Tab switches: ${data.tabSwitches})
Submitted:       ${new Date().toISOString()}
=========================================
`;

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
      .header { background: #172033; padding: 24px; color: #ffffff; text-align: center; }
      .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: #ffffff; background-color: ${statusColor}; }
      .content { padding: 24px; }
      .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
      .table td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      .table td:first-child { font-weight: 600; color: #64748b; width: 40%; }
      .cta { text-align: center; margin: 20px 0; }
      .button { background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; }
      .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Workplace Assessment Alert</h1>
        <div class="badge">${data.isPassed ? "PASSED" : "FAILED"} - ${data.percentage.toFixed(1)}%</div>
      </div>
      <div class="content">
        <p style="margin-top: 0;">An examinee has just submitted their assessment:</p>
        <table class="table">
          <tr><td>Candidate Name</td><td><strong>${data.candidateName}</strong></td></tr>
          <tr><td>Email Address</td><td>${data.candidateEmail}</td></tr>
          <tr><td>Company ID</td><td>${data.companyId}</td></tr>
          <tr><td>Final Score</td><td><strong>${data.score} / ${data.totalQuestions} (${data.percentage.toFixed(1)}%)</strong></td></tr>
          <tr><td>Time Spent</td><td>${formattedTime}</td></tr>
          <tr><td>Proctoring Status</td><td>${data.proctoringStatus} (${data.tabSwitches} warning${data.tabSwitches === 1 ? "" : "s"})</td></tr>
          <tr><td>Submission Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div class="cta">
          <a href="${process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/admin` : (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/admin` : 'http://localhost:5173/admin')}" class="button">Open Admin Dashboard</a>
        </div>
      </div>
      <div class="footer">
        Automated proctoring notification from Workplace Assessment System
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    const transporter = createTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: `"Workplace Assessment System" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`📧 [Email Alert Sent] Notification delivered to: ${recipient}`);
    } else {
      console.log(`📧 [Email Mock Logged - No SMTP Configured to ${recipient}]:\n${textBody}`);
    }
  } catch (error) {
    console.error("⚠️ Failed to send email alert:", error);
  }
}

export async function sendTestEmailAlert(targetEmail?: string) {
  let rawRecipient = targetEmail || process.env.ADMIN_ALERT_EMAIL || "admin@harbico.com";
  try {
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    if (!targetEmail && settings?.notifyEmail) {
      rawRecipient = settings.notifyEmail;
    }
  } catch (err) {}

  const recipient = parseRecipients(rawRecipient);

  const subject = `[Test Alert] Workplace Assessment System Email Verification`;
  const textBody = `This is a test notification verifying that your Admin Notification Email (${recipient}) is receiving alerts from Workplace Assessment System.`;
  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b; }
      .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
      .header { background: #172033; padding: 20px; color: #ffffff; text-align: center; }
      .content { padding: 24px; font-size: 14px; line-height: 1.6; }
      .status-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin: 16px 0; color: #065f46; font-weight: 500; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2 style="margin: 0; font-size: 18px;">Email Delivery Test</h2>
      </div>
      <div class="content">
        <p>Hello Admin,</p>
        <div class="status-box">
          ✓ Your notification service is successfully operational and reaching: <strong>${recipient}</strong>.
        </div>
        <p>When examinees complete assessments, detailed score reports and proctoring summaries will be dispatched to this address.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Timestamp: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Workplace Assessment System" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return { success: true, message: `✓ Test email successfully dispatched to ${recipient}`, simulated: false };
    } catch (err: any) {
      console.error("SMTP Delivery Error:", err);
      return {
        success: false,
        error: `SMTP Error (${err.code || "AUTH"}): ${err.message}`,
        message: "Failed to send email via SMTP server.",
        simulated: false,
      };
    }
  } else {
    console.log(`📧 [Simulated Test Email dispatched to ${recipient}]`);
    return {
      success: true,
      message: `SMTP not configured in .env. Simulated email alert logged to server console for ${recipient}. Add SMTP credentials to backend/.env to send real emails.`,
      simulated: true,
    };
  }
}
