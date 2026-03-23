import type { SupabaseClient } from "@supabase/supabase-js";

type ReviewerType = "MANAGER" | "PEER" | "DIRECT_REPORT";

const WEIGHTS: Record<ReviewerType, number> = {
  MANAGER: 0.4,
  PEER: 0.35,
  DIRECT_REPORT: 0.25,
};

export type OthersAggregateResult = {
  complete: boolean;
  overall: number | null;
  byType: Partial<Record<ReviewerType, { avg: number; count: number }>>;
};

/** Read-only weighted 1–5 aggregate from MANAGER / PEER / DIRECT_REPORT submitted responses. */
export async function computeOthersAggregateMetrics(
  supabase: SupabaseClient,
  cycleId: string,
  revieweeId: string
): Promise<OthersAggregateResult> {
  const { data: reviewers } = await supabase
    .from("feedback_reviewer")
    .select("id, reviewer_type, status")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", revieweeId)
    .in("reviewer_type", ["MANAGER", "PEER", "DIRECT_REPORT"]);

  const rows = reviewers ?? [];
  const complete = rows.length > 0 && rows.every((r) => r.status === "Submitted");
  if (rows.length === 0) return { complete: false, overall: null, byType: {} };

  const reviewerIds = rows.map((r) => r.id);
  const { data: responses } = await supabase
    .from("feedback_response")
    .select("reviewer_id, score")
    .in("reviewer_id", reviewerIds)
    .not("submitted_at", "is", null);

  const avgByReviewer = new Map<string, number>();
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of responses ?? []) {
    if (r.score == null) continue;
    const cur = sums.get(r.reviewer_id) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.score);
    cur.count += 1;
    sums.set(r.reviewer_id, cur);
  }
  sums.forEach((v, k) => {
    if (v.count > 0) avgByReviewer.set(k, v.sum / v.count);
  });

  const grouped: Partial<Record<ReviewerType, number[]>> = {};
  for (const rr of rows) {
    const t = rr.reviewer_type as ReviewerType;
    const v = avgByReviewer.get(rr.id);
    if (v == null) continue;
    if (!grouped[t]) grouped[t] = [];
    grouped[t]!.push(v);
  }

  const byType: Partial<Record<ReviewerType, { avg: number; count: number }>> = {};
  (["MANAGER", "PEER", "DIRECT_REPORT"] as ReviewerType[]).forEach((t) => {
    const arr = grouped[t] ?? [];
    if (!arr.length) return;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    byType[t] = { avg, count: arr.length };
  });

  let weightedTotal = 0;
  let weightUsed = 0;
  (["MANAGER", "PEER", "DIRECT_REPORT"] as ReviewerType[]).forEach((t) => {
    const v = byType[t];
    if (!v) return;
    weightedTotal += v.avg * WEIGHTS[t];
    weightUsed += WEIGHTS[t];
  });
  const overall = weightUsed > 0 ? weightedTotal / weightUsed : null;

  return { complete, overall, byType };
}

export async function computeAggregatedScore(
  supabase: SupabaseClient,
  cycleId: string,
  revieweeId: string
): Promise<OthersAggregateResult> {
  const result = await computeOthersAggregateMetrics(supabase, cycleId, revieweeId);

  if (result.complete) {
    await supabase
      .from("feedback_participant")
      .update({ status: "Completed" })
      .eq("cycle_id", cycleId)
      .eq("employee_id", revieweeId);
  }

  return result;
}
