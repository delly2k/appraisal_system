import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seed 360 participants: distinct `manager_employee_id` values from the `appraisals` table
 * (read-only). Each such id is a manager for at least one appraisal row.
 */
export async function seedParticipantsFromManagerHierarchy(
  supabase: SupabaseClient,
  cycleId: string
): Promise<{ inserted: number; skipped: number }> {
  console.log("[360 seed] Querying appraisals table for distinct manager_employee_ids...");

  const { data: managerRows, error } = await supabase
    .from("appraisals")
    .select("manager_employee_id")
    .not("manager_employee_id", "is", null);

  if (error) {
    console.error("[360 seed] Error querying appraisals:", error);
    return { inserted: 0, skipped: 0 };
  }

  const managerIds = [
    ...new Set(
      (managerRows ?? [])
        .map((r) => r.manager_employee_id as string | null | undefined)
        .filter((id): id is string => Boolean(id && String(id).trim()))
    ),
  ];

  console.log(`[360 seed] Found ${managerIds.length} unique managers from appraisals table`);

  if (!managerIds.length) {
    console.warn("[360 seed] No manager_employee_id values found in appraisals table");
    return { inserted: 0, skipped: 0 };
  }

  const { error: deleteError } = await supabase
    .from("feedback_participant")
    .delete()
    .eq("cycle_id", cycleId);

  if (deleteError) {
    console.error("[360 seed] Delete error:", deleteError);
    return { inserted: 0, skipped: managerIds.length };
  }

  const rows = managerIds.map((id) => ({
    cycle_id: cycleId,
    employee_id: id,
    status: "Pending" as const,
  }));

  const { error: upsertError } = await supabase
    .from("feedback_participant")
    .upsert(rows, { onConflict: "cycle_id,employee_id" });

  if (upsertError) {
    console.error("[360 seed] Upsert error:", upsertError);
    return { inserted: 0, skipped: managerIds.length };
  }

  console.log(`[360 seed] SUCCESS: seeded ${managerIds.length} managers as participants`);
  return { inserted: managerIds.length, skipped: 0 };
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
