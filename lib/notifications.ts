/**
 * Notification service for appraisal workflow.
 * Email uses Microsoft Graph (lib/email.ts).
 */

import { sendEmailViaGraph } from "@/lib/email";

export type NotificationEvent =
  | "cycle_opened"
  | "self_assessment_due"
  | "self_assessment_open"
  | "manager_review_due"
  | "hr_decision_required";

export interface SelfAssessmentOpenPayload {
  cycleName: string;
  fiscalYear?: string;
  dueDate?: string | null;
  employeeName: string;
  appraisalId: string;
}

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
// Email (Microsoft Graph)
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, bodyText, bodyHtml } = options;
  const result = await sendEmailViaGraph({
    to,
    subject,
    textContent: bodyText,
    htmlContent: bodyHtml ?? null,
  });
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error("[email]", result.error);
  }
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
    | SelfAssessmentOpenPayload
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
    case "self_assessment_open": {
      const p = payload as SelfAssessmentOpenPayload;
      subject = `Your self-assessment is now open — ${p.cycleName}`;
      bodyText = [
        `Hello ${p.employeeName},`,
        "Your manager has approved your workplan. You can now complete your self-assessment.",
        p.dueDate ? `Due date: ${p.dueDate}.` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
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

// ---------------------------------------------------------------------------
// Check-in notifications
// ---------------------------------------------------------------------------

export interface CheckInSubmittedToManagerPayload {
  appraisalId: string;
  checkInId: string;
  employeeName: string;
  checkInTitle: string;
  managerEmail: string | null;
}

export async function sendCheckInSubmittedToManager(payload: CheckInSubmittedToManagerPayload): Promise<void> {
  const { appraisalId, employeeName, checkInTitle, managerEmail } = payload;
  if (!managerEmail) return;
  const subject = `${employeeName} has submitted their check-in response`;
  const bodyText = [
    `${employeeName} has submitted their check-in: "${checkInTitle}".`,
    "Review and add your response in the appraisal portal.",
  ].join("\n\n");
  await sendEmail({ to: managerEmail, subject, bodyText });
}

export interface CheckInReviewedToEmployeePayload {
  appraisalId: string;
  checkInId: string;
  employeeName: string;
  employeeEmail: string | null;
}

export async function sendCheckInReviewedToEmployee(payload: CheckInReviewedToEmployeePayload): Promise<void> {
  const { employeeName, employeeEmail } = payload;
  if (!employeeEmail) return;
  const subject = "Your check-in has been reviewed by your manager";
  const bodyText = [
    `Hello ${employeeName},`,
    "Your manager has reviewed your check-in. Log in to the appraisal portal to view their feedback.",
  ].join("\n\n");
  await sendEmail({ to: employeeEmail, subject, bodyText });
}

// ---------------------------------------------------------------------------
// Adobe Sign / sign-off notifications (stub)
// Resolves recipient by employee_id and sends via sendEmail.
// ---------------------------------------------------------------------------

export type SignoffNotificationType =
  | "SIGNOFF_ACTION_REQUIRED"
  | "SIGNOFF_COMPLETE"
  | "SIGNOFF_CANCELLED"
  | "SIGNOFF_DECLINED"
  | "SIGNOFF_EXPIRED";

export interface SendNotificationParams {
  /** employees.employee_id of the recipient */
  recipientEmployeeId: string;
  type: SignoffNotificationType;
  message: string;
  appraisalId?: string;
}

/** Minimal Supabase-like client for sendNotification (from getSupabaseAdmin()). Use with sendNotification(..., supabase as SupabaseLike). */
export type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { email?: string | null } | null }> } };
  };
};

/**
 * Send a sign-off related notification to a recipient (by employee_id).
 * Resolves email from employees and calls sendEmail. Use from API routes with getSupabaseAdmin.
 */
export async function sendNotification(params: SendNotificationParams, supabase: SupabaseLike): Promise<void> {
  const { recipientEmployeeId, type, message, appraisalId } = params;
  const { data: emp } = await supabase
    .from("employees")
    .select("email")
    .eq("employee_id", recipientEmployeeId)
    .single();
  const email = emp?.email ?? null;
  if (!email) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[sendNotification] No email for employee_id", recipientEmployeeId, type);
    }
    return;
  }
  const subject =
    type === "SIGNOFF_ACTION_REQUIRED"
      ? "Action required: Sign your appraisal"
      : type === "SIGNOFF_COMPLETE"
        ? "Appraisal sign-off complete"
        : type === "SIGNOFF_CANCELLED"
          ? "Appraisal sign-off cancelled"
          : type === "SIGNOFF_DECLINED"
            ? "Appraisal sign-off declined"
            : type === "SIGNOFF_EXPIRED"
              ? "Appraisal sign-off expired"
              : "Appraisal notification";
  const bodyText = appraisalId
    ? `${message}\n\nView appraisal: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/appraisals/${appraisalId}`
    : message;
  await sendEmail({ to: email, subject, bodyText });

  try {
    const { createNotificationForEmployeeId } = await import("@/lib/notifications/create");
    const link = appraisalId ? `/appraisals/${appraisalId}` : undefined;
    let ntype: import("@/lib/notifications/types").NotificationType = "system.announcement";
    if (type === "SIGNOFF_ACTION_REQUIRED") ntype = "appraisal.sign_off_ready";
    else if (type === "SIGNOFF_COMPLETE") ntype = "appraisal.signed";
    await createNotificationForEmployeeId(recipientEmployeeId, {
      type: ntype,
      title: subject,
      body: message,
      link,
      metadata: { signoff_type: type, appraisal_id: appraisalId ?? null },
    });
  } catch {
    /* in-app notification is non-blocking */
  }
}
