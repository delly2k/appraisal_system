import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEligibleEmployeesForAppraisal } from "@/lib/dynamics-org-service";

/**
 * Appraisal generation service.
 * Creates draft appraisal records for employees eligible in Dynamics when a cycle opens.
 * Eligibility: statecode=0, xrm1_employee_type=693100000, _xrm1_employee_user_id_value ne null (optional: not terminated).
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  return createClient(url, key);
}

export interface GenerateResult {
  cycleName: string;
  appraisalsCreated: number;
}

/**
 * Generate appraisal records for employees eligible in Dynamics (filter at generation time).
 * Creates one ANNUAL appraisal per eligible employee per cycle. Skips if one already exists.
 * Only employees that exist in Supabase `employees` are included (FK and is_management trigger).
 * Manager and division come from Dynamics xrm1_employees; is_management set by DB trigger from employees.
 */
export async function generateAppraisalsForCycle(
  cycleId: string
): Promise<GenerateResult> {
  const supabase = getSupabaseAdmin();

  const { data: cycle, error: cycleError } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .eq("id", cycleId)
    .single();

  if (cycleError || !cycle) {
    throw new Error(
      cycleError?.message ?? "Appraisal cycle not found"
    );
  }

  const eligibleXrm = await getEligibleEmployeesForAppraisal({
    includeTerminationCheck: true,
  });

  const xrmIdToSystemUserId = new Map<string, string>();
  for (const e of eligibleXrm) {
    if (e._xrm1_employee_user_id_value) {
      xrmIdToSystemUserId.set(e.xrm1_employeeid, e._xrm1_employee_user_id_value);
    }
  }

  const eligibleList = eligibleXrm
    .filter((e) => e._xrm1_employee_user_id_value)
    .map((e) => ({
      employee_id: e._xrm1_employee_user_id_value!,
      division_id: e._dbjhr_divisions_value ?? null,
      manager_employee_id: e._xrm1_manager_employee_id_value
        ? xrmIdToSystemUserId.get(e._xrm1_manager_employee_id_value) ?? null
        : null,
    }));

  if (eligibleList.length === 0) {
    return { cycleName: cycle.name, appraisalsCreated: 0 };
  }

  const eligibleIds = eligibleList.map((e) => e.employee_id);
  const { data: existingEmployees, error: empError } = await supabase
    .from("employees")
    .select("employee_id")
    .in("employee_id", eligibleIds);

  if (empError) {
    throw new Error(`Failed to load employees: ${empError.message}`);
  }

  const existingEmployeeIds = new Set(
    (existingEmployees ?? []).map((r) => r.employee_id)
  );
  const employees = eligibleList.filter((e) => existingEmployeeIds.has(e.employee_id));

  if (!employees.length) {
    return { cycleName: cycle.name, appraisalsCreated: 0 };
  }

  const managerByEmployee = new Map<string, string | null>();
  for (const e of employees) {
    managerByEmployee.set(e.employee_id, e.manager_employee_id);
  }

  const { data: existingRows } = await supabase
    .from("appraisals")
    .select("employee_id")
    .eq("cycle_id", cycleId)
    .eq("review_type", "annual");

  const hasExisting = new Set((existingRows ?? []).map((r) => r.employee_id));

  const rows: Array<{
    cycle_id: string;
    employee_id: string;
    manager_employee_id: string | null;
    division_id: string | null;
    review_type: string;
    status: string;
    purpose: string;
    is_active: boolean;
  }> = [];

  for (const e of employees) {
    if (hasExisting.has(e.employee_id)) continue;
    rows.push({
      cycle_id: cycleId,
      employee_id: e.employee_id,
      manager_employee_id: managerByEmployee.get(e.employee_id) ?? null,
      division_id: e.division_id ?? null,
      review_type: "annual",
      status: "DRAFT",
      purpose: "end_of_year",
      is_active: true,
    });
  }

  if (rows.length === 0) {
    return { cycleName: cycle.name, appraisalsCreated: 0 };
  }

  const { error: insertError } = await supabase
    .from("appraisals")
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to create appraisals: ${insertError.message}`);
  }

  return {
    cycleName: cycle.name,
    appraisalsCreated: rows.length,
  };
}
