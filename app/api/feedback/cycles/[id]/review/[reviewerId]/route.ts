import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { logFeedbackAudit } from "@/lib/feedback-audit";
import { computeAggregatedScore } from "@/lib/feedback-score";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

/**
 * GET: Load reviewer assignment (verify current user is the reviewer), questions for that type, and existing responses.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewerId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.employee_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: cycleId, reviewerId } = await params;
    const supabase = getSupabase();

    const { data: reviewer, error: revErr } = await supabase
      .from("feedback_reviewer")
      .select("id, cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status")
      .eq("id", reviewerId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (revErr || !reviewer) {
      return NextResponse.json({ error: "Review assignment not found" }, { status: 404 });
    }
    if (reviewer.reviewer_employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reviewerType = reviewer.reviewer_type as string;
    const { data: questions } = await supabase
      .from("feedback_question")
      .select("id, question_text, competency_group, sort_order")
      .eq("reviewer_type", reviewerType)
      .order("competency_group")
      .order("sort_order");

    const { data: responses } = await supabase
      .from("feedback_response")
      .select("question_id, score, comment, submitted_at")
      .eq("reviewer_id", reviewerId);

    const responseByQuestion = new Map(
      (responses ?? []).map((r) => [r.question_id, { score: r.score, comment: r.comment ?? "", submitted_at: r.submitted_at }])
    );

    const { data: scale } = await supabase
      .from("feedback_rating_scale")
      .select("value, label")
      .order("sort_order");

    return NextResponse.json({
      reviewer: {
        id: reviewer.id,
        reviewer_type: reviewer.reviewer_type,
        status: reviewer.status,
      },
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        question_text: q.question_text,
        competency_group: q.competency_group,
        sort_order: q.sort_order,
        score: responseByQuestion.get(q.id)?.score ?? null,
        comment: responseByQuestion.get(q.id)?.comment ?? "",
        submitted_at: responseByQuestion.get(q.id)?.submitted_at ?? null,
      })),
      scale: scale ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Save responses and optionally mark as submitted. Body: { responses: { [questionId]: { score?: number, comment?: string } }, submit?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewerId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user?.employee_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: cycleId, reviewerId } = await params;
    const supabase = getSupabase();

    const { data: reviewer, error: revErr } = await supabase
      .from("feedback_reviewer")
      .select("id, reviewer_employee_id, status, participant_employee_id")
      .eq("id", reviewerId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (revErr || !reviewer) {
      return NextResponse.json({ error: "Review assignment not found" }, { status: 404 });
    }
    if (reviewer.reviewer_employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: cycleRow } = await supabase
      .from("feedback_cycle")
      .select("status")
      .eq("id", cycleId)
      .maybeSingle();
    const cycleActive = cycleRow?.status === "Active";

    const alreadySubmitted = reviewer.status === "Submitted";
    if (alreadySubmitted && !cycleActive) {
      return NextResponse.json({ error: "Review already submitted" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const responses = body.responses as Record<string, { score?: number; comment?: string }> | undefined;
    const shouldSubmit = !!body.submit;
    if (!responses || typeof responses !== "object") {
      return NextResponse.json({ error: "responses object required" }, { status: 400 });
    }

    const submittedAtByQuestion = new Map<string, string>();
    if (alreadySubmitted) {
      const { data: existingResp } = await supabase
        .from("feedback_response")
        .select("question_id, submitted_at")
        .eq("reviewer_id", reviewerId);
      for (const row of existingResp ?? []) {
        const qid = row.question_id as string;
        const at = row.submitted_at as string | null;
        if (at) submittedAtByQuestion.set(qid, at);
      }
    }

    for (const [questionId, data] of Object.entries(responses)) {
      const score = data?.score != null ? Number(data.score) : null;
      const comment = typeof data?.comment === "string" ? data.comment : "";
      if (score !== null && (score < 1 || score > 5)) continue;
      const submitted_at = alreadySubmitted
        ? (submittedAtByQuestion.get(questionId) ?? new Date().toISOString())
        : shouldSubmit
          ? new Date().toISOString()
          : null;
      const { error: upsertErr } = await supabase
        .from("feedback_response")
        .upsert(
          {
            reviewer_id: reviewerId,
            question_id: questionId,
            score: score ?? null,
            comment: comment || null,
            submitted_at,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "reviewer_id,question_id" }
        );
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    if (shouldSubmit && !alreadySubmitted) {
      const { error: updateErr } = await supabase
        .from("feedback_reviewer")
        .update({ status: "Submitted" })
        .eq("id", reviewerId);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      try {
        await logFeedbackAudit(supabase, {
          cycle_id: cycleId,
          participant_employee_id: reviewer.participant_employee_id,
          reviewer_id: reviewerId,
          event_type: "review_submitted",
          actor_employee_id: user.employee_id ?? undefined,
        });
      } catch {
        // non-fatal
      }
    }

    if (shouldSubmit || alreadySubmitted) {
      try {
        const score = await computeAggregatedScore(
          supabase,
          cycleId,
          reviewer.participant_employee_id
        );
        if (score.complete) {
          await logFeedbackAudit(supabase, {
            cycle_id: cycleId,
            participant_employee_id: reviewer.participant_employee_id,
            reviewer_id: reviewerId,
            event_type: "review_updated",
            actor_system: true,
            metadata: {
              weighted_overall_score: score.overall,
              weighted_breakdown: score.byType,
            },
          });
        }
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ ok: true, submitted: shouldSubmit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
