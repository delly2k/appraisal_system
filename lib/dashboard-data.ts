import { createClient } from "@supabase/supabase-js";

/**
 * Server-side dashboard data for the employee appraisal overview.
 * Uses Supabase; when RLS is enforced, call with a client that has the user context.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface ActiveCycle {
  id: string;
  name: string;
  cycle_type: string;
  fiscal_year: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface DashboardData {
  activeCycle: ActiveCycle | null;
  selfAssessmentPending: number;
  selfAssessmentCompleted: number;
  managerReviewPending: number;
  managerReviewCompleted: number;
  recentScores: Array<{
    appraisal_id: string;
    cycle_name: string;
    total_score: number | null;
    final_rating: string | null;
    calculated_at: string | null;
  }>;
}

export async function getDashboardData(
  employeeId: string | null | undefined
): Promise<DashboardData> {
  const supabase = getSupabase();

  const empty: DashboardData = {
    activeCycle: null,
    selfAssessmentPending: 0,
    selfAssessmentCompleted: 0,
    managerReviewPending: 0,
    managerReviewCompleted: 0,
    recentScores: [],
  };

  const { data: openCycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name, cycle_type, fiscal_year, start_date, end_date, status")
    .eq("status", "open")
    .order("end_date", { ascending: false })
    .limit(1);

  const activeCycle: ActiveCycle | null = openCycles?.[0] ?? null;

  if (!employeeId) {
    return { ...empty, activeCycle };
  }

  const { data: appraisals } = await supabase
    .from("appraisals")
    .select("id, status, cycle_id")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  let selfAssessmentPending = 0;
  let selfAssessmentCompleted = 0;
  let managerReviewPending = 0;
  let managerReviewCompleted = 0;

  for (const a of appraisals ?? []) {
    const s = a.status ?? "";
    if (s === "draft") selfAssessmentPending++;
    else if (["self_submitted", "manager_in_review", "manager_completed", "employee_acknowledged", "hr_in_review", "closed"].includes(s)) {
      selfAssessmentCompleted++;
    }
    if (["self_submitted", "manager_in_review"].includes(s)) managerReviewPending++;
    else if (["manager_completed", "employee_acknowledged", "hr_in_review", "closed"].includes(s)) managerReviewCompleted++;
  }

  const appraisalIds = (appraisals ?? []).map((a) => a.id);
  let recentScores: DashboardData["recentScores"] = [];

  if (appraisalIds.length > 0) {
    const cycleIds = [...new Set((appraisals ?? []).map((a) => a.cycle_id).filter(Boolean))];
    const { data: cycles } = cycleIds.length
      ? await supabase.from("appraisal_cycles").select("id, name").in("id", cycleIds)
      : { data: [] };
    const cycleNameById = new Map((cycles ?? []).map((c) => [c.id, c.name]));
    const appraisalIdToCycleId = new Map((appraisals ?? []).map((a) => [a.id, a.cycle_id]));

    const { data: scoresRows } = await supabase
      .from("appraisal_section_scores")
      .select("appraisal_id, total_score, final_rating, calculated_at")
      .in("appraisal_id", appraisalIds)
      .order("calculated_at", { ascending: false })
      .limit(5);

    for (const row of scoresRows ?? []) {
      const cycleId = appraisalIdToCycleId.get(row.appraisal_id);
      recentScores.push({
        appraisal_id: row.appraisal_id,
        cycle_name: cycleId ? cycleNameById.get(cycleId) ?? "—" : "—",
        total_score: row.total_score != null ? Number(row.total_score) : null,
        final_rating: row.final_rating,
        calculated_at: row.calculated_at,
      });
    }
  }

  return {
    activeCycle,
    selfAssessmentPending,
    selfAssessmentCompleted,
    managerReviewPending,
    managerReviewCompleted,
    recentScores,
  };
}
