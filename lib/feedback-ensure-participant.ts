import { createClient } from "@supabase/supabase-js";
import { getReportingStructureFromDynamics } from "@/lib/reporting-structure";
import { autoAssignReviewers } from "@/lib/feedback-auto-assign";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Ensure the given employee is a feedback participant for the cycle if they have
 * anybody reporting to them (Dynamics). Uses the same resolution as "My Team's Appraisals":
 * getReportingStructureFromDynamics so employeeId (system user id) is resolved to xrm1_employeeid
 * and direct reports are loaded from Dynamics. Does not use reporting_lines.
 */
export async function ensureParticipantIfLeader(
  cycleId: string,
  employeeId: string,
  email?: string | null
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const structure = await getReportingStructureFromDynamics(employeeId, email ?? null);
    if (!structure.directReports?.length) return;

    const { data: emp } = await supabase
      .from("employees")
      .select("department_id")
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .maybeSingle();

    await supabase.from("feedback_participant").upsert(
      {
        cycle_id: cycleId,
        employee_id: employeeId,
        department_id: emp?.department_id ?? null,
        status: "Pending",
      },
      { onConflict: "cycle_id,employee_id" }
    );

    await autoAssignReviewers(supabase, cycleId, employeeId);
  } catch {
    // Dynamics or DB failure: do not block the page; leave participant list as-is
  }
}
