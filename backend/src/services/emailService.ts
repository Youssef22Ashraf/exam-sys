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
  attemptNumber?: number;
}

export interface ExamStartEmailData {
  candidateName: string;
  candidateEmail: string;
  companyId: string;
  sessionId?: string;
  startedAt?: Date;
}

/**
 * Escape a value for inclusion in the HTML mail body. candidateName, email and
 * companyId reach here from the unauthenticated /register endpoint, so they
 * are attacker-controlled text arriving in a supervisor's inbox.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseRecipients(raw: string | undefined): string {
  if (!raw) return process.env.ADMIN_ALERT_EMAIL || "";
  const list = raw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  return list.length > 0 ? list.join(", ") : (process.env.ADMIN_ALERT_EMAIL || "");
}

// Configured nodemailer transport supporting Gmail, Outlook / Office 365, etc.
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
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      // Certificate verification stays ON.
      ...(process.env.SMTP_INSECURE_TLS === "true"
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    });
  }
  return null;
};

export interface EmailDispatchPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailDispatchResult {
  success: boolean;
  message?: string;
  error?: string;
  provider: "resend" | "smtp" | "none";
}

/**
 * Universal email dispatcher:
 * 1. If RESEND_API_KEY is configured, sends via Resend HTTPS REST API over port 443
 *    (guaranteed to bypass cloud provider SMTP port 587/465 blocks, e.g. on Railway).
 * 2. Otherwise uses standard SMTP with explicit timeouts so requests never hang.
 */
export async function dispatchEmail(payload: EmailDispatchPayload): Promise<EmailDispatchResult> {
  // 1. Resend HTTPS API (Port 443 — NEVER blocked by Railway or cloud firewalls)
  if (process.env.RESEND_API_KEY) {
    try {
      const from = process.env.RESEND_FROM || "Workplace Assessment <onboarding@resend.dev>";
      const recipients = payload.to
        .split(/[,;]+/)
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
      });

      const data: any = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Email Alert Sent via Resend HTTPS] Delivered to: ${payload.to}`);
        return {
          success: true,
          message: `Delivered via Resend to ${payload.to}`,
          provider: "resend",
        };
      } else {
        const errMsg = data?.message || `Resend HTTP error ${res.status}`;
        console.error("[Email Resend Error]", errMsg);
        return {
          success: false,
          error: errMsg,
          provider: "resend",
        };
      }
    } catch (err: any) {
      console.error("[Email Resend Exception]", err);
      return {
        success: false,
        error: err.message || "Failed to deliver via Resend HTTPS API",
        provider: "resend",
      };
    }
  }

  // 2. Standard SMTP Transport (with 8s connection timeout)
  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Workplace Assessment System" <${process.env.SMTP_USER}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      console.log(`[Email Alert Sent via SMTP] Delivered to: ${payload.to}`);
      return {
        success: true,
        message: `Delivered via SMTP to ${payload.to}`,
        provider: "smtp",
      };
    } catch (err: any) {
      const isTimeout =
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNREFUSED" ||
        err.code === "ESOCKET" ||
        err.message?.includes("timeout");

      if (isTimeout) {
        console.warn(
          `[Email Notice] SMTP connection to ${process.env.SMTP_HOST} timed out. ` +
          `Railway blocks outbound SMTP ports (25, 465, 587, 2525) on Free/Hobby plans. ` +
          `To send emails on Railway without port restrictions, configure RESEND_API_KEY in Railway Variables (HTTPS port 443).`
        );
      } else {
        console.error("Failed to send email via SMTP:", err);
      }

      return {
        success: false,
        error: isTimeout
          ? "SMTP connection timed out. Railway blocks outbound SMTP ports (587/465) on Free/Hobby plans. Use RESEND_API_KEY in Railway Variables for HTTPS delivery, or upgrade to Railway Pro."
          : err.message || "Failed to send email via SMTP.",
        provider: "smtp",
      };
    }
  }

  console.log(`[Email] No email provider configured; alert for ${payload.to} not sent.`);
  return {
    success: false,
    error: "No email provider configured. Set RESEND_API_KEY or SMTP credentials in Railway Variables.",
    provider: "none",
  };
}

/**
 * Dispatches an immediate email alert to the admin/supervisor list
 * whenever an examinee begins sitting their assessment.
 */
export async function sendExamStartAlert(data: ExamStartEmailData) {
  let rawRecipient = process.env.ADMIN_ALERT_EMAIL || "";
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
  if (!recipient) {
    console.warn(
      "[Email] No recipient configured. Set ExamSetting.notifyEmail or ADMIN_ALERT_EMAIL."
    );
    return;
  }

  const subject = `[Exam Started] ${data.candidateName} (${data.companyId}) has entered the assessment`;

  const textBody = `
