import { createClient } from "@supabase/supabase-js";
import { fetchOneSystemUserByEmail } from "@/lib/dynamics-sync";
import {
  getEmployeeBySystemUserId,
  getManager,
  getDirectReports,
  getDivisionHead,
  getDepartmentHeadFromDepartmentTable,
  type Xrm1Employee,
} from "@/lib/dynamics-org-service";

/**
 * Reporting structure from HR.
 * Primary: Dynamics 365 xrm1_employee (getReportingStructureFromDynamics).
 * Fallback: Supabase reporting_lines + employees (getReportingStructure).
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface ReportingPerson {
  employee_id: string;
  full_name: string | null;
  email: string | null;
  job_title: string | null;
}

/** Current user's HR profile from employees (division, department, job, division head). */
export interface CurrentUserProfile {
  division_id: string | null;
  division_name: string | null;
  department_id: string | null;
  department_name: string | null;
  job_title: string | null;
  /** When set, the division/department head (from xrm1_employee._xrm1_employee_department_head_id_value). */
  divisionHead: ReportingPerson | null;
}

export interface ReportingStructure {
  employee_id: string | null;
  /** System user id for this employee (matches appraisals.employee_id when appraisals are created from HRMIS). */
  currentUserSystemUserId: string | null;
  /** Current user's profile (division, department, job title, division head). */
  currentUserProfile: CurrentUserProfile | null;
  directReports: ReportingPerson[];
  managers: ReportingPerson[];
}

/**
 * Get direct reports, managers, and current user profile (division, department, job, division head).
 * Uses reporting_lines + employees; division head from employees.department_head_system_user_id when set.
 */
