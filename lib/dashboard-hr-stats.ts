import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface ScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  barColor?: string;
  anomaly?: boolean;
}

export interface DivisionBreakdownRow {
  division: string;
  employees: number;
  avgScore: number | null;
  completed: number;
  inProgress: number;
}

export interface RecentActivityItem {
  employeeName: string;
  initials: string;
  toStatus: string;
  cycleName: string;
  at: string;
}

export interface HrDashboardStats {
  total_employees: number;
  appraisals_by_stage: Record<string, number>;
  score_distribution: ScoreDistributionBucket[];
  mean_score: number | null;
  std_deviation: number;
  division_breakdown: DivisionBreakdownRow[];
  recent_activity: RecentActivityItem[];
  active_360_cycles: number;
  appraisals_complete: number;
  pending_manager_reviews: number;
  in_progress_appraisals: number;
}

const STAGE_FILTERS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SELF_ASSESSMENT",
  "SUBMITTED",
  "MANAGER_REVIEW",
  "PENDING_SIGNOFF",
  "HR_PIPELINE",
  "COMPLETE",
] as const;

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function bucketColor(min: number): string {
  if (min >= 90) return "#10b981";
  if (min >= 70) return "#0d9488";
  if (min >= 40) return "#f59e0b";
  return "#ef4444";
}

