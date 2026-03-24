/**
 * 360 Feedback review request email via Microsoft Graph.
 * Manual send: POST /api/feedback/cycles/[id]/send-notifications or POST /api/feedback/test-notification.
 */

import { sendEmailViaGraph } from "@/lib/email";

export interface FeedbackReviewRequestParams {
  toEmail: string;
  participantName: string;
  cycleName: string;
  deadline: string;
}

/**
 * Send a single 360 feedback review request notification.
 */
export async function sendFeedbackReviewRequest(params: FeedbackReviewRequestParams): Promise<void> {
  const { toEmail, participantName, cycleName, deadline } = params;
  const textContent = [
    "You have been selected to provide 360 feedback for " + participantName + ".",
    "",
    "Cycle: " + cycleName,
    "Deadline: " + deadline,
    "",
    "Please complete your review in the Employee Performance Portal.",
  ].join("\n");
  const htmlContent = [
    "<p>You have been selected to provide 360 feedback for <strong>" + escapeHtml(participantName) + "</strong>.</p>",
    "<p><strong>Cycle:</strong> " + escapeHtml(cycleName) + "<br><strong>Deadline:</strong> " + escapeHtml(deadline) + "</p>",
    "<p>Please complete your review in the Employee Performance Portal.</p>",
  ].join("");
  const result = await sendEmailViaGraph({
    to: toEmail,
    subject: `360 Feedback Request: ${cycleName}`,
    textContent,
    htmlContent,
  });
  if (!result.success) {
    throw new Error(result.error ?? "Failed to send email");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
