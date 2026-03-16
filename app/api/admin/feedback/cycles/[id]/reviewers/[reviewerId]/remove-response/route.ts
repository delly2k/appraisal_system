import { NextResponse } from "next/server";
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
 * POST /api/admin/feedback/cycles/[id]/reviewers/[reviewerId]/remove-response
 * Remove (delete) all responses for this reviewer assignment. HR only. Use for inappropriate content.
 * Does not remove the assignment; reviewer can submit again until cycle closes.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; reviewerId: string }> }
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

    const { id: cycleId, reviewerId } = await params;
    if (!cycleId || !reviewerId) {
      return NextResponse.json({ error: "cycle id and reviewer id are required" }, { status: 400 });
    }

    const { data: row, error: fetchErr } = await supabase
      .from("feedback_reviewer")
      .select("id, reviewer_type, participant_employee_id")
      .eq("id", reviewerId)
      .eq("cycle_id", cycleId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Reviewer assignment not found" }, { status: 404 });
    }
    if (row.reviewer_type === "SELF") {
      return NextResponse.json({ error: "Cannot remove self-assessment response via this endpoint" }, { status: 400 });
    }

    const { error: delErr } = await supabase
      .from("feedback_response")
      .delete()
      .eq("reviewer_id", reviewerId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const { error: updateErr } = await supabase
      .from("feedback_reviewer")
      .update({ status: "Pending" })
      .eq("id", reviewerId)
      .eq("cycle_id", cycleId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    try {
      await logFeedbackAudit(supabase, {
        cycle_id: cycleId,
        participant_employee_id: row.participant_employee_id,
        reviewer_id: reviewerId,
        event_type: "review_removed",
        actor_employee_id: user.employee_id ?? undefined,
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Remove response failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
