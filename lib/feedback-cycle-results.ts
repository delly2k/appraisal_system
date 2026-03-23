import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOthersAggregateMetrics } from "@/lib/feedback-score";

/** Admin-style result entry: avg is 1–5 mean of submitted item scores for that reviewer type. */
export type FeedbackCycleResultEntry = {
  count: number;
  avg: number;
  comments: string[];
};

export type FeedbackCycleResultRow = {
  employee_id: string;
  full_name: string;
  self: FeedbackCycleResultEntry | null;
  peer: FeedbackCycleResultEntry | null;
  direct_report: FeedbackCycleResultEntry | null;
  manager: FeedbackCycleResultEntry | null;
};

export type FeedbackCycleResultsPayload = {
  cycle: { id: string; cycle_name: string; status: string; end_date?: string | null };
  results: FeedbackCycleResultRow[];
  weighted_overall: Record<string, number | null>;
};

/** Map 1–5 Likert mean to display /10 (2–10). */
export function scoreOutOf10(avg: number | null | undefined): number | null {
  if (avg == null || Number.isNaN(avg)) return null;
  return (avg / 5) * 10;
}

export function formatScoreOutOf10(avg: number | null | undefined): string {
  const s = scoreOutOf10(avg);
  if (s == null) return "Pending";
  return `${s.toFixed(1)}/10`;
}

/**
 * Mean of every submitted non-null item score for this participant (all reviewer types).
 */
export async function getParticipantOverallAverageSubmitted(
  supabase: SupabaseClient,
  cycleId: string,
  participantEmployeeId: string
): Promise<number | null> {
  const { data: reviewers } = await supabase
    .from("feedback_reviewer")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", participantEmployeeId);

  const ids = (reviewers ?? []).map((r) => r.id);
  if (!ids.length) return null;

  const { data: responses } = await supabase
    .from("feedback_response")
    .select("score")
    .in("reviewer_id", ids)
    .not("submitted_at", "is", null)
    .not("score", "is", null);

  if (!responses?.length) return null;
  let sum = 0;
  let c = 0;
  for (const row of responses) {
    if (row.score == null) continue;
    sum += Number(row.score);
    c += 1;
  }
  return c > 0 ? sum / c : null;
}

export type ReviewerTypeCompletion = {
  total: number;
  submitted: number;
};

const TYPES = ["MANAGER", "PEER", "DIRECT_REPORT", "SELF"] as const;

export async function getReviewerCompletionByType(
  supabase: SupabaseClient,
  cycleId: string,
  participantEmployeeId: string
): Promise<Record<(typeof TYPES)[number], ReviewerTypeCompletion>> {
  const { data: rows } = await supabase
    .from("feedback_reviewer")
    .select("reviewer_type, status")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", participantEmployeeId);

  const out: Record<(typeof TYPES)[number], ReviewerTypeCompletion> = {
    MANAGER: { total: 0, submitted: 0 },
    PEER: { total: 0, submitted: 0 },
    DIRECT_REPORT: { total: 0, submitted: 0 },
    SELF: { total: 0, submitted: 0 },
  };

  for (const r of rows ?? []) {
    const t = String(r.reviewer_type ?? "") as (typeof TYPES)[number];
    if (!TYPES.includes(t)) continue;
    out[t].total += 1;
    if (r.status === "Submitted") out[t].submitted += 1;
  }
  return out;
}

/**
 * Build admin-equivalent results rows + weighted_overall for the given employee ids (same logic as GET .../admin/.../results).
 */
