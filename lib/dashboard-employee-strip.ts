import { createClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

/** 8-step DBJ flow (indices 0–7). */
export const DASHBOARD_WORKFLOW_ORDER = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SELF_ASSESSMENT",
  "SUBMITTED",
  "MANAGER_REVIEW",
  "PENDING_SIGNOFF",
  "HR_PIPELINE",
  "COMPLETE",
] as const;

export function workflowStageIndex(status: string): number {
  const s = status || "DRAFT";
  if (s === "HOD_REVIEW" || s === "HR_REVIEW") return 6;
  const idx = DASHBOARD_WORKFLOW_ORDER.indexOf(s as (typeof DASHBOARD_WORKFLOW_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function workflowStageLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    PENDING_APPROVAL: "Pending approval",
    SELF_ASSESSMENT: "Self assessment",
    SUBMITTED: "Submitted",
    MANAGER_REVIEW: "Manager review",
    PENDING_SIGNOFF: "Pending sign-off",
    HOD_REVIEW: "HR review",
    HR_REVIEW: "HR review",
    HR_PIPELINE: "HR review",
    COMPLETE: "Complete",
  };
  if (status === "HOD_REVIEW" || status === "HR_REVIEW") return "HR review";
  return labels[status] ?? status.replace(/_/g, " ");
}

export interface RecentScoreRow {
  appraisal_id: string;
  cycle_name: string;
  total_score: number | null;
  final_rating: string | null;
}

export interface EmployeeDashboardStrip {
  full_name: string | null;
  appraisal_id: string | null;
  status: string;
  stageIndex: number;
  stageLabel: string;
  latestScore: number | null;
  ratingLabel: string | null;
  recent_scores: RecentScoreRow[];
  feedback_pending_count: number;
  development_profile_percent: number;
}

export async function fetchEmployeeDashboardStrip(
  user: AuthUser,
  employeeId: string | null
): Promise<EmployeeDashboardStrip> {
  const supabase = getSupabase();

  if (!employeeId) {
    return {
      full_name: user.name,
      appraisal_id: null,
      status: "DRAFT",
      stageIndex: 0,
      stageLabel: "—",
      latestScore: null,
      ratingLabel: null,
      recent_scores: [],
      feedback_pending_count: 0,
      development_profile_percent: 0,
    };
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("full_name")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: openCycle } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .eq("status", "open")
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: myAppraisals } = await supabase
    .from("appraisals")
    .select("id, status, cycle_id, updated_at")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  const apps = myAppraisals ?? [];
  let primary = apps.find((a) => openCycle && a.cycle_id === openCycle.id);
  if (!primary && apps.length > 0) {
    primary = apps.reduce((a, b) =>
      new Date(a.updated_at ?? 0).getTime() >= new Date(b.updated_at ?? 0).getTime() ? a : b
    );
  }

  const status = (primary?.status as string) ?? "DRAFT";
  const stageIndex = workflowStageIndex(status);
  const stageLabel = workflowStageLabel(status);

  let latestScore: number | null = null;
  let ratingLabel: string | null = null;
  if (primary?.id) {
    const { data: sc } = await supabase
      .from("appraisal_section_scores")
      .select("total_score, final_rating")
      .eq("appraisal_id", primary.id)
      .maybeSingle();
    if (sc?.total_score != null) latestScore = Number(sc.total_score);
    ratingLabel = sc?.final_rating ?? null;
  }

  const cycleIds = [...new Set(apps.map((a) => a.cycle_id).filter(Boolean))] as string[];
  const { data: cycles } = cycleIds.length
    ? await supabase.from("appraisal_cycles").select("id, name").in("id", cycleIds)
    : { data: [] };
  const cycleName = new Map((cycles ?? []).map((c) => [c.id, c.name as string]));

  const recent_scores: RecentScoreRow[] = [];
  const scored = await Promise.all(
    apps.map(async (a) => {
      const { data: row } = await supabase
        .from("appraisal_section_scores")
        .select("total_score, final_rating, calculated_at")
        .eq("appraisal_id", a.id)
        .maybeSingle();
      return { a, row };
    })
  );
  scored.sort(
    (x, y) =>
      new Date((y.row?.calculated_at as string) ?? y.a.updated_at ?? 0).getTime() -
      new Date((x.row?.calculated_at as string) ?? x.a.updated_at ?? 0).getTime()
  );
  for (const { a, row } of scored.slice(0, 8)) {
    recent_scores.push({
      appraisal_id: a.id,
      cycle_name: cycleName.get(a.cycle_id) ?? "—",
      total_score: row?.total_score != null ? Number(row.total_score) : null,
      final_rating: row?.final_rating ?? null,
    });
  }

  const { count: fbPending } = await supabase
    .from("feedback_reviewer")
    .select("id", { count: "exact", head: true })
    .eq("reviewer_employee_id", employeeId)
    .eq("status", "Pending")
    .neq("reviewer_type", "SELF");

  let development_profile_percent = 0;
  const { data: profile } = await supabase
    .from("employee_development_profiles")
    .select("skills, career_role, career_timeframe, employee_ld_comments")
    .eq("employee_id", user.id)
    .maybeSingle();
  if (profile) {
    const skills = Array.isArray(profile.skills) ? profile.skills.length : 0;
    let filled = 0;
    const total = 6;
    if (skills > 0) filled++;
    if (profile.career_role) filled++;
    if (profile.career_timeframe) filled++;
    if (profile.employee_ld_comments) filled++;
    if (skills >= 3) filled++;
    if (skills >= 1) filled++;
    development_profile_percent = Math.min(100, Math.round((filled / total) * 100));
  }

  return {
    full_name: (emp?.full_name as string) ?? user.name,
    appraisal_id: primary?.id ?? null,
    status,
    stageIndex,
    stageLabel,
    latestScore,
    ratingLabel,
    recent_scores,
    feedback_pending_count: fbPending ?? 0,
    development_profile_percent,
  };
}

export async function countDirectReports(managerEmployeeId: string | null): Promise<number> {
  if (!managerEmployeeId) return 0;
  const supabase = getSupabase();
  const { data: lines } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", managerEmployeeId)
    .eq("is_primary", true);
  return new Set((lines ?? []).map((l) => l.employee_id as string)).size;
}
