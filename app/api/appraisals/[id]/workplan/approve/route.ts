import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { notifyEmployee } from "@/lib/notifications";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.employee_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    // Get the workplan for this appraisal
    const { data: workplan, error: wpErr } = await supabase
      .from("workplans")
      .select("id, status")
      .eq("appraisal_id", appraisalId)
      .single();

    if (wpErr || !workplan) {
      return NextResponse.json(
        { error: "Workplan not found" },
        { status: 404 }
      );
    }

    // Call the approve function
    const { data: result, error: approveErr } = await supabase.rpc(
      "approve_workplan",
      {
        p_workplan_id: workplan.id,
        p_manager_id: user.employee_id,
      }
    );

    if (approveErr) {
      return NextResponse.json({ error: approveErr.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Approval failed" },
        { status: 400 }
      );
    }

    // approve_workplan (DB) already set appraisal status to IN_PROGRESS

    // Notify employee that workplan is approved (they can use check-ins, then start self-assessment when ready)
    const { data: row } = await supabase
      .from("appraisals")
      .select("cycle_id, employee_id")
      .eq("id", appraisalId)
      .single();
    if (row?.cycle_id && row?.employee_id) {
      const { data: cycle } = await supabase
        .from("appraisal_cycles")
        .select("name, end_date, fiscal_year")
        .eq("id", row.cycle_id)
        .single();
      const { data: emp } = await supabase
        .from("employees")
        .select("email, full_name")
        .eq("employee_id", row.employee_id)
        .single();
      if (emp?.email && cycle) {
        await notifyEmployee(
          { email: emp.email, name: emp.full_name ?? undefined },
          "self_assessment_open",
          {
            cycleName: cycle.name,
            fiscalYear: cycle.fiscal_year,
            dueDate: cycle.end_date ?? undefined,
            employeeName: emp.full_name ?? emp.email,
            appraisalId,
          }
        );
        try {
          const { createNotificationForEmployeeId } = await import("@/lib/notifications/create");
          await createNotificationForEmployeeId(row.employee_id, {
            type: "system.announcement",
            title: "Work plan approved",
            body: `Your work plan for ${cycle.name} has been approved. You can use check-ins and start your self-assessment when ready.`,
            link: `/appraisals/${appraisalId}`,
            metadata: { appraisal_id: appraisalId, cycle_id: row.cycle_id },
          });
        } catch {
          /* non-blocking */
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
