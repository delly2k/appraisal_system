import { createClient } from "@supabase/supabase-js";

/**
 * Server-side data for manager review list.
 * Returns appraisals for employees who report to the given manager (via reporting_lines).
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface ManagerReviewListItem {
  appraisalId: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  status: string;
  departmentName: string;
}

export async function getManagerReviewList(
  managerEmployeeId: string | null | undefined
): Promise<ManagerReviewListItem[]> {
  if (!managerEmployeeId) return [];

  const supabase = getSupabase();

  const { data: lines, error: rlError } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", managerEmployeeId)
    .eq("is_primary", true);

  if (rlError || !lines?.length) return [];

  const employeeIds = [...new Set(lines.map((r) => r.employee_id))];

  const { data: appraisals, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id, status")
    .in("employee_id", employeeIds)
    .order("created_at", { ascending: false });

  if (appError || !appraisals?.length) return [];

  const empIds = [...new Set(appraisals.map((a) => a.employee_id))];
  const cycleIds = [...new Set(appraisals.map((a) => a.cycle_id))];

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, department_name")
    .in("employee_id", empIds);
  const nameByEmployeeId = new Map(
    (employees ?? []).map((e) => [e.employee_id, e.full_name ?? "—"])
  );
  const departmentByEmployeeId = new Map(
    (employees ?? []).map((e) => [
      e.employee_id,
      (e as { department_name?: string | null }).department_name ?? "—",
    ])
  );

  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .in("id", cycleIds);
  const nameByCycleId = new Map((cycles ?? []).map((c) => [c.id, c.name]));

  return appraisals.map((a) => ({
    appraisalId: a.id,
    employeeId: a.employee_id,
    employeeName: nameByEmployeeId.get(a.employee_id) ?? "—",
    cycleId: a.cycle_id,
    cycleName: nameByCycleId.get(a.cycle_id) ?? "—",
    status: (a.status as string) ?? "DRAFT",
    departmentName: departmentByEmployeeId.get(a.employee_id) ?? "—",
  }));
}
