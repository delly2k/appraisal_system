import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewerType = "SELF" | "MANAGER" | "PEER" | "DIRECT_REPORT";

export interface ResponseRow {
  question_id: string;
  reviewer_type: ReviewerType;
  score: number;
  question_text: string;
  competency_group: string;
}

export interface CompetencyGap {
  competency: string;
  self: number | null;
  manager: number | null;
  peer: number | null;
  direct_report: number | null;
  max_gap: number;
  gap_label: "Aligned" | "Slight Gap" | "Significant Gap";
  blind_spot: boolean;
  hidden_strength: boolean;
}

const REVIEWER_TYPES: ReviewerType[] = ["SELF", "MANAGER", "PEER", "DIRECT_REPORT"];

function isReviewerType(v: string): v is ReviewerType {
  return (REVIEWER_TYPES as string[]).includes(v);
}

export function computeGapAnalysis(responses: ResponseRow[]): CompetencyGap[] {
  const competencyMap = new Map<string, Map<ReviewerType, number[]>>();

  for (const r of responses) {
    const cg = r.competency_group?.trim() || "General";
    if (!competencyMap.has(cg)) {
      competencyMap.set(cg, new Map());
    }
    const roleMap = competencyMap.get(cg)!;
    if (!roleMap.has(r.reviewer_type)) roleMap.set(r.reviewer_type, []);
    roleMap.get(r.reviewer_type)!.push(r.score);
  }

  const results: CompetencyGap[] = [];

  for (const [competency, roleMap] of competencyMap) {
    const avg = (scores: number[] | undefined) =>
      scores && scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

    const self = avg(roleMap.get("SELF"));
    const manager = avg(roleMap.get("MANAGER"));
    const peer = avg(roleMap.get("PEER"));
    const direct_report = avg(roleMap.get("DIRECT_REPORT"));

    const scores = [self, manager, peer, direct_report].filter((s): s is number => s !== null);
    const max_gap =
      scores.length >= 2 ? Math.round((Math.max(...scores) - Math.min(...scores)) * 10) / 10 : 0;

    const gap_label: CompetencyGap["gap_label"] =
      max_gap >= 1.5 ? "Significant Gap" : max_gap >= 0.8 ? "Slight Gap" : "Aligned";

    const externalScores = [manager, peer, direct_report].filter((s): s is number => s !== null);
    const externalAvg =
      externalScores.length > 0
        ? externalScores.reduce((a, b) => a + b, 0) / externalScores.length
        : null;

    const blind_spot =
      self !== null && externalAvg !== null && self - externalAvg >= 1.0;
    const hidden_strength =
      self !== null && externalAvg !== null && externalAvg - self >= 1.0;

    results.push({
      competency,
      self,
      manager,
      peer,
      direct_report,
      max_gap,
      gap_label,
      blind_spot,
      hidden_strength,
    });
  }

  const order: Record<CompetencyGap["gap_label"], number> = {
    "Significant Gap": 0,
    "Slight Gap": 1,
    Aligned: 2,
  };
  return results.sort((a, b) => order[a.gap_label] - order[b.gap_label]);
}

/**
 * Load submitted 360 responses for a participant and compute per-competency gaps (Self vs Manager vs Peer vs Direct report).
 */
export async function loadGapAnalysisForParticipant(
  supabase: SupabaseClient,
  cycleId: string,
  participantEmployeeId: string
): Promise<CompetencyGap[]> {
  const { data: reviewers, error: revErr } = await supabase
    .from("feedback_reviewer")
    .select("id, reviewer_type")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", participantEmployeeId);

  if (revErr || !reviewers?.length) return [];

  const revById = new Map(reviewers.map((r) => [r.id as string, String(r.reviewer_type ?? "")]));
  const revIds = reviewers.map((r) => r.id as string);

  const { data: responses, error: respErr } = await supabase
    .from("feedback_response")
    .select("score, reviewer_id, question_id")
    .in("reviewer_id", revIds)
    .not("submitted_at", "is", null)
    .not("score", "is", null);

  if (respErr || !responses?.length) return [];

  const qIds = [...new Set(responses.map((r) => r.question_id as string))];
  const { data: questions } = await supabase
    .from("feedback_question")
    .select("id, question_text, competency_group")
    .in("id", qIds);

  const qById = new Map((questions ?? []).map((q) => [q.id as string, q]));

  const rows: ResponseRow[] = [];
  for (const resp of responses) {
    const rtype = revById.get(resp.reviewer_id as string);
    const q = qById.get(resp.question_id as string);
    if (!rtype || !q || resp.score == null) continue;
    if (!isReviewerType(rtype)) continue;
    rows.push({
      question_id: resp.question_id as string,
      reviewer_type: rtype,
      score: Number(resp.score),
      question_text: String(q.question_text ?? ""),
      competency_group: String(q.competency_group ?? "").trim() || "General",
    });
  }

  return computeGapAnalysis(rows);
}
