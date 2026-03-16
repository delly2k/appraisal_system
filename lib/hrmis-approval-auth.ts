/**
 * Approval/signoff authorization: Manager and HOD from HRMIS (Dataverse) with fallback to DB.
 * Does not change UI or behaviour; only the source of who can approve/sign as Manager/HOD.
 */

import {
  getManagerSystemUserId,
  getDepartmentHeadSystemUserId,
} from "@/lib/dynamics-org-service";

/**
 * Resolve manager's system user id for the appraisal's employee from HRMIS.
 * Returns null on failure or if not found (caller should fall back to appraisal.manager_employee_id).
 */
export async function resolveManagerSystemUserId(appraisalEmployeeId: string | null): Promise<string | null> {
  if (!appraisalEmployeeId) return null;
  try {
    return await getManagerSystemUserId(appraisalEmployeeId);
  } catch {
    return null;
  }
}

/**
 * Resolve HOD (Head of Department) system user id for the appraisal's employee from HRMIS.
 * Returns null on failure or if not found (caller should fall back to appraisal.division_head_id / roles).
 */
export async function resolveDepartmentHeadSystemUserId(appraisalEmployeeId: string | null): Promise<string | null> {
  if (!appraisalEmployeeId) return null;
  try {
    return await getDepartmentHeadSystemUserId(appraisalEmployeeId);
  } catch {
    return null;
  }
}
