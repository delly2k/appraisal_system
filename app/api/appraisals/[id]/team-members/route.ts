import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { getAllEmployees, getEmployeeBySystemUserId } from "@/lib/dynamics-org-service";
import { resolveManagerAccessForAppraisal } from "@/lib/appraisal-manager-access";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !user.employee_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();
    if (appErr || !appraisal) return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const access = await resolveManagerAccessForAppraisal({
      supabase,
      appraisalId,
      appraisalEmployeeId: appraisal.employee_id,
      appraisalManagerEmployeeId: appraisal.manager_employee_id,
      currentEmployeeId: user.employee_id,
    });
    if (!access.isPrimaryManager) {
      return NextResponse.json({ error: "Only the primary manager can list team members" }, { status: 403 });
    }

    const current = await getEmployeeBySystemUserId(user.employee_id);
    if (!current?.xrm1_employeeid) {
      return NextResponse.json({ members: [] });
    }
    const managerDepartmentId = current._xrm1_employee_department_id_value ?? null;
    if (!managerDepartmentId) {
      return NextResponse.json({ members: [] });
    }

    const employees = await getAllEmployees();
    const members = employees
      .filter(
        (r) =>
          !!r._xrm1_employee_user_id_value &&
          r._xrm1_employee_department_id_value === managerDepartmentId &&
          r._xrm1_employee_user_id_value !== user.employee_id &&
          r._xrm1_employee_user_id_value !== appraisal.employee_id
      )
      .map((r) => ({
        id: String(r._xrm1_employee_user_id_value),
        name: r.xrm1_fullname ?? ([r.xrm1_first_name, r.xrm1_last_name].filter(Boolean).join(" ") || "Unknown"),
        jobTitle: r.xrm1_job_title ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ members });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
