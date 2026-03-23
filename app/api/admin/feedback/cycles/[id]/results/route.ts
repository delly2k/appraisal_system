import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { computeOthersAggregateMetrics } from "@/lib/feedback-score";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireHrAdmin() {
  const user = await getCurrentUser();
  if (!user?.roles?.length) return null;
  const isAdmin = user.roles.some((r) => r === "hr" || r === "admin");
  return isAdmin ? user : null;
}

/**
 * GET /api/admin/feedback/cycles/[id]/results
 * Returns all participants in the cycle with their aggregate 360 results (by reviewer type). HR only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { id: cycleId } = await params;
    if (!cycleId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: cycle, error: cycleErr } = await supabase
      .from("feedback_cycle")
      .select("id, cycle_name, status")
      .eq("id", cycleId)
      .maybeSingle();

    if (cycleErr || !cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    const { data: participants, error: partErr } = await supabase
      .from("feedback_participant")
      .select("employee_id")
      .eq("cycle_id", cycleId);

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    const participantIds = [...new Set((participants ?? []).map((p) => p.employee_id))];
    const nameByEmployeeId = new Map<string, string>();
    if (participantIds.length > 0) {
      const { data: employees } = await supabase
        .from("employees")
        .select("employee_id, full_name")
        .in("employee_id", participantIds);
      for (const e of employees ?? []) {
        nameByEmployeeId.set(e.employee_id, e.full_name ?? e.employee_id);
      }
    }

    const { data: reviewers, error: revErr } = await supabase
      .from("feedback_reviewer")
      .select("id, participant_employee_id, reviewer_type")
      .eq("cycle_id", cycleId);
    if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });

    const reviewerIds = (reviewers ?? []).map((r) => r.id);
    const { data: responses, error: respErr } = reviewerIds.length
      ? await supabase
          .from("feedback_response")
          .select("reviewer_id, score, comment")
          .in("reviewer_id", reviewerIds)
          .not("submitted_at", "is", null)
      : { data: [], error: null };
    if (respErr) return NextResponse.json({ error: respErr.message }, { status: 500 });

    const reviewerMeta = new Map(
      (reviewers ?? []).map((r) => [r.id, { participant: r.participant_employee_id, type: r.reviewer_type as string }])
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

    const results = participantIds.map((employee_id) => {
      const makeEntry = (type: "SELF" | "PEER" | "DIRECT_REPORT" | "MANAGER") => {
        const rec = sums.get(`${employee_id}:${type}`);
        if (!rec || rec.count === 0) return null;
        return { count: rec.count, avg: rec.sum / rec.count, comments: rec.comments };
      };
      const self = makeEntry("SELF");
      const peer = makeEntry("PEER");
      const direct = makeEntry("DIRECT_REPORT");
      const manager = makeEntry("MANAGER");
      return {
        employee_id,
        full_name: nameByEmployeeId.get(employee_id) ?? employee_id,
        self,
        peer,
        direct_report: direct,
        manager,
      };
    });

    const weightedByParticipant: Record<string, number | null> = {};
    for (const employee_id of participantIds) {
      const score = await computeOthersAggregateMetrics(supabase, cycleId, employee_id);
      weightedByParticipant[employee_id] = score.overall;
    }

    return NextResponse.json({
      cycle: { id: cycle.id, cycle_name: cycle.cycle_name, status: cycle.status },
      results,
      weighted_overall: weightedByParticipant,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load results failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
