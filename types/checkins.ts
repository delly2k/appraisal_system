export type CheckInType = "MIDYEAR" | "QUARTERLY" | "ADHOC";

export type CheckInStatus =
  | "OPEN"
  | "EMPLOYEE_SUBMITTED"
  | "MANAGER_REVIEWED"
  | "COMPLETE"
  | "CANCELLED";

export type ObjectiveStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETE";

export interface CheckIn {
  id: string;
  appraisal_id: string;
  title: string;
  check_in_type: CheckInType;
  initiated_by: string | null;
  due_date: string | null;
  status: CheckInStatus;
  employee_submitted_at: string | null;
  manager_reviewed_at: string | null;
  manager_overall_notes: string | null;
  note_to_employee: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckInResponse {
  id: string;
  check_in_id: string;
  workplan_item_id: string;

  employee_status: ObjectiveStatus | null;
  progress_pct: number | null;
  employee_comment: string | null;
  employee_updated_at: string | null;

  mgr_status_override: ObjectiveStatus | null;
  mgr_comment: string | null;
  mgr_acknowledged_at: string | null;

  workplan_item?: {
    id: string;
    major_task: string;
    corporate_objective: string;
    division_objective: string;
    key_output: string;
    performance_standard: string;
    metric_target: number | null;
    metric_type: string | null;
    weight: number;
  };
}

export interface CheckInWithResponses extends CheckIn {
  responses: CheckInResponse[];
  initiated_by_employee?: { full_name: string };
}

export interface WorkplanItemForCheckIn {
  id: string;
  major_task: string;
  corporate_objective: string;
  division_objective: string;
  key_output: string;
  weight: number;
  metric_target: number | null;
}

export interface CheckInsPageData {
  checkIns: CheckInWithResponses[];
  appraisal: {
    id: string;
    employeeName: string;
    cycleLabel: string;
    status: string;
    manager_employee_id: string | null;
    employee_id: string;
  };
  workplanItems: WorkplanItemForCheckIn[];
  currentUser: { employee_id: string | null; roles: string[] };
}