export async function buildCycleResultsForEmployees(
  supabase: SupabaseClient,
  cycleId: string,
  employeeIds: string[]
): Promise<FeedbackCycleResultsPayload> {
  const uniqueIds = [...new Set(employeeIds)];
  const { data: cycle, error: cycleErr } = await supabase
    .from("feedback_cycle")
    .select("id, cycle_name, status, end_date")
    .eq("id", cycleId)
    .maybeSingle();

  if (cycleErr || !cycle) {
    throw new Error("Cycle not found");
  }

  const nameByEmployeeId = new Map<string, string>();
  if (uniqueIds.length > 0) {
    const { data: employees } = await supabase
      .from("employees")
      .select("employee_id, full_name")
      .in("employee_id", uniqueIds);
    for (const e of employees ?? []) {
      nameByEmployeeId.set(e.employee_id, e.full_name ?? e.employee_id);
    }
  }

  const { data: reviewers, error: revErr } = await supabase
    .from("feedback_reviewer")
    .select("id, participant_employee_id, reviewer_type")
    .eq("cycle_id", cycleId)
    .in("participant_employee_id", uniqueIds);

  if (revErr) throw new Error(revErr.message);

  const reviewerIds = (reviewers ?? []).map((r) => r.id);
  const { data: responses, error: respErr } = reviewerIds.length
    ? await supabase
        .from("feedback_response")
        .select("reviewer_id, score, comment")
        .in("reviewer_id", reviewerIds)
        .not("submitted_at", "is", null)
    : { data: [], error: null };

  if (respErr) throw new Error(respErr.message);

  const reviewerMeta = new Map(
    (reviewers ?? []).map((r) => [
      r.id,
      { participant: r.participant_employee_id, type: r.reviewer_type as string },
    ])
  );

  const sums = new Map<string, { sum: number; count: number; comments: string[] }>();
  for (const row of responses ?? []) {
    const meta = reviewerMeta.get(row.reviewer_id);
    if (!meta) continue;
    const key = `${meta.participant}:${meta.type}`;
    const cur = sums.get(key) ?? { sum: 0, count: 0, comments: [] };
    if (row.score != null) {
      cur.sum += Number(row.score);
      cur.count += 1;
    }
    if (typeof row.comment === "string" && row.comment.trim()) {
      cur.comments.push(row.comment.trim());
    }
    sums.set(key, cur);
  }

  const makeEntry = (employee_id: string, type: "SELF" | "PEER" | "DIRECT_REPORT" | "MANAGER") => {
    const rec = sums.get(`${employee_id}:${type}`);
    if (!rec || rec.count === 0) return null;
    return { count: rec.count, avg: rec.sum / rec.count, comments: rec.comments };
  };

  const results: FeedbackCycleResultRow[] = uniqueIds.map((employee_id) => ({
    employee_id,
    full_name: nameByEmployeeId.get(employee_id) ?? employee_id,
    self: makeEntry(employee_id, "SELF"),
    peer: makeEntry(employee_id, "PEER"),
    direct_report: makeEntry(employee_id, "DIRECT_REPORT"),
    manager: makeEntry(employee_id, "MANAGER"),
  }));

  const weighted_overall: Record<string, number | null> = {};
  for (const employee_id of uniqueIds) {
    const score = await computeOthersAggregateMetrics(supabase, cycleId, employee_id);
    weighted_overall[employee_id] = score.overall;
  }

  return {
    cycle: {
      id: cycle.id,
      cycle_name: cycle.cycle_name,
      status: cycle.status as string,
      end_date: (cycle as { end_date?: string | null }).end_date ?? null,
    },
    results,
    weighted_overall,
  };
}

/**
 * Employee ids the viewer may see in results: self (if participant) + direct reports they review in this cycle.
 */
export async function getViewerAllowedResultEmployeeIds(
  supabase: SupabaseClient,
  cycleId: string,
  viewerEmployeeId: string
): Promise<string[]> {
  const allowed = new Set<string>();

  const { data: selfPart } = await supabase
    .from("feedback_participant")
    .select("employee_id")
    .eq("cycle_id", cycleId)
    .eq("employee_id", viewerEmployeeId)
    .maybeSingle();

  if (selfPart) allowed.add(viewerEmployeeId);

  const { data: drRows } = await supabase
    .from("feedback_reviewer")
    .select("participant_employee_id")
    .eq("cycle_id", cycleId)
    .eq("reviewer_employee_id", viewerEmployeeId)
    .eq("reviewer_type", "DIRECT_REPORT");

  for (const r of drRows ?? []) {
    allowed.add(r.participant_employee_id as string);
  }

  return [...allowed];
}

export async function getFeedbackCycleResultsForViewer(
  supabase: SupabaseClient,
  cycleId: string,
  viewerEmployeeId: string
): Promise<FeedbackCycleResultsPayload | null> {
  const ids = await getViewerAllowedResultEmployeeIds(supabase, cycleId, viewerEmployeeId);
  if (ids.length === 0) return null;
  return buildCycleResultsForEmployees(supabase, cycleId, ids);
}
