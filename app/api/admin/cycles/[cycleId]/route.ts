import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

/**
 * PATCH /api/admin/cycles/[cycleId]
 * Update cycle (e.g. status). Uses service role to bypass RLS.
 * Requires current user to have hr or admin role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.roles?.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = user.roles.some((r) => r === "hr" || r === "admin");
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { cycleId } = await params;
    if (!cycleId) {
      return NextResponse.json({ error: "cycleId is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status.trim() : null;
    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);
    const { error } = await supabase
      .from("appraisal_cycles")
      .update({ status })
      .eq("id", cycleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
