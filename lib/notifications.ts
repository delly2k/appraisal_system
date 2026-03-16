/**
 * Notification service for appraisal workflow.
 * Sends automated notifications via an email placeholder; replace with real
 * email (e.g. SendGrid, Resend, Nodemailer) when integrating.
 */

export type NotificationEvent =
  | "cycle_opened"
  | "self_assessment_due"
  | "manager_review_due"
  | "hr_decision_required";

export interface Recipient {
  email: string;
  name?: string | null;
}

export interface CycleOpenedPayload {
  cycleName: string;
  cycleType: string;
  fiscalYear: string;
  startDate: string;
  endDate: string;
}

export interface SelfAssessmentDuePayload {
  cycleName: string;
  employeeName: string;
  dueDate?: string | null;
  appraisalId: string;
}

export interface ManagerReviewDuePayload {
  cycleName: string;
  employeeName: string;
  managerName?: string | null;
  dueDate?: string | null;
  appraisalId: string;
}

export interface HRDecisionRequiredPayload {
  cycleName: string;
  employeeName: string;
  appraisalId: string;
  systemRecommendation?: string | null;
}

// ---------------------------------------------------------------------------
// Email placeholder – replace with real transport (SendGrid, Resend, etc.)
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, bodyText } = options;
  // Placeholder: log in development; integrate with your email provider in production.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Notification placeholder]", { to, subject, body: bodyText.slice(0, 120) + "…" });
  }
  // TODO: call your email API, e.g.:
  // await resend.emails.send({ from: process.env.EMAIL_FROM, to, subject, html: bodyHtml ?? bodyText });
}

function recipientEmail(r: Recipient | string): string {
  return typeof r === "string" ? r : r.email;
}

function recipientName(r: Recipient | string): string {
  if (typeof r === "string") return r;
  return r.name ?? r.email;
}

// ---------------------------------------------------------------------------
// Notify employee
// ---------------------------------------------------------------------------

export async function notifyEmployee(
  recipient: Recipient | string,
  event: NotificationEvent,
  payload:
    | CycleOpenedPayload
    | SelfAssessmentDuePayload
    | ManagerReviewDuePayload
    | HRDecisionRequiredPayload
): Promise<void> {
  const email = recipientEmail(recipient);
  let subject: string;
  let bodyText: string;

  switch (event) {
    case "cycle_opened": {
      const p = payload as CycleOpenedPayload;
      subject = `Appraisal cycle opened: ${p.cycleName}`;
      bodyText = [
        `The appraisal cycle "${p.cycleName}" (${p.cycleType}, ${p.fiscalYear}) is now open.`,
        `Period: ${p.startDate} to ${p.endDate}.`,
        "Please complete your self-assessment when ready.",
      ].join("\n\n");
      break;
    }
    case "self_assessment_due": {
      const p = payload as SelfAssessmentDuePayload;
      subject = `Self-assessment due: ${p.cycleName}`;
      bodyText = [
        `Hello ${p.employeeName},`,
        `Your self-assessment for the cycle "${p.cycleName}" is due${p.dueDate ? ` by ${p.dueDate}` : ""}.`,
        "Please submit your self-assessment to proceed.",
      ].join("\n\n");
      break;
    }
    default:
      return;
  }

  await sendEmail({ to: email, subject, bodyText });
}

// ---------------------------------------------------------------------------
// Notify manager
// ---------------------------------------------------------------------------

export async function notifyManager(
  recipient: Recipient | string,
  event: NotificationEvent,
  payload:
    | CycleOpenedPayload
    | SelfAssessmentDuePayload
    | ManagerReviewDuePayload
    | HRDecisionRequiredPayload
): Promise<void> {
  const email = recipientEmail(recipient);
  let subject: string;
  let bodyText: string;

  switch (event) {
    case "manager_review_due": {
      const p = payload as ManagerReviewDuePayload;
      subject = `Manager review due: ${p.employeeName} – ${p.cycleName}`;
      bodyText = [
        p.managerName ? `Hello ${p.managerName},` : "Hello,",
        `A manager review is pending for ${p.employeeName} in the cycle "${p.cycleName}".`,
        p.dueDate ? `Due by ${p.dueDate}.` : "Please complete the review when possible.",
        "Log in to the appraisal system to complete the review.",
      ].join("\n\n");
      break;
    }
    case "cycle_opened": {
      const p = payload as CycleOpenedPayload;
      subject = `Appraisal cycle opened: ${p.cycleName}`;
      bodyText = [
        `The appraisal cycle "${p.cycleName}" (${p.cycleType}, ${p.fiscalYear}) is now open.`,
        `Period: ${p.startDate} to ${p.endDate}.`,
        "Direct reports may now submit self-assessments; you will be notified when reviews are due.",
      ].join("\n\n");
      break;
    }
    default:
      return;
  }

  await sendEmail({ to: email, subject, bodyText });
}

// ---------------------------------------------------------------------------
// Notify HR
// ---------------------------------------------------------------------------

const HR_NOTIFICATION_EMAIL =
  process.env.HR_NOTIFICATION_EMAIL ?? process.env.EMAIL_HR ?? "hr@company.com";

export async function notifyHR(
  event: NotificationEvent,
  payload:
    | CycleOpenedPayload
    | SelfAssessmentDuePayload
    | ManagerReviewDuePayload
    | HRDecisionRequiredPayload
): Promise<void> {
  let subject: string;
  let bodyText: string;

  switch (event) {
    case "hr_decision_required": {
      const p = payload as HRDecisionRequiredPayload;
      subject = `HR decision required: ${p.employeeName} – ${p.cycleName}`;
      bodyText = [
        `An appraisal is ready for HR decision: ${p.employeeName}, cycle "${p.cycleName}".`,
        p.systemRecommendation
          ? `System recommendation: ${p.systemRecommendation}`
          : "No system recommendation.",
        "Log in to the appraisal system to record the final HR decision.",
      ].join("\n\n");
      break;
    }
    case "cycle_opened": {
      const p = payload as CycleOpenedPayload;
      subject = `Appraisal cycle opened: ${p.cycleName}`;
      bodyText = [
        `The appraisal cycle "${p.cycleName}" (${p.cycleType}, ${p.fiscalYear}) has been opened.`,
        `Period: ${p.startDate} to ${p.endDate}.`,
      ].join("\n\n");
      break;
    }
    default:
      return;
  }

  await sendEmail({ to: HR_NOTIFICATION_EMAIL, subject, bodyText });
}