export async function getReportingStructure(
  employeeId: string | null | undefined
): Promise<ReportingStructure> {
  const result: ReportingStructure = {
    employee_id: employeeId ?? null,
    currentUserSystemUserId: null,
    currentUserProfile: null,
    directReports: [],
    managers: [],
  };
  if (!employeeId) return result;

  const supabase = getSupabase();

  // Current user's profile (division, department, job title, department head id)
  const { data: me } = await supabase
    .from("employees")
    .select("employee_id, full_name, email, job_title, division_id, division_name, department_id, department_name, department_head_system_user_id")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .maybeSingle();

  if (me) {
    let divisionHead: ReportingPerson | null = null;
    if (me.department_head_system_user_id) {
      const { data: headRow } = await supabase
        .from("employees")
        .select("employee_id, full_name, email, job_title")
        .eq("employee_id", me.department_head_system_user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (headRow) {
        divisionHead = {
          employee_id: headRow.employee_id,
          full_name: headRow.full_name ?? null,
          email: headRow.email ?? null,
          job_title: headRow.job_title ?? null,
        };
      }
    }
    result.currentUserProfile = {
      division_id: me.division_id ?? null,
      division_name: me.division_name ?? null,
      department_id: me.department_id ?? null,
      department_name: me.department_name ?? null,
      job_title: me.job_title ?? null,
      divisionHead,
    };
  }

  // Direct reports: reporting_lines where manager_employee_id = employeeId
  const { data: reportToMe, error: r1 } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", employeeId)
    .eq("is_primary", true);

  if (!r1 && reportToMe?.length) {
    const ids = [...new Set(reportToMe.map((r) => r.employee_id))];
    const { data: employees } = await supabase
      .from("employees")
      .select("employee_id, full_name, email, job_title")
      .in("employee_id", ids);
    result.directReports = (employees ?? []).map((e) => ({
      employee_id: e.employee_id,
      full_name: e.full_name ?? null,
      email: e.email ?? null,
      job_title: e.job_title ?? null,
    }));
  }

  // My manager(s): reporting_lines where employee_id = employeeId
  const { data: myManagers, error: r2 } = await supabase
    .from("reporting_lines")
    .select("manager_employee_id")
    .eq("employee_id", employeeId)
    .eq("is_primary", true);

  if (!r2 && myManagers?.length) {
    const managerIds = [...new Set(myManagers.map((r) => r.manager_employee_id))];
    const { data: employees } = await supabase
      .from("employees")
      .select("employee_id, full_name, email, job_title")
      .in("employee_id", managerIds);
    result.managers = (employees ?? []).map((e) => ({
      employee_id: e.employee_id,
      full_name: e.full_name ?? null,
      email: e.email ?? null,
      job_title: e.job_title ?? null,
    }));
  }

  return result;
}

function xrm1ToReportingPerson(emp: Xrm1Employee): ReportingPerson {
  const fullName =
    emp.xrm1_fullname ??
    ([emp.xrm1_first_name, emp.xrm1_last_name].filter(Boolean).join(" ").trim() || null);
  return {
    employee_id: emp.xrm1_employeeid,
    full_name: fullName,
    email: emp.emailaddress ?? emp.internalemailaddress ?? null,
    job_title: emp.xrm1_job_title ?? null,
  };
}

/** Fetch direct reports for a given xrm1_employeeid (for nested expand on reporting page). */
export async function getDirectReportsForEmployee(employeeId: string): Promise<ReportingPerson[]> {
  const reports = await getDirectReports(employeeId);
  return reports.map(xrm1ToReportingPerson);
}

/**
 * Get reporting structure from Dynamics 365 xrm1_employee entity (no reporting_lines).
 * Resolves current user: systemusers (internalemailaddress) → systemuserid → xrm1_employees
 * (_xrm1_employee_user_id_value), then fetches manager, direct reports, division head.
 */
export async function getReportingStructureFromDynamics(
  systemUserId: string | null | undefined,
  email: string | null | undefined
): Promise<ReportingStructure> {
  const result: ReportingStructure = {
    employee_id: null,
    currentUserSystemUserId: null,
    currentUserProfile: null,
    directReports: [],
    managers: [],
  };
  if (!systemUserId && !email?.trim()) return result;

  let emp: Xrm1Employee | null = null;
  try {
    if (systemUserId) {
      emp = await getEmployeeBySystemUserId(systemUserId);
      if (process.env.NODE_ENV === "development") {
        console.log("[reporting-structure] systemUserId path:", emp ? "xrm1_employee found" : "no xrm1_employee for that system user id");
      }
    }
    if (!emp && email?.trim()) {
      const systemUser = await fetchOneSystemUserByEmail(email);
      const sid = systemUser?.systemuserid != null ? String(systemUser.systemuserid).replace(/^\{|\}$/g, "") : null;
      if (process.env.NODE_ENV === "development") {
        console.log("[reporting-structure] email path: systemusers lookup", systemUser ? `systemuserid=${sid}` : "no system user for email");
      }
      if (sid) {
        emp = await getEmployeeBySystemUserId(sid);
        if (process.env.NODE_ENV === "development") {
          console.log("[reporting-structure] xrm1_employee by _xrm1_employee_user_id_value:", emp ? "found" : "not found");
        }
      }
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const isNetworkError = code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENETUNREACH";
    if (process.env.NODE_ENV === "development" && !isNetworkError) {
      const axiosErr = err as { response?: { data?: unknown } };
      console.warn("[reporting-structure] getReportingStructureFromDynamics failed:", (err as Error)?.message ?? err);
      if (axiosErr.response?.data != null) {
        console.log("Dataverse error:", JSON.stringify(axiosErr.response.data, null, 2));
      }
    }
    return result;
  }

  if (!emp) return result;

  result.employee_id = emp.xrm1_employeeid;
  const sysUserId = emp._xrm1_employee_user_id_value ?? systemUserId ?? null;
  result.currentUserSystemUserId = sysUserId ? String(sysUserId).replace(/^\{|\}$/g, "") : null;
  const divisionId = emp._dbjhr_divisions_value ?? null;

  let divisionHead: ReportingPerson | null = null;
  const empSystemUserId = emp._xrm1_employee_user_id_value ?? systemUserId ?? null;
  if (empSystemUserId) {
    try {
      const departmentHead = await getDepartmentHeadFromDepartmentTable(empSystemUserId);
      if (departmentHead) divisionHead = xrm1ToReportingPerson(departmentHead);
    } catch {
      // ignore
    }
  }
  if (!divisionHead && divisionId) {
    try {
      const head = await getDivisionHead(divisionId);
      if (head) divisionHead = xrm1ToReportingPerson(head);
    } catch {
      // ignore
    }
  }

  const empRecord = emp as Record<string, unknown>;
  const divisionName = empRecord["_dbjhr_divisions_value@OData.Community.Display.V1.FormattedValue"] as string | undefined;
  const departmentName = empRecord["_xrm1_employee_department_id_value@OData.Community.Display.V1.FormattedValue"] as string | undefined;
  result.currentUserProfile = {
    division_id: divisionId,
    division_name: divisionName ?? null,
    department_id: emp._xrm1_employee_department_id_value ?? null,
    department_name: departmentName ?? null,
    job_title: emp.xrm1_job_title ?? null,
    divisionHead,
  };

  try {
    const [manager, directReports] = await Promise.all([
      getManager(emp.xrm1_employeeid),
      getDirectReports(emp.xrm1_employeeid),
    ]);
    if (manager) result.managers = [xrm1ToReportingPerson(manager)];
    result.directReports = directReports.map(xrm1ToReportingPerson);
  } catch {
    // leave managers/directReports empty
  }

  return result;
}
