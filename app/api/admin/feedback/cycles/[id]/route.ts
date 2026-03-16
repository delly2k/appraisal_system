import { NextRequest, NextResponse } from "next/server";
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
 * PATCH /api/admin/feedback/cycles/[id]
 * Update 360 cycle reviewee visibility settings. HR only.
 * Body: { peer_feedback_visible_to_reviewee?: boolean, direct_report_feedback_visible_to_reviewee?: boolean }
 */
export async function PATCH(
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: { peer_feedback_visible_to_reviewee?: boolean; direct_report_feedback_visible_to_reviewee?: boolean } = {};
    if (typeof body.peer_feedback_visible_to_reviewee === "boolean") {
      updates.peer_feedback_visible_to_reviewee = body.peer_feedback_visible_to_reviewee;
    }
    if (typeof body.direct_report_feedback_visible_to_reviewee === "boolean") {
      updates.direct_report_feedback_visible_to_reviewee = body.direct_report_feedback_visible_to_reviewee;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "At least one visibility flag required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("feedback_cycle")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