export async function fetchHrDashboardStats(): Promise<HrDashboardStats> {
  const supabase = getSupabase();

  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("employee_id", { count: "exact", head: true })
    .eq("is_active", true);

  const { data: appraisals } = await supabase
    .from("appraisals")
    .select("id, employee_id, status, cycle_id, updated_at")
    .eq("is_active", true);

  const apps = appraisals ?? [];
  const byStage: Record<string, number> = {};
  for (const s of STAGE_FILTERS) {
    byStage[s] = 0;
  }

  for (const a of apps) {
    const st = (a.status as string) || "DRAFT";
    if (st === "HOD_REVIEW" || st === "HR_REVIEW") {
      byStage.HR_PIPELINE = (byStage.HR_PIPELINE ?? 0) + 1;
    } else if (Object.prototype.hasOwnProperty.call(byStage, st)) {
      byStage[st] = (byStage[st] ?? 0) + 1;
    }
    /* unknown legacy statuses omitted from pipeline */
  }

  const appraisalsComplete = apps.filter((a) => a.status === "COMPLETE").length;
  const pendingManager = apps.filter((a) => a.status === "MANAGER_REVIEW").length;
  const inProgress = apps.filter(
    (a) => a.status !== "DRAFT" && a.status !== "COMPLETE"
  ).length;

  const { count: active360 } = await supabase
    .from("feedback_cycle")
    .select("id", { count: "exact", head: true })
    .eq("status", "Active");

  const appraisalIds = apps.map((a) => a.id);
  let scores: number[] = [];
  if (appraisalIds.length > 0) {
    const { data: scoreRows } = await supabase
      .from("appraisal_section_scores")
      .select("appraisal_id, total_score")
      .in("appraisal_id", appraisalIds);
    scores = (scoreRows ?? [])
      .map((r) => (r.total_score != null ? Number(r.total_score) : NaN))
      .filter((n) => !Number.isNaN(n));
  }

  const meanScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const stdDeviation = stdDev(scores);

  const buckets: ScoreDistributionBucket[] = [];
  for (let min = 0; min <= 90; min += 10) {
    const max = min === 90 ? 100 : min + 9;
    const label = min === 90 ? "90+" : String(min);
    let count = 0;
    for (const sc of scores) {
      if (min === 90) {
        if (sc >= 90) count++;
      } else if (sc >= min && sc <= max) {
        count++;
      }
    }
    buckets.push({ label, min, max: min === 90 ? 100 : max, count });
  }

  const bucketCounts = buckets.map((b) => b.count);
  const meanBuckets =
    bucketCounts.length > 0
      ? bucketCounts.reduce((a, b) => a + b, 0) / bucketCounts.length
      : 0;
  const stdBuckets = stdDev(bucketCounts);

  for (const b of buckets) {
    b.barColor = bucketColor(b.min);
    if (b.count > meanBuckets + 2 * stdBuckets && bucketCounts.some((c) => c > 0)) {
      b.anomaly = true;
    }
  }

  const { data: emps } = await supabase
    .from("employees")
    .select("employee_id, division_name")
    .eq("is_active", true);

  const divisionToEmployees = new Map<string, string[]>();
  for (const e of emps ?? []) {
    const div = (e.division_name as string)?.trim() || "Unassigned";
    if (!divisionToEmployees.has(div)) divisionToEmployees.set(div, []);
    divisionToEmployees.get(div)!.push(e.employee_id as string);
  }

  const empToAppraisal = new Map<string, (typeof apps)[0][]>();
  for (const a of apps) {
    if (!empToAppraisal.has(a.employee_id)) empToAppraisal.set(a.employee_id, []);
    empToAppraisal.get(a.employee_id)!.push(a);
  }

  const scoreByAppraisal = new Map<string, number>();
  if (appraisalIds.length > 0) {
    const { data: scr } = await supabase
      .from("appraisal_section_scores")
      .select("appraisal_id, total_score")
      .in("appraisal_id", appraisalIds);
    for (const r of scr ?? []) {
      if (r.total_score != null) scoreByAppraisal.set(r.appraisal_id, Number(r.total_score));
    }
  }

  const division_breakdown: DivisionBreakdownRow[] = [];
  for (const [division, empIds] of divisionToEmployees) {
    let sum = 0;
    let n = 0;
    let completed = 0;
    let inProg = 0;
    for (const eid of empIds) {
      const list = empToAppraisal.get(eid) ?? [];
      for (const ap of list) {
        if (ap.status === "COMPLETE") completed++;
        else if (ap.status !== "DRAFT") inProg++;
        const ts = scoreByAppraisal.get(ap.id);
        if (ts != null && !Number.isNaN(ts)) {
          sum += ts;
          n++;
        }
      }
    }
    division_breakdown.push({
      division,
      employees: empIds.length,
      avgScore: n > 0 ? Math.round((sum / n) * 10) / 10 : null,
      completed,
      inProgress: inProg,
    });
  }
  division_breakdown.sort((a, b) => a.division.localeCompare(b.division));

  const { data: timeline } = await supabase
    .from("appraisal_timeline")
    .select("appraisal_id, to_status, changed_at, changed_by")
    .order("changed_at", { ascending: false })
    .limit(10);

  const recent_activity: RecentActivityItem[] = [];
  const tidAppraisalIds = [...new Set((timeline ?? []).map((t) => t.appraisal_id))];
  if (tidAppraisalIds.length > 0) {
    const { data: tApps } = await supabase
      .from("appraisals")
      .select("id, employee_id, cycle_id")
      .in("id", tidAppraisalIds);
    const { data: tEmps } = await supabase
      .from("employees")
      .select("employee_id, full_name")
      .in(
        "employee_id",
        (tApps ?? []).map((a) => a.employee_id)
      );
    const { data: tCycles } = await supabase
      .from("appraisal_cycles")
      .select("id, name")
      .in("id", [...new Set((tApps ?? []).map((a) => a.cycle_id).filter(Boolean))]);

    const nameByEmp = new Map((tEmps ?? []).map((e) => [e.employee_id, e.full_name as string]));
    const cycleName = new Map((tCycles ?? []).map((c) => [c.id, c.name as string]));
    const appById = new Map((tApps ?? []).map((a) => [a.id, a]));

    for (const row of timeline ?? []) {
      const ap = appById.get(row.appraisal_id);
      if (!ap) continue;
      const nm = nameByEmp.get(ap.employee_id) ?? ap.employee_id;
      const parts = nm.split(/\s+/).filter(Boolean);
      const initials =
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : nm.slice(0, 2).toUpperCase();
      recent_activity.push({
        employeeName: nm,
        initials,
        toStatus: row.to_status as string,
        cycleName: cycleName.get(ap.cycle_id) ?? "—",
        at: row.changed_at as string,
      });
    }
  }

  return {
    total_employees: totalEmployees ?? 0,
    appraisals_by_stage: byStage as unknown as Record<string, number>,
    score_distribution: buckets,
    mean_score: meanScore != null ? Math.round(meanScore * 10) / 10 : null,
    std_deviation: Math.round(stdDeviation * 100) / 100,
    division_breakdown,
    recent_activity,
    active_360_cycles: active360 ?? 0,
    appraisals_complete: appraisalsComplete,
    pending_manager_reviews: pendingManager,
    in_progress_appraisals: inProgress,
  };
}

export { STAGE_FILTERS };
