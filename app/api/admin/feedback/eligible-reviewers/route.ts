import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import {
  getEmployeeBySystemUserId,
  getDirectReports,
  getParticipantSalaryGradeFromDynamics,
  getSameGradeEmployeesFromDynamics,
} from "@/lib/dynamics-org-service";

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

export interface EligibleEmployee {
  employee_id: string;
  full_name: string | null;
  email?: string | null;
  job_title?: string | null;
  department_name?: string | null;
}

/**
 * GET /api/admin/feedback/eligible-reviewers?participant_employee_id=xxx&reviewer_type=PEER|DIRECT_REPORT|MANAGER
 * Returns list of employees eligible to be assigned as that reviewer type for the participant. HR only.
 * - MANAGER: the participant's manager (from reporting_lines). Single employee.
 * - DIRECT_REPORT: direct reports of the participant (from Dynamics/reporting).
 * - PEER: active employees with the same salary grade as the participant, excluding the participant and their direct reports.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const participant_employee_id = request.nextUrl.searchParams.get("participant_employee_id")?.trim();
    const reviewer_type = request.nextUrl.searchParams.get("reviewer_type")?.trim().toUpperCase();

    if (!participant_employee_id || !reviewer_type) {
      return NextResponse.json(
        { error: "participant_employee_id and reviewer_type are required" },
        { status: 400 }
      );
    }
    if (reviewer_type !== "PEER" && reviewer_type !== "DIRECT_REPORT" && reviewer_type !== "MANAGER") {
      return NextResponse.json(
        { error: "reviewer_type must be PEER, DIRECT_REPORT, or MANAGER" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (reviewer_type === "MANAGER") {
      const { data: reporting } = await supabase
        .from("reporting_lines")
        .select("manager_employee_id")
        .eq("employee_id", participant_employee_id)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();
      const managerId = reporting?.manager_employee_id;
      if (!managerId) {
        return NextResponse.json({ employees: [] });
      }
      const { data: emp } = await supabase
        .from("employees")
        .select("employee_id, full_name, email, job_title, department_name")
        .eq("employee_id", managerId)
        .eq("is_active", true)
        .maybeSingle();
      const employees: EligibleEmployee[] = emp
        ? [{
            employee_id: emp.employee_id,
            full_name: emp.full_name ?? null,
            email: emp.email ?? undefined,
            job_title: emp.job_title ?? undefined,
            department_name: emp.department_name ?? undefined,
          }]
        : [];
      return NextResponse.json({ employees });
    }

    if (reviewer_type === "DIRECT_REPORT") {
      // Same logic as profile: participant_employee_id is system user id → resolve to xrm1_employee, then get direct reports by xrm1_employeeid
      const emp = await getEmployeeBySystemUserId(participant_employee_id);
      if (!emp?.xrm1_employeeid) {
        return NextResponse.json({ employees: [] });
      }
      const reports = await getDirectReports(emp.xrm1_employeeid);
      const employees: EligibleEmployee[] = reports.map((r) => {
        const sysUserId = r._xrm1_employee_user_id_value != null ? String(r._xrm1_employee_user_id_value).replace(/^\{|\}$/g, "") : null;
        const fullName = r.xrm1_fullname ?? ([r.xrm1_first_name, r.xrm1_last_name].filter(Boolean).join(" ").trim() || null);
        return {
          employee_id: sysUserId ?? r.xrm1_employeeid,
          full_name: fullName,
          email: r.emailaddress ?? (r as { internalemailaddress?: string | null }).internalemailaddress ?? null,
          job_title: r.xrm1_job_title ?? null,
        };
      });
      return NextResponse.json({ employees });
    }

    // PEER: same salary grade from Dynamics, excluding participant and their direct reports
    const participantGrade = await getParticipantSalaryGradeFromDynamics(participant_employee_id);
    if (participantGrade === null) {
      return NextResponse.json({ employees: [] });
    }

    const { data: directReportRows } = await supabase
      .from("reporting_lines")
      .select("employee_id")
      .eq("manager_employee_id", participant_employee_id)
      .eq("is_primary", true);
    const directReportIds = new Set((directReportRows ?? []).map((r) => r.employee_id));
    directReportIds.add(participant_employee_id);

    const sameGradeFromDynamics = await getSameGradeEmployeesFromDynamics(participantGrade);
    const employees: EligibleEmployee[] = sameGradeFromDynamics
      .filter((e) => !directReportIds.has(e.employee_id))
      .map((e) => ({
        employee_id: e.employee_id,
        full_name: e.full_name,
        email: e.email ?? undefined,
        job_title: e.job_title ?? undefined,
        department_name: e.department_name ?? undefined,
      }));

    return NextResponse.json({ employees });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load eligible reviewers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
