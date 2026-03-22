import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { activateFeedbackCycle } from "@/lib/feedback-activate-cycle";

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
 * POST /api/admin/feedback/cycles/[id]/activate
 * HR-only: activate a Draft 360 cycle and/or seed participants from reporting_lines when
 * automatic activation failed (e.g. 360 linked after appraisal was already open).
 * Idempotent: if participants already exist, returns ok without changing data.
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

    const result = await activateFeedbackCycle(supabase, cycleId);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      if (result.code === "CLOSED") {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      alreadySeeded: result.alreadySeeded,
      participantCount: result.participantCount,
      status: result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
