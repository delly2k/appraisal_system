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
 * GET /api/admin/feedback/cycles
 * List all 360 feedback cycles with reviewee visibility settings. HR only.
 * If migration 0040 has not been applied, visibility columns are defaulted to true.
 */
export async function GET() {
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

    const fullSelect =
      "id, cycle_name, status, start_date, end_date, linked_appraisal_cycle_id, peer_feedback_visible_to_reviewee, direct_report_feedback_visible_to_reviewee";
    let { data, error } = await supabase
      .from("feedback_cycle")
      .select(fullSelect)
      .order("end_date", { ascending: false });

    if (error && (error.message?.includes("peer_feedback_visible_to_reviewee") || error.message?.includes("does not exist"))) {
      const baseSelect = "id, cycle_name, status, start_date, end_date, linked_appraisal_cycle_id";
      const result = await supabase
        .from("feedback_cycle")
        .select(baseSelect)
        .order("end_date", { ascending: false });
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
      data = (result.data ?? []).map((row) => ({
        ...row,
        peer_feedback_visible_to_reviewee: true,
        direct_report_feedback_visible_to_reviewee: true,
      }));
      error = null;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cycles = data ?? [];
    const ids = cycles.map((c: { id: string }) => c.id).filter(Boolean);
    const countByCycle = new Map<string, number>();
    if (ids.length > 0) {
      const { data: partRows, error: partErr } = await supabase
        .from("feedback_participant")
        .select("cycle_id")
        .in("cycle_id", ids);
      if (!partErr && partRows) {
        for (const row of partRows) {
          const cid = row.cycle_id as string;
          countByCycle.set(cid, (countByCycle.get(cid) ?? 0) + 1);
        }
      }
    }

    const withCounts = cycles.map((c: Record<string, unknown>) => ({
      ...c,
      participant_count: countByCycle.get(c.id as string) ?? 0,
    }));

    return NextResponse.json(withCounts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "List feedback cycles failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
