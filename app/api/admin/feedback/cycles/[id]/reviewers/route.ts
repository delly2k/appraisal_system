import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { logFeedbackAudit } from "@/lib/feedback-audit";

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
 * POST /api/admin/feedback/cycles/[id]/reviewers
 * Add a reviewer assignment. Body: { participant_employee_id, reviewer_employee_id, reviewer_type }.
 * reviewer_type must be PEER, DIRECT_REPORT, or MANAGER. HR only. Peer max 2 per participant.
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}));
    const participant_employee_id = typeof body.participant_employee_id === "string" ? body.participant_employee_id.trim() : "";
    const reviewer_employee_id = typeof body.reviewer_employee_id === "string" ? body.reviewer_employee_id.trim() : "";
    const reviewer_type = typeof body.reviewer_type === "string" ? body.reviewer_type.trim().toUpperCase() : "";

    if (!participant_employee_id || !reviewer_employee_id || !reviewer_type) {
      return NextResponse.json(
        { error: "participant_employee_id, reviewer_employee_id, and reviewer_type are required" },
        { status: 400 }
      );
    }
    if (reviewer_type !== "PEER" && reviewer_type !== "DIRECT_REPORT" && reviewer_type !== "MANAGER") {
      return NextResponse.json(
        { error: "reviewer_type must be PEER, DIRECT_REPORT, or MANAGER" },
        { status: 400 }
      );
    }
    if (participant_employee_id === reviewer_employee_id) {
      return NextResponse.json(
        { error: "Reviewer cannot be the same as participant (use SELF for self-assessment)" },
        { status: 400 }
      );
    }

    const { data: cycle, error: cycleErr } = await supabase
      .from("feedback_cycle")
      .select("id, status")
      .eq("id", cycleId)
      .maybeSingle();

    if (cycleErr || !cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (reviewer_type === "PEER") {
      const { count } = await supabase
        .from("feedback_reviewer")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycleId)
        .eq("participant_employee_id", participant_employee_id)
        .eq("reviewer_type", "PEER");
      if ((count ?? 0) >= 2) {
        return NextResponse.json(
          { error: "Maximum of 2 peer reviewers per participant" },
          { status: 400 }
        );
      }
    }
    if (reviewer_type === "MANAGER") {
      const { count } = await supabase
        .from("feedback_reviewer")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycleId)
        .eq("participant_employee_id", participant_employee_id)
        .eq("reviewer_type", "MANAGER");
      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: "Only one manager reviewer is allowed per participant" },
          { status: 400 }
        );
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("feedback_reviewer")
      .insert({
        cycle_id: cycleId,
        participant_employee_id,
        reviewer_employee_id,
        reviewer_type: reviewer_type as "PEER" | "DIRECT_REPORT" | "MANAGER",
        status: "Pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "This reviewer is already assigned for this participant and type" }, { status: 400 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    try {
      await logFeedbackAudit(supabase, {
        cycle_id: cycleId,
        participant_employee_id,
        reviewer_id: inserted?.id,
        event_type: "assignment_created",
        actor_employee_id: user.employee_id ?? undefined,
        metadata: { reviewer_type },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Add reviewer failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
