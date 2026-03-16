import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EVIDENCE_WEIGHTS } from "./evidence-weights";

function fingerprint(
  source: string,
  activityType: string,
  title: string,
  activityDate: string,
  referenceUrl: string
): string {
  const raw = [source, activityType, title, activityDate, referenceUrl ?? ""].join("|");
  return createHash("md5").update(raw).digest("hex");
}

export async function collectAppraisalEvidence(
  supabase: SupabaseClient,
  employeeId: string,
  appraisalId: string,
  reviewStart: string,
  reviewEnd: string
): Promise<{ collected: number; diagnosis: { workplanItemsConsidered: number; rowsWithActualResult: number; rowsTaskOnly: number; activityDateRange: string; stored: number } }> {
  const { data: workplan } = await supabase
    .from("workplans")
    .select("id")
    .eq("appraisal_id", appraisalId)
    .maybeSingle();
  if (!workplan) {
    const emptyDiagnosis = {
      workplanItemsConsidered: 0,
      rowsWithActualResult: 0,
      rowsTaskOnly: 0,
      activityDateRange: "–",
      stored: 0,
    };
    return { collected: 0, diagnosis: emptyDiagnosis };
  }

  const { data: items } = await supabase
    .from("workplan_items")
    .select("id, major_task, key_output, individual_objective, actual_result, created_at, updated_at")
    .eq("workplan_id", workplan.id);

  const today = new Date().toISOString().slice(0, 10);
  const workplanItems = items ?? [];
  let withActualResult = 0;
  let withTaskOnly = 0;
  let minDate = "";
  let maxDate = "";

  const rows: Array<{
    employee_id: string;
    source_system: string;
    activity_type: string;
    title: string;
    description: string | null;
    activity_date: string;
    reference_url: string | null;
    related_goal_id: string | null;
    confidence_weight: number;
    fingerprint: string;
  }> = [];

  for (const wi of workplanItems) {
    const activityDate =
      (wi as { updated_at?: string }).updated_at != null
        ? (wi as { updated_at: string }).updated_at.slice(0, 10)
        : reviewEnd > today
          ? today
          : reviewEnd;

    const hasActualResult = wi.actual_result != null && String(wi.actual_result).trim() !== "";
    const taskTitle = [wi.individual_objective, wi.major_task].filter(Boolean).join(": ").trim() || "Workplan item";
    const refUrl = `/appraisals/${appraisalId}`;

    if (hasActualResult) {
      withActualResult++;
      if (!minDate || activityDate < minDate) minDate = activityDate;
      if (!maxDate || activityDate > maxDate) maxDate = activityDate;
      const act = "goal_milestone_completed";
      const w = EVIDENCE_WEIGHTS[act] ?? 50;
      const fp = fingerprint("appraisal", act, taskTitle, activityDate, refUrl);
      rows.push({
        employee_id: employeeId,
        source_system: "appraisal",
        activity_type: act,
        title: taskTitle,
        description: wi.key_output ?? null,
        activity_date: activityDate,
        reference_url: refUrl,
        related_goal_id: wi.id,
        confidence_weight: w,
        fingerprint: fp,
      });
    } else if ((wi.major_task ?? "").trim()) {
      withTaskOnly++;
      if (!minDate || activityDate < minDate) minDate = activityDate;
      if (!maxDate || activityDate > maxDate) maxDate = activityDate;
      const act = "task_completed";
      const w = EVIDENCE_WEIGHTS[act] ?? 50;
      const fp = fingerprint("appraisal", act, taskTitle, activityDate, refUrl);
      rows.push({
        employee_id: employeeId,
        source_system: "appraisal",
        activity_type: act,
        title: taskTitle,
        description: wi.key_output ?? null,
        activity_date: activityDate,
        reference_url: refUrl,
        related_goal_id: wi.id,
        confidence_weight: w,
        fingerprint: fp,
      });
    }
  }

  const stored = rows.length;
  if (stored > 0) {
    const { error } = await supabase
      .from("evidence_items")
      .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true });
    if (error) throw error;
  }

  const activityDateRange = minDate && maxDate ? `${minDate} – ${maxDate}` : "–";
  console.log(
    `[appraisal-collector] workplanItems=${workplanItems.length} | withActualResult=${withActualResult} | withTaskOnly=${withTaskOnly} | stored=${stored} | dateRange=${activityDateRange}`
  );

  return {
    collected: stored,
    diagnosis: {
      workplanItemsConsidered: workplanItems.length,
      rowsWithActualResult: withActualResult,
      rowsTaskOnly: withTaskOnly,
      activityDateRange,
      stored,
    },
  };
}
