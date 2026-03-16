import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export interface ParticipantCycleProgress {
  cycle_id: string;
  cycle_name: string;
  status: string;
  end_date: string | null;
  start_date: string | null;
  peers_total: number;
  peers_submitted: number;
  direct_reports_total: number;
  direct_reports_submitted: number;
  self_status: "Pending" | "Submitted";
}

/**
 * Get 360 dashboard data for a participant: cycles where they are in feedback_participant,
 * with review progress (Peers X of Y, Direct Reports X of Y, Self Review Pending/Submitted).
 */
export async function getParticipantFeedbackDashboard(
  employeeId: string | null | undefined
): Promise<ParticipantCycleProgress[]> {
  if (!employeeId) return [];

  const supabase = getSupabase();

  const { data: participations, error: partErr } = await supabase
    .from("feedback_participant")
    .select("cycle_id")
    .eq("employee_id", employeeId);

  if (partErr || !participations?.length) return [];

  const cycleIds = [...new Set(participations.map((p) => p.cycle_id))];

  const { data: cycles, error: cycleErr } = await supabase
    .from("feedback_cycle")
    .select("id, cycle_name, status, start_date, end_date")
    .in("id", cycleIds)
    .order("end_date", { ascending: false });

  if (cycleErr || !cycles?.length) return [];

  const result: ParticipantCycleProgress[] = [];

  for (const cycle of cycles) {
    const { data: reviewers } = await supabase
      .from("feedback_reviewer")
      .select("id, reviewer_type, status")
      .eq("cycle_id", cycle.id)
      .eq("participant_employee_id", employeeId);

    let peers_total = 0;
    let peers_submitted = 0;
    let direct_reports_total = 0;
    let direct_reports_submitted = 0;
    let self_status: "Pending" | "Submitted" = "Pending";

    for (const r of reviewers ?? []) {
      const type = r.reviewer_type as string;
      const submitted = r.status === "Submitted";
      if (type === "PEER") {
        peers_total++;
        if (submitted) peers_submitted++;
      } else if (type === "DIRECT_REPORT") {
        direct_reports_total++;
        if (submitted) direct_reports_submitted++;
      } else if (type === "SELF") {
        self_status = submitted ? "Submitted" : "Pending";
      }
    }

    result.push({
      cycle_id: cycle.id,
      cycle_name: cycle.cycle_name,
      status: cycle.status as string,
      end_date: cycle.end_date,
      start_date: cycle.start_date,
      peers_total,
      peers_submitted,
      direct_reports_total,
      direct_reports_submitted,
      self_status,
    });
  }

  return result;
}
