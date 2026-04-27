import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { resolveManagerAccessForAppraisal } from "@/lib/appraisal-manager-access";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, status, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const status = (appraisal.status as string) ?? "DRAFT";
    if (status !== "DRAFT") {
      return NextResponse.json({ canSubmit: false });
    }

    const isEmployee = appraisal.employee_id === user.employee_id;
    const managerAccess = await resolveManagerAccessForAppraisal({
      supabase,
      appraisalId,
      appraisalEmployeeId: appraisal.employee_id,
      appraisalManagerEmployeeId: appraisal.manager_employee_id,
      currentEmployeeId: user.employee_id ?? null,
    });
    const isManager = managerAccess.hasManagerAccess;
    if (!isEmployee && !isManager) {
      return NextResponse.json({ canSubmit: false });
    }

    const { data: workplan } = await supabase
      .from("workplans")
      .select("id")
      .eq("appraisal_id", appraisalId)
      .maybeSingle();

    if (!workplan) {
      return NextResponse.json({ canSubmit: false });
    }

    const { data: items } = await supabase
      .from("workplan_items")
      .select("weight, major_task")
      .eq("workplan_id", workplan.id);

    const list = items ?? [];
    const totalWeight = list.reduce((s, i) => s + (Number(i.weight) || 0), 0);
    const weightValid = list.length > 0 && Math.abs(totalWeight - 100) < 0.01;
    const hasEmptyTask = list.some((r) => !String(r?.major_task ?? "").trim());
    const canSubmit = list.length > 0 && weightValid && !hasEmptyTask;

    return NextResponse.json({ canSubmit: !!canSubmit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
