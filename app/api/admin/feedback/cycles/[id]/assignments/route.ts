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
 * GET /api/admin/feedback/cycles/[id]/assignments
 * Returns all participants in the cycle with their reviewer assignments (reviewer name, type, status). HR only.
 */
export async function GET(
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

    const { data: cycle, error: cycleErr } = await supabase
      .from("feedback_cycle")
      .select("id, cycle_name, status, end_date")
      .eq("id", cycleId)
      .maybeSingle();

    if (cycleErr || !cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    const { data: reviewers, error: revErr } = await supabase
      .from("feedback_reviewer")
      .select("id, participant_employee_id, reviewer_employee_id, reviewer_type, status")
      .eq("cycle_id", cycleId);

    if (revErr) {
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }

    const employeeIds = new Set<string>();
    for (const r of reviewers ?? []) {
      employeeIds.add(r.participant_employee_id);
      employeeIds.add(r.reviewer_employee_id);
    }
    const nameByEmployeeId = new Map<string, string>();
    const departmentByEmployeeId = new Map<string, string>();
    const jobTitleByEmployeeId = new Map<string, string>();
    if (employeeIds.size > 0) {
      const { data: employees } = await supabase
        .from("employees")
        .select("employee_id, full_name, department_name, job_title")
        .in("employee_id", [...employeeIds]);
      for (const e of employees ?? []) {
        const emp = e as { employee_id: string; full_name?: string | null; department_name?: string | null; job_title?: string | null };
        nameByEmployeeId.set(emp.employee_id, emp.full_name ?? emp.employee_id);
        if (emp.department_name != null) departmentByEmployeeId.set(emp.employee_id, emp.department_name);
        if (emp.job_title != null) jobTitleByEmployeeId.set(emp.employee_id, emp.job_title);
      }
    }

    const byParticipant = new Map<
      string,
      {
        participant_employee_id: string;
        participant_name: string;
        participant_department_name?: string;
        participant_job_title?: string;
        reviewers: { id: string; reviewer_employee_id: string; reviewer_name: string; reviewer_type: string; status: string }[];
      }
    >();

    for (const r of reviewers ?? []) {
      const pid = r.participant_employee_id;
      if (!byParticipant.has(pid)) {
        byParticipant.set(pid, {
          participant_employee_id: pid,
          participant_name: nameByEmployeeId.get(pid) ?? pid,
          participant_department_name: departmentByEmployeeId.get(pid),
          participant_job_title: jobTitleByEmployeeId.get(pid),
          reviewers: [],
        });
      }
      byParticipant.get(pid)!.reviewers.push({
        id: r.id,
        reviewer_employee_id: r.reviewer_employee_id,
        reviewer_name: nameByEmployeeId.get(r.reviewer_employee_id) ?? r.reviewer_employee_id,
        reviewer_type: r.reviewer_type as string,
        status: r.status as string,
      });
    }

    const participants = [...byParticipant.values()].sort((a, b) =>
      a.participant_name.localeCompare(b.participant_name)
    );

    return NextResponse.json({
      cycle: { id: cycle.id, cycle_name: cycle.cycle_name, status: cycle.status, end_date: (cycle as { end_date?: string | null }).end_date ?? null },
      participants,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Load assignments failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
