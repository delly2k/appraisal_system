import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface PerformanceHistoryItem {
  appraisal_id: string;
  cycle_id: string;
  cycle_name: string;
  cycle_type: string;
  fiscal_year: string;
  end_date: string;
  status: string;
  total_score: number | null;
  final_rating: string | null;
  manager_recommendation: string | null;
  manager_justification: string | null;
  hr_final_decision: string | null;
  competency_score: number | null;
  productivity_score: number | null;
  leadership_score: number | null;
  workplan_score: number | null;
}

export async function getPerformanceHistory(
  employeeId: string | null | undefined
): Promise<PerformanceHistoryItem[]> {
  if (!employeeId) return [];

  const supabase = getSupabase();

  const { data: appraisals } = await supabase
    .from("appraisals")
    .select("id, cycle_id, status")
    .eq("employee_id", employeeId)
    .in("status", [
      "manager_completed",
      "employee_acknowledged",
      "hr_in_review",
      "closed",
    ])
    .order("created_at", { ascending: false });

  if (!appraisals?.length) return [];

  const cycleIds = [...new Set(appraisals.map((a) => a.cycle_id).filter(Boolean))];
  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name, cycle_type, fiscal_year, end_date")
    .in("id", cycleIds);
  const cycleMap = new Map(
    (cycles ?? []).map((c) => [c.id, c as { id: string; name: string; cycle_type: string; fiscal_year: string; end_date: string }])
  );

  const appraisalIds = appraisals.map((a) => a.id);
  const { data: scores } = await supabase
    .from("appraisal_section_scores")
    .select(
      "appraisal_id, total_score, final_rating, competency_score, productivity_score, leadership_score, workplan_score"
    )
    .in("appraisal_id", appraisalIds);
  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.appraisal_id, s])
  );

  const { data: recs } = await supabase
    .from("appraisal_recommendations")
    .select(
      "appraisal_id, manager_recommendation, manager_justification, hr_final_decision"
    )
    .in("appraisal_id", appraisalIds);
  const recMap = new Map(
    (recs ?? []).map((r) => [r.appraisal_id, r])
  );

  const result: PerformanceHistoryItem[] = appraisals.map((a) => {
    const cycle = cycleMap.get(a.cycle_id);
    const sc = scoreMap.get(a.id);
    const rec = recMap.get(a.id);
    return {
      appraisal_id: a.id,
      cycle_id: a.cycle_id,
      cycle_name: cycle?.name ?? "—",
      cycle_type: cycle?.cycle_type ?? "—",
      fiscal_year: cycle?.fiscal_year ?? "—",
      end_date: cycle?.end_date ?? "",
      status: a.status ?? "",
      total_score: sc?.total_score != null ? Number(sc.total_score) : null,
      final_rating: sc?.final_rating ?? null,
      manager_recommendation: rec?.manager_recommendation ?? null,
      manager_justification: rec?.manager_justification ?? null,
      hr_final_decision: rec?.hr_final_decision ?? null,
      competency_score:
        sc?.competency_score != null ? Number(sc.competency_score) : null,
      productivity_score:
        sc?.productivity_score != null ? Number(sc.productivity_score) : null,
      leadership_score:
        sc?.leadership_score != null ? Number(sc.leadership_score) : null,
      workplan_score:
        sc?.workplan_score != null ? Number(sc.workplan_score) : null,
    };
  });

  return result;
}
