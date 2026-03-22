import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Managers eligible for 360 participation: distinct manager_employee_id where there is at least one
 * primary reporting line whose report (employee_id) is an active employee — same rule as
 * DIRECT_REPORT reviewers in feedback_participant_generate_reviewers (0049_360_manager_and_audit.sql)
 * and feedback_cycle_activate_participants (migration 0059).
 */
export async function getEligibleManagerEmployeeIdsForFeedback360(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data: lines, error: linesErr } = await supabase
    .from("reporting_lines")
    .select("manager_employee_id, employee_id")
    .eq("is_primary", true);

  if (linesErr) throw new Error(linesErr.message);

  const { data: activeRows, error: actErr } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("is_active", true);

  if (actErr) throw new Error(actErr.message);

  const activeEmployeeIds = new Set(
    (activeRows ?? []).map((r) => r.employee_id as string).filter(Boolean)
  );

  const managerIds = new Set<string>();
  for (const row of lines ?? []) {
    const mid = row.manager_employee_id as string | null | undefined;
    const eid = row.employee_id as string | null | undefined;
    if (mid && eid && activeEmployeeIds.has(eid)) managerIds.add(mid);
  }

  return [...managerIds];
}

/**
 * Mirrors DB logic in feedback_cycle_activate_participants (see migration 0059).
 */
export async function backfillFeedbackParticipantsFromReportingLines(
  supabase: SupabaseClient,
  cycleId: string
): Promise<{ inserted: number }> {
  const managerIds = await getEligibleManagerEmployeeIdsForFeedback360(supabase);

  if (managerIds.length === 0) return { inserted: 0 };

  const { data: emps, error: empsErr } = await supabase
    .from("employees")
    .select("employee_id, department_id")
    .in("employee_id", managerIds)
    .eq("is_active", true);

  if (empsErr) throw new Error(empsErr.message);

  const { data: existing, error: exErr } = await supabase
    .from("feedback_participant")
    .select("employee_id")
    .eq("cycle_id", cycleId);

  if (exErr) throw new Error(exErr.message);

  const existingSet = new Set((existing ?? []).map((p) => p.employee_id as string));

  const rows = (emps ?? [])
    .filter((e) => !existingSet.has(e.employee_id as string))
    .map((e) => ({
      cycle_id: cycleId,
      employee_id: e.employee_id as string,
      department_id: (e.department_id as string | null) ?? null,
      status: "Pending",
    }));

  if (rows.length === 0) return { inserted: 0 };

  const { error: insErr } = await supabase.from("feedback_participant").insert(rows);

  if (insErr) throw new Error(insErr.message);

  return { inserted: rows.length };
}

export async function countFeedbackParticipants(
  supabase: SupabaseClient,
  cycleId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("feedback_participant")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycleId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