=========================================
EXAM ENTRY NOTIFICATION
=========================================
Candidate:       ${data.candidateName}
Email:           ${data.candidateEmail}
Company ID:      ${data.companyId}
Status:          Started Sitting (In Progress)
Session ID:      ${data.sessionId || "N/A"}
Started At:      ${(data.startedAt || new Date()).toISOString()}
=========================================
`;

  const appAdminUrl = process.env.APP_URL
    ? `${process.env.APP_URL.replace(/\/$/, "")}/admin`
    : process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/admin`
    : "https://mofarreh-exam-system.up.railway.app/admin";

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
      .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: #ffffff; background-color: #2563eb; }
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
        <h1>Assessment In Progress</h1>
        <div class="badge">STARTED</div>
      </div>
      <div class="content">
        <p style="margin-top: 0;">An examinee has just entered and commenced their assessment session:</p>
        <table class="table">
          <tr><td>Candidate Name</td><td><strong>${escapeHtml(data.candidateName)}</strong></td></tr>
          <tr><td>Email Address</td><td>${escapeHtml(data.candidateEmail)}</td></tr>
          <tr><td>Company ID</td><td>${escapeHtml(data.companyId)}</td></tr>
          <tr><td>Session Started</td><td>${(data.startedAt || new Date()).toLocaleString()}</td></tr>
          <tr><td>Status</td><td><span style="color: #2563eb; font-weight: 600;">Active / In Progress</span></td></tr>
        </table>
        <div class="cta">
          <a href="${appAdminUrl}" class="button">Open Admin Live Oversight</a>
        </div>
      </div>
      <div class="footer">
        Automated real-time notification from Workplace Assessment System
      </div>
    </div>
  </body>
  </html>
  `;

  await dispatchEmail({
    to: recipient,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendExamCompletionAlert(data: ExamCompletionEmailData) {
  let rawRecipient = process.env.ADMIN_ALERT_EMAIL || "";
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
  const isReattempt = Boolean(data.attemptNumber && data.attemptNumber > 1);
  const reattemptPrefix = isReattempt ? `[RE-ATTEMPT #${data.attemptNumber}] ` : "";
  const subject = `${reattemptPrefix}[Assessment Alert] ${data.candidateName} - ${statusEmoji} (${data.percentage.toFixed(1)}%)`;

  const minutes = Math.floor(data.timeSpentSeconds / 60);
  const seconds = data.timeSpentSeconds % 60;
  const formattedTime = `${minutes}m ${seconds < 10 ? "0" : ""}${seconds}s`;

  const textBody = `
=========================================
EXAM SUBMISSION NOTIFICATION ${isReattempt ? `(RE-ATTEMPT #${data.attemptNumber})` : ""}
=========================================
Candidate:       ${data.candidateName}
Email:           ${data.candidateEmail}
Company ID:      ${data.companyId}
Attempt:         Attempt #${data.attemptNumber || 1} ${isReattempt ? "[RE-ATTEMPT]" : ""}
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
        ${
          isReattempt
            ? `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
                <strong style="display: block; font-size: 14px; margin-bottom: 4px;">⚠️ RE-ATTEMPT NOTICE (Attempt #${data.attemptNumber})</strong>
                Notice for Admin: This examinee has submitted previous assessment attempts. Historical records can be compared in the Admin Portal.
              </div>`
            : ""
        }
        <p style="margin-top: 0;">An examinee has just submitted their assessment:</p>
        <table class="table">
          <tr><td>Candidate Name</td><td><strong>${escapeHtml(data.candidateName)}</strong></td></tr>
          <tr><td>Email Address</td><td>${escapeHtml(data.candidateEmail)}</td></tr>
          <tr><td>Company ID</td><td>${escapeHtml(data.companyId)}</td></tr>
          <tr><td>Attempt Number</td><td><strong>Attempt #${data.attemptNumber || 1}${isReattempt ? " (Re-attempt)" : ""}</strong></td></tr>
          <tr><td>Final Score</td><td><strong>${data.score} / ${data.totalQuestions} (${data.percentage.toFixed(1)}%)</strong></td></tr>
          <tr><td>Time Spent</td><td>${formattedTime}</td></tr>
          <tr><td>Proctoring Status</td><td>${data.proctoringStatus} (${data.tabSwitches} warning${data.tabSwitches === 1 ? "" : "s"})</td></tr>
          <tr><td>Submission Time</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div class="cta">
          <a href="${process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/admin` : (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/admin` : 'https://mofarreh-exam-system.up.railway.app/admin')}" class="button">Open Admin Dashboard</a>
        </div>
      </div>
      <div class="footer">
        Automated proctoring notification from Workplace Assessment System
      </div>
    </div>
  </body>
  </html>
  `;

  if (!recipient) {
    console.warn(
      "[Email] No recipient configured. Set ExamSetting.notifyEmail or ADMIN_ALERT_EMAIL."
    );
    return;
  }

  await dispatchEmail({
    to: recipient,
    subject,
    text: textBody,
    html: htmlBody,
  });
}

export async function sendTestEmailAlert(targetEmail?: string) {
  let rawRecipient = targetEmail || process.env.ADMIN_ALERT_EMAIL || "";
  try {
    const settings = await prisma.examSetting.findFirst({
      where: { id: "default-settings" },
    });
    if (!targetEmail && settings?.notifyEmail) {
      rawRecipient = settings.notifyEmail;
    }
  } catch (err) {}

  const recipient = parseRecipients(rawRecipient);
  if (!recipient) {
    return {
      success: false,
      error: "NO_RECIPIENT",
      message: "No recipient configured. Please enter a notification email address.",
      simulated: true,
    };
  }

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
        <p>When examinees enter and complete assessments, detailed reports and proctoring summaries will be dispatched to this address.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Timestamp: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const dispatchRes = await dispatchEmail({
    to: recipient,
    subject,
    text: textBody,
    html: htmlBody,
  });

  return {
    success: dispatchRes.success,
    message:
      dispatchRes.message ||
      (dispatchRes.success
        ? `✓ Test email successfully dispatched to ${recipient}`
        : `Failed to dispatch test email: ${dispatchRes.error}`),
    error: dispatchRes.error,
    simulated: dispatchRes.provider === "none",
  };
}
