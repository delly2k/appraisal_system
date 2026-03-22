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

type BatchItem =
  | {
      cycleId: string;
      cycleName: string;
      ok: true;
      alreadySeeded: boolean;
      participantCount: number;
      status: string;
    }
  | { cycleId: string; cycleName: string; ok: false; error: string };

/**
 * POST /api/admin/feedback/cycles/activate-pending
 * HR-only: run the same logic as single-cycle activate for every non-Closed cycle with zero participants.
 */
export async function POST() {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: cycles, error: cErr } = await supabase
      .from("feedback_cycle")
      .select("id, cycle_name, status")
      .neq("status", "Closed");

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const list = cycles ?? [];
    const ids = list.map((c) => c.id).filter(Boolean);
    const countByCycle = new Map<string, number>();
    if (ids.length > 0) {
      const { data: partRows, error: pErr } = await supabase
        .from("feedback_participant")
        .select("cycle_id")
        .in("cycle_id", ids);
      if (!pErr && partRows) {
        for (const row of partRows) {
          const cid = row.cycle_id as string;
          countByCycle.set(cid, (countByCycle.get(cid) ?? 0) + 1);
        }
      }
    }

    const pending = list.filter((c) => (countByCycle.get(c.id) ?? 0) === 0);
    const results: BatchItem[] = [];

    for (const c of pending) {
      const name = (c.cycle_name as string) ?? c.id;
      const r = await activateFeedbackCycle(supabase, c.id);
      if (r.ok) {
        results.push({
          cycleId: c.id,
          cycleName: name,
          ok: true,
          alreadySeeded: r.alreadySeeded,
          participantCount: r.participantCount,
          status: r.status,
        });
      } else {
        results.push({ cycleId: c.id, cycleName: name, ok: false, error: r.error });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Activate pending failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
