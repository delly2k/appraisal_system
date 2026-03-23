import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { getFeedbackCycleResultsForViewer } from "@/lib/feedback-cycle-results";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * GET /api/feedback/cycles/[id]/results
 * Participant-scoped 360 results (same shape as admin results): current user + their direct reports in this cycle.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.employee_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { id: cycleId } = await params;
    if (!cycleId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const payload = await getFeedbackCycleResultsForViewer(supabase, cycleId, user.employee_id);
    if (!payload) {
      return NextResponse.json({
        cycle: null,
        results: [],
        weighted_overall: {},
      });
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
