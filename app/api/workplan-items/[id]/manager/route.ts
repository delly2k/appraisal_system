import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { calcMgrResult } from "@/lib/metric-calc";
import { parseWorkplanDateForDb } from "@/lib/workplan-excel-parse";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL and service role key required");
  }
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/workplan-items/[id]/manager
 * Body: { mgr_actual_raw?: number, mgr_completion_date?: string }
 * Updates only manager columns; never touches employee columns.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: itemId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const mgrActualRaw = body.mgr_actual_raw !== undefined ? (body.mgr_actual_raw === null || body.mgr_actual_raw === "" ? null : Number(body.mgr_actual_raw)) : undefined;
    const mgrCompletionDate =
      body.mgr_completion_date !== undefined
        ? body.mgr_completion_date === null || body.mgr_completion_date === ""
          ? null
          : parseWorkplanDateForDb(body.mgr_completion_date)
        : undefined;

    const supabase = getSupabaseAdmin();

    const { data: item, error: itemErr } = await supabase
      .from("workplan_items")
      .select("id, workplan_id, metric_type, metric_target, metric_deadline, mgr_actual_raw, mgr_completion_date")
      .eq("id", itemId)
      .single();

    if (itemErr || !item) {
      return NextResponse.json({ error: "Workplan item not found" }, { status: 404 });
    }

    const { data: workplan, error: wpErr } = await supabase
      .from("workplans")
      .select("id, appraisal_id")
      .eq("id", item.workplan_id)
      .single();

    if (wpErr || !workplan) {
      return NextResponse.json({ error: "Workplan not found" }, { status: 404 });
    }

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, status, manager_employee_id")
      .eq("id", workplan.appraisal_id)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const status = (appraisal.status as string)?.toUpperCase();
    if (status !== "MANAGER_REVIEW") {
      return NextResponse.json({ error: "Appraisal is not in MANAGER_REVIEW phase" }, { status: 400 });
    }

    const isManager = appraisal.manager_employee_id === user.employee_id;
    const isHrOrAdmin = user.roles?.some((r) => r === "hr" || r === "admin");
    if (!isManager && !isHrOrAdmin) {
      return NextResponse.json({ error: "Only the manager for this appraisal can update manager ratings" }, { status: 403 });
    }

    const nextMgrActualRaw = mgrActualRaw !== undefined ? mgrActualRaw : item.mgr_actual_raw;
    const nextMgrCompletionDate = mgrCompletionDate !== undefined ? mgrCompletionDate : item.mgr_completion_date;

    const itemForCalc = {
      metric_type: item.metric_type,
      metric_target: item.metric_target,
      metric_deadline: item.metric_deadline,
      mgr_actual_raw: nextMgrActualRaw,
      mgr_completion_date: nextMgrCompletionDate,
    };
    const mgrResult = calcMgrResult(itemForCalc);

    const payload: Record<string, unknown> = {
      mgr_actual_raw: nextMgrActualRaw,
      mgr_completion_date: nextMgrCompletionDate,
      mgr_result: mgrResult,
    };

    const { error: updateErr } = await supabase
      .from("workplan_items")
      .update(payload)
      .eq("id", itemId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, mgr_result: mgrResult });
  } catch (err) {
    console.error("PATCH workplan-items manager error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
