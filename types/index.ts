/**
 * Shared types for the Employee Performance Appraisal Portal.
 */

export type UserRole = "employee" | "manager" | "hr" | "admin" | "gm" | "individual";

export interface AppraisalCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "closed";
}

export interface Appraisal {
  id: string;
  cycleId: string;
  employeeId: string;
  status: string;
  submittedAt?: string;
  managerReviewedAt?: string;
}

export interface Workplan {
  id: string;
  appraisalId: string;
  employeeId: string;
  status: string;
  dueDate?: string;
}

export interface PerformanceScore {
  id: string;
  appraisalId: string;
  dimension: string;
  score: number;
  maxScore: number;
  comment?: string;
}
