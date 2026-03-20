/**
 * Appraisal domain types and enums.
 * Aligned with Supabase enums: appraisal_status, cycle_status, cycle_type, appraisal_purpose.
 */

/** Workflow status (DBJ appraisal process). IN_PROGRESS = check-ins stage after workplan approval. */
export const APPRAISAL_STATUS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "IN_PROGRESS",
  "SELF_ASSESSMENT",
  "SUBMITTED",
  "MANAGER_REVIEW",
  "PENDING_SIGNOFF",
  // deprecated - skipped in workflow
  "HOD_REVIEW",
  "HR_REVIEW",
  "COMPLETE",
] as const;

export type AppraisalStatus = (typeof APPRAISAL_STATUS)[number];

export const CYCLE_STATUS = ["draft", "open", "closed", "archived"] as const;

export type CycleStatus = (typeof CYCLE_STATUS)[number];

export const CYCLE_TYPE = ["annual"] as const;

export type CycleType = (typeof CYCLE_TYPE)[number];

export const APPRAISAL_PURPOSE = [
  "appointment",
  "promotion",
  "transfer",
  "resignation",
  "end_of_year",
  "other",
] as const;

export type AppraisalPurpose = (typeof APPRAISAL_PURPOSE)[number];

export interface AppraisalCycleRow {
  id: string;
  name: string;
  cycle_type: CycleType;
  fiscal_year: string;
  quarter: string | null;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppraisalRow {
  id: string;
  cycle_id: string;
  employee_id: string;
  manager_employee_id: string | null;
  division_id: string | null;
  review_type: CycleType;
  /** 1-4 for quarterly check-ins; null for annual */
  quarter?: number | null;
  purpose: AppraisalPurpose;
  purpose_other: string | null;
  date_started_in_post: string | null;
  interim_reviews_count: number;
  status: AppraisalStatus;
  is_management: boolean;
  submitted_at: string | null;
  manager_completed_at: string | null;
  employee_ack_at: string | null;
  hr_closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkplanRow {
  id: string;
  appraisal_id: string;
  status: string;
  approved_by_employee_id: string | null;
  approved_at: string | null;
  version: number;
  copied_from_workplan_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Dashboard payload for GET /api/dashboard/[employeeId]. checkins added in check-in prompt later. */
export interface DashboardEmployeePayload {
  fiscal_year: string;
  cycle_id: string;
  workplan_status: string;
  annual: { status: AppraisalStatus } | null;
}

export function isAppraisalStatus(s: string): s is AppraisalStatus {
  return (APPRAISAL_STATUS as readonly string[]).includes(s);
}

export function isCycleStatus(s: string): s is CycleStatus {
  return CYCLE_STATUS.includes(s as CycleStatus);
}

export function isCycleType(s: string): s is CycleType {
  return CYCLE_TYPE.includes(s as CycleType);
}
