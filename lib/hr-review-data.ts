import { createClient } from "@supabase/supabase-js";

/**
 * Data for HR Review Panel: appraisals ready for HR (manager_completed or later)
 * with scores and recommendations. Supports filters by cycle, division, department.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface HRReviewRow {
  appraisalId: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  divisionId: string | null;
  divisionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
  totalScore: number | null;
  systemRecommendation: string | null;
  managerOverride: boolean;
  managerRecommendation: string | null;
  managerJustification: string | null;
  hrFinalDecision: string | null;
  hrDecidedBy: string | null;
  hrDecidedAt: string | null;
}

export interface HRReviewFilters {
  cycleId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
}

export async function getHRReviewList(
  filters: HRReviewFilters = {}
): Promise<HRReviewRow[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("appraisals")
    .select(
      "id, employee_id, cycle_id, division_id, status"
    )
    .in("status", [
      "manager_completed",
      "employee_acknowledged",
      "hr_in_review",
      "closed",
    ]);

  if (filters.cycleId) {
    query = query.eq("cycle_id", filters.cycleId);
  }
  if (filters.divisionId) {
    query = query.eq("division_id", filters.divisionId);
  }

  const { data: appraisals, error: appError } = await query.order(
    "manager_completed_at",
    { ascending: false }
  );

  if (appError || !appraisals?.length) return [];

  const appraisalIds = appraisals.map((a) => a.id);
  const employeeIds = [...new Set(appraisals.map((a) => a.employee_id))];
  const cycleIds = [...new Set(appraisals.map((a) => a.cycle_id))];

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, division_id, division_name, department_id, department_name")
    .in("employee_id", employeeIds);
  const employeeMap = new Map(
    (employees ?? []).map((e) => [
      e.employee_id,
      {
        full_name: e.full_name ?? "—",
        division_id: e.division_id ?? null,
        division_name: e.division_name ?? null,
        department_id: e.department_id ?? null,
        department_name: e.department_name ?? null,
      },
    ])
  );

  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .in("id", cycleIds);
  const cycleMap = new Map((cycles ?? []).map((c) => [c.id, c.name]));

  const { data: scores } = await supabase
    .from("appraisal_section_scores")
    .select("appraisal_id, total_score")
    .in("appraisal_id", appraisalIds);
  const scoreMap = new Map(
    (scores ?? []).map((s) => [s.appraisal_id, s.total_score != null ? Number(s.total_score) : null])
  );

  const { data: recs } = await supabase
    .from("appraisal_recommendations")
    .select(
      "appraisal_id, system_recommendation, manager_override, manager_recommendation, manager_justification, hr_final_decision, hr_decided_by, hr_decided_at"
    )
    .in("appraisal_id", appraisalIds);
  const recMap = new Map((recs ?? []).map((r) => [r.appraisal_id, r]));

  const rows: HRReviewRow[] = [];
  for (const a of appraisals) {
    const emp = employeeMap.get(a.employee_id);
    if (filters.departmentId && emp?.department_id !== filters.departmentId) {
      continue;
    }
    const rec = recMap.get(a.id);
    rows.push({
      appraisalId: a.id,
      employeeId: a.employee_id,
      employeeName: emp?.full_name ?? "—",
      cycleId: a.cycle_id,
      cycleName: cycleMap.get(a.cycle_id) ?? "—",
      divisionId: a.division_id ?? emp?.division_id ?? null,
      divisionName: emp?.division_name ?? null,
      departmentId: emp?.department_id ?? null,
      departmentName: emp?.department_name ?? null,
      status: a.status ?? "draft",
      totalScore: scoreMap.get(a.id) ?? null,
      systemRecommendation: rec?.system_recommendation ?? null,
      managerOverride: !!rec?.manager_override,
      managerRecommendation: rec?.manager_recommendation ?? null,
      managerJustification: rec?.manager_justification ?? null,
      hrFinalDecision: rec?.hr_final_decision ?? null,
      hrDecidedBy: rec?.hr_decided_by ?? null,
      hrDecidedAt: rec?.hr_decided_at ?? null,
    });
  }

  return rows;
}

export async function getHRReviewFilterOptions(): Promise<{
  cycles: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}> {
  const supabase = getSupabase();

  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .order("end_date", { ascending: false });
  const { data: divRows } = await supabase
    .from("employees")
    .select("division_id, division_name")
    .not("division_id", "is", null);
  const divisionSet = new Map<string, string>();
  for (const d of divRows ?? []) {
    if (d.division_id) divisionSet.set(d.division_id, d.division_name ?? d.division_id);
  }
  const { data: deptRows } = await supabase
    .from("employees")
    .select("department_id, department_name")
    .not("department_id", "is", null);
  const departmentSet = new Map<string, string>();
  for (const d of deptRows ?? []) {
    if (d.department_id) departmentSet.set(d.department_id, d.department_name ?? d.department_id);
  }

  return {
    cycles: (cycles ?? []).map((c) => ({ id: c.id, name: c.name })),
    divisions: [...divisionSet.entries()].map(([id, name]) => ({ id, name })),
    departments: [...departmentSet.entries()].map(([id, name]) => ({ id, name })),
  };
}
