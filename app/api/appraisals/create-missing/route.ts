import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

function hasHrRole(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => String(r).toLowerCase() === "hr" || String(r).toLowerCase() === "admin");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasHrRole(user?.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { employee_ids?: unknown };
  const employeeIds = Array.isArray(body.employee_ids)
    ? body.employee_ids.map((v) => String(v).trim()).filter(Boolean)
    : [];
  if (employeeIds.length === 0) {
    return NextResponse.json({ error: "employee_ids is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: activeCycle } = await supabase
    .from("appraisal_cycles")
    .select("id")
    .in("status", ["active", "open"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeCycle?.id) {
    return NextResponse.json({ error: "No active cycle" }, { status: 400 });
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const empId of employeeIds) {
    const { data: emp } = await supabase
      .from("employees")
      .select("employee_id, manager_employee_id, division_id")
      .eq("employee_id", empId)
      .maybeSingle();

    if (!emp?.employee_id) {
      skipped.push(empId);
      continue;
    }

    const { data: existing } = await supabase
      .from("appraisals")
      .select("id")
      .eq("employee_id", empId)
      .eq("cycle_id", activeCycle.id)
      .maybeSingle();
    if (existing?.id) {
      skipped.push(empId);
      continue;
    }

    const { error } = await supabase.from("appraisals").insert({
      employee_id: empId,
      cycle_id: activeCycle.id,
      manager_employee_id: emp.manager_employee_id ?? null,
      division_id: emp.division_id ?? null,
      review_type: "annual",
      status: "DRAFT",
      purpose: "end_of_year",
      is_active: true,
    });

    if (error) skipped.push(empId);
    else created.push(empId);
  }

  const { data: latestCompleted } = await supabase
    .from("employee_sync_log")
    .select("id")
    .eq("status", "completed")
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestCompleted?.id) {
    await supabase
      .from("employee_sync_log")
      .update({ new_employee_ids: [] })
      .eq("id", latestCompleted.id);
  }

  return NextResponse.json({ created: created.length, skipped: skipped.length });
}
