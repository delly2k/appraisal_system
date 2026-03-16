import { createClient } from "@supabase/supabase-js";
import {
  fetchOneEmployeeByEmail,
  fetchOneEmployeeByAadObjectId,
  mapToEmployeeRow,
  type DataverseEmployeeRecord,
} from "@/lib/dynamics-sync";

/**
 * Resolves the authenticated user (Entra ID session) to a Dynamics 365 HR employee.
 * Queries Dataverse by email or AAD object ID, upserts into local employees table,
 * ensures reporting line for manager, and returns the employee profile.
 * Uses the existing Dynamics service connection (client credentials); no second login.
 */

export interface ResolvedEmployeeProfile {
  employeeId: string;
  fullName: string | null;
  email: string | null;
  jobTitle: string | null;
  divisionId: string | null;
  divisionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
}

export interface AuthUserLike {
  email?: string | null;
  name?: string | null;
  id?: string | null;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and service role key required for user resolution");
  return createClient(url, key);
}

/**
 * Resolve the current authenticated user to an HR employee from Dynamics 365.
 * 1. Query Dataverse by email (then AAD object ID if needed).
 * 2. Upsert the employee into the local employees table.
 * 3. Ensure a reporting line exists if the employee has a manager.
 * 4. Return the employee profile.
 */
export async function resolveUserFromDynamics(authUser: AuthUserLike): Promise<ResolvedEmployeeProfile | null> {
  const email = authUser.email?.trim();
  const aadObjectId = typeof authUser.id === "string" ? authUser.id.trim() : null;

  if (!email && !aadObjectId) return null;

  let record: DataverseEmployeeRecord | null = null;
  if (email) {
    record = await fetchOneEmployeeByEmail(email);
  }
  if (!record && aadObjectId) {
    record = await fetchOneEmployeeByAadObjectId(aadObjectId);
  }
  if (!record) return null;

  const row = mapToEmployeeRow(record);
  if (!row) return null;

  const supabase = getSupabase();
  const { error: upsertError } = await supabase.from("employees").upsert(row, { onConflict: "employee_id" });
  if (upsertError) throw new Error(`Failed to upsert employee: ${upsertError.message}`);

  const managerId = record.parentsystemuserid ? String(record.parentsystemuserid) : null;
  if (managerId) {
    const { data: existing } = await supabase
      .from("reporting_lines")
      .select("id")
      .eq("employee_id", row.employee_id)
      .eq("manager_employee_id", managerId)
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const now = new Date().toISOString();
      const { error: insertError } = await supabase.from("reporting_lines").insert({
        employee_id: row.employee_id,
        manager_employee_id: managerId,
        is_primary: true,
        effective_from: null,
        effective_to: null,
        last_synced_at: now,
      });
      if (insertError && insertError.code !== "23503") {
        console.warn("Reporting line insert skipped:", insertError.message);
      }
    }
  }

  return {
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
    divisionId: row.division_id,
    divisionName: row.division_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    managerId,
  };
}
