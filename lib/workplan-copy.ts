import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Copy the previous cycle's workplan into the current appraisal.
 * Creates or uses the target workplan, copies all items with actual_result and points reset.
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

export interface CopyPreviousResult {
  copiedItems: number;
}

/**
 * Copy the employee's previous appraisal workplan into the workplan for appraisalId.
 * 1. Find the employee's previous appraisal (same employee, earlier cycle).
 * 2. Locate its workplan and copy all workplan_items to the current appraisal's workplan.
 * 3. Reset actual_result and points on copied items; set workplan status to draft.
 */
export async function copyPreviousWorkplan(
  appraisalId: string
): Promise<CopyPreviousResult> {
  const supabase = getSupabaseAdmin();

  const { data: appraisal, error: appraisalError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id")
    .eq("id", appraisalId)
    .single();

  if (appraisalError || !appraisal) {
    throw new Error(appraisalError?.message ?? "Appraisal not found");
  }

  const { data: currentCycle, error: cycleError } = await supabase
    .from("appraisal_cycles")
    .select("start_date")
    .eq("id", appraisal.cycle_id)
    .single();

  if (cycleError || !currentCycle) {
    throw new Error("Appraisal cycle not found");
  }

  const { data: previousCycles } = await supabase
    .from("appraisal_cycles")
    .select("id")
    .lt("end_date", currentCycle.start_date)
    .order("end_date", { ascending: false })
    .limit(1);

  const previousCycleId = previousCycles?.[0]?.id;
  if (!previousCycleId) {
    return { copiedItems: 0 };
  }

  const { data: previousAppraisalRow } = await supabase
    .from("appraisals")
    .select("id")
    .eq("employee_id", appraisal.employee_id)
    .eq("cycle_id", previousCycleId)
    .single();

  if (!previousAppraisalRow) {
    return { copiedItems: 0 };
  }

  const previousAppraisal = { id: previousAppraisalRow.id };

  const { data: sourceWorkplan, error: wpError } = await supabase
    .from("workplans")
    .select("id")
    .eq("appraisal_id", previousAppraisal.id)
    .single();

  if (wpError || !sourceWorkplan) {
    return { copiedItems: 0 };
  }

  const { data: sourceItems, error: itemsError } = await supabase
    .from("workplan_items")
    .select(
      "corporate_objective, division_objective, individual_objective, task, output, performance_standard, weight"
    )
    .eq("workplan_id", sourceWorkplan.id);

  if (itemsError || !sourceItems?.length) {
    return { copiedItems: 0 };
  }

  let targetWorkplan = await supabase
    .from("workplans")
    .select("id")
    .eq("appraisal_id", appraisalId)
    .single();

  if (targetWorkplan.error || !targetWorkplan.data) {
    const { data: created, error: createError } = await supabase
      .from("workplans")
      .insert({
        appraisal_id: appraisalId,
        status: "draft",
        version: 1,
        copied_from_workplan_id: sourceWorkplan.id,
      })
      .select("id")
      .single();

    if (createError || !created) {
      throw new Error(
        createError?.message ?? "Failed to create target workplan"
      );
    }
    targetWorkplan = { data: created, error: null };
  } else {
    await supabase
      .from("workplans")
      .update({
        status: "draft",
        copied_from_workplan_id: sourceWorkplan.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetWorkplan.data.id);
  }

  const newWorkplanId = targetWorkplan.data!.id;
  const insertRows = sourceItems.map((item) => ({
    workplan_id: newWorkplanId,
    corporate_objective: item.corporate_objective,
    division_objective: item.division_objective,
    individual_objective: item.individual_objective,
    task: item.task,
    output: item.output,
    performance_standard: item.performance_standard,
    weight: item.weight,
    actual_result: null,
    points: null,
    version: 1,
    status: "active",
  }));

  const { error: insertError } = await supabase
    .from("workplan_items")
    .insert(insertRows);

  if (insertError) {
    throw new Error(`Failed to copy workplan items: ${insertError.message}`);
  }

  return { copiedItems: insertRows.length };
}
