import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

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

    const { data: aggregates, error: aggErr } = await supabase
      .from("feedback_response_anonymous_aggregate")
      .select("participant_employee_id, reviewer_type, response_count, average_score, comments")
      .eq("cycle_id", cycleId);

    if (aggErr) {
      return NextResponse.json({ error: aggErr.message }, { status: 500 });
    }

    const resultsByParticipant = new Map<
      string,
      { self?: { count: number; avg: number; comments: string[] }; peer?: { count: number; avg: number; comments: string[] }; direct_report?: { count: number; avg: number; comments: string[] } }
    >();

    for (const row of aggregates ?? []) {
      const empId = row.participant_employee_id;
      if (!resultsByParticipant.has(empId)) {
        resultsByParticipant.set(empId, {});
      }
      const rec = resultsByParticipant.get(empId)!;
      const type = row.reviewer_type as "SELF" | "PEER" | "DIRECT_REPORT";
      const entry = {
        count: Number(row.response_count),
        avg: Number(row.average_score),
        comments: Array.isArray(row.comments) ? row.comments : [],
      };
      if (type === "SELF") rec.self = entry;
      else if (type === "PEER") rec.peer = entry;
      else if (type === "DIRECT_REPORT") rec.direct_report = entry;
    }

    const results = participantIds.map((employee_id) => {
      const aggregates = resultsByParticipant.get(employee_id) ?? {};
      return {
        employee_id,
        full_name: nameByEmployeeId.get(employee_id) ?? employee_id,
        self: aggregates.self ?? null,
        peer: aggregates.peer ?? null,
        direct_report: aggregates.direct_report ?? null,
      };
    });

    return NextResponse.json({
      cycle: { id: cycle.id, cycle_name: cycle.cycle_name, status: cycle.status },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load results failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
