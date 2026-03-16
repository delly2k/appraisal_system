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
 * POST /api/admin/feedback/cycles/[id]/close
 * Set cycle status to Closed. Manual close by HR. Submissions no longer accepted after close.
 */
export async function POST(
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

    const { data: cycle, error: fetchErr } = await supabase
      .from("feedback_cycle")
      .select("id, status")
      .eq("id", cycleId)
      .maybeSingle();

    if (fetchErr || !cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
    if (cycle.status === "Closed") {
      return NextResponse.json({ error: "Cycle is already closed" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("feedback_cycle")
      .update({ status: "Closed" })
      .eq("id", cycleId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Close failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
