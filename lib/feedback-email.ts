/**
 * 360 Feedback review request email. Uses SMTP from env (SMTP_HOST, SMTP_PORT, etc.).
 * For manual testing: call POST /api/feedback/cycles/[id]/send-notifications or
 * POST /api/feedback/test-notification.
 */

import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("SMTP configuration missing: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
  }
  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure,
    auth: { user, pass },
  });
}

const fromEmail = () => process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@localhost";

export interface FeedbackReviewRequestParams {
  toEmail: string;
  participantName: string;
  cycleName: string;
  deadline: string;
}

/**
 * Send a single 360 feedback review request notification.
 * Body: "You have been selected to provide 360 feedback for [Employee Name]. Cycle: ... Deadline: ..."
 */
export async function sendFeedbackReviewRequest(params: FeedbackReviewRequestParams): Promise<void> {
  const { toEmail, participantName, cycleName, deadline } = params;
  const transport = getTransport();
  await transport.sendMail({
    from: fromEmail(),
    to: toEmail,
    subject: `360 Feedback Request: ${cycleName}`,
    text: [
      "You have been selected to provide 360 feedback for " + participantName + ".",
      "",
      "Cycle: " + cycleName,
      "Deadline: " + deadline,
      "",
      "Please complete your review in the Employee Performance Portal.",
    ].join("\n"),
    html: [
      "<p>You have been selected to provide 360 feedback for <strong>" + escapeHtml(participantName) + "</strong>.</p>",
      "<p><strong>Cycle:</strong> " + escapeHtml(cycleName) + "<br><strong>Deadline:</strong> " + escapeHtml(deadline) + "</p>",
      "<p>Please complete your review in the Employee Performance Portal.</p>",
    ].join(""),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
