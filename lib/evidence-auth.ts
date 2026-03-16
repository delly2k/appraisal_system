import type { AuthUser } from "@/lib/auth";

/**
 * Check if user can access evidence for the given employeeId.
 * Employee may access only self; manager/HR may access others.
 * When appraisalId provided, also allows appraisal manager.
 */
export function canAccessEvidenceForEmployee(
  user: AuthUser | null,
  employeeId: string,
  opts?: { appraisalManagerId?: string }
): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const isHrOrAdmin = roles.some((r) => r === "hr" || r === "admin");
  const isSelf = user.employee_id === employeeId;
  const isAppraisalManager = opts?.appraisalManagerId && user.employee_id === opts.appraisalManagerId;
  return isSelf || isHrOrAdmin || !!isAppraisalManager;
}
