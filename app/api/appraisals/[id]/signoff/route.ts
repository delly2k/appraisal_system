import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { transitionStatus } from "@/lib/appraisal-workflow";
import { isAppraisalStatus } from "@/types/appraisal";
import { resolveManagerSystemUserId, resolveDepartmentHeadSystemUserId } from "@/lib/hrmis-approval-auth";
import { allowAppraisalTestBypass } from "@/lib/appraisal-test-bypass";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

const ROLES = ["EMPLOYEE", "MANAGER", "HOD", "HR"] as const;
const STAGES = ["PENDING_SIGNOFF", "HOD_REVIEW", "HR_REVIEW"] as const;
type SignoffRole = (typeof ROLES)[number];
type SignoffStage = (typeof STAGES)[number];

function isSignoffRole(s: string): s is SignoffRole {
  return ROLES.includes(s as SignoffRole);
}
function isSignoffStage(s: string): s is SignoffStage {
  return STAGES.includes(s as SignoffStage);
}

const ROLE_TO_SIGNOFF_ROLE: Record<SignoffRole, string> = {
  EMPLOYEE: "employee_acknowledgement",
  MANAGER: "manager_signoff",
  HOD: "reviewing_manager_signoff",
  HR: "hr_finalization",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const role = body?.role as string | undefined;
    const stage = body?.stage as string | undefined;
    const comment = body?.comment as string | undefined;

    if (role == null || stage == null || !isSignoffRole(role) || !isSignoffStage(stage)) {
      return NextResponse.json(
        { error: "role must be EMPLOYEE|MANAGER|HOD|HR and stage must be PENDING_SIGNOFF|HOD_REVIEW|HR_REVIEW" },
        { status: 400 }
      );
    }

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

    const status = appraisal.status as string;
    if (!isAppraisalStatus(status)) {
      return NextResponse.json({ error: "Invalid appraisal status" }, { status: 400 });
    }

    if (stage === "PENDING_SIGNOFF" && status !== "PENDING_SIGNOFF") {
      return NextResponse.json({ error: "Appraisal must be in PENDING_SIGNOFF for this sign-off" }, { status: 400 });
    }
    if (stage === "HOD_REVIEW" && status !== "HOD_REVIEW") {
      return NextResponse.json({ error: "Appraisal must be in HOD_REVIEW for HOD sign-off" }, { status: 400 });
    }
    if (stage === "HR_REVIEW" && status !== "HR_REVIEW") {
      return NextResponse.json({ error: "Appraisal must be in HR_REVIEW for HR sign-off" }, { status: 400 });
    }

    if (role === "EMPLOYEE" && !allowAppraisalTestBypass() && appraisal.employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Only the employee can sign as EMPLOYEE" }, { status: 403 });
    }
    if (role === "MANAGER" && !allowAppraisalTestBypass()) {
      const managerSystemUserId = await resolveManagerSystemUserId(appraisal.employee_id) ?? appraisal.manager_employee_id ?? null;
      if (managerSystemUserId !== user.employee_id) {
        return NextResponse.json({ error: "Only the manager can sign as MANAGER" }, { status: 403 });
      }
    }
    if (role === "HOD" && !allowAppraisalTestBypass()) {
      const hodSystemUserId = await resolveDepartmentHeadSystemUserId(appraisal.employee_id);
      const isHOD = (hodSystemUserId != null && hodSystemUserId === user.employee_id) ||
        user.roles?.some((r) => r === "gm") ||
        user.roles?.some((r) => r === "admin");
      if (!isHOD) {
        return NextResponse.json({ error: "Only the Head of Division can sign as HOD" }, { status: 403 });
      }
    }
    if (role === "HR" && !allowAppraisalTestBypass() && !user.roles?.some((r) => r === "hr" || r === "admin")) {
      return NextResponse.json({ error: "Only HR can sign as HR" }, { status: 403 });
    }

    const { error: insErr } = await supabase.from("appraisal_signoffs").insert({
      appraisal_id: appraisalId,
      signed_by: user.id,
      role,
      stage,
      comment: comment ?? null,
      signoff_role: ROLE_TO_SIGNOFF_ROLE[role],
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "You have already signed off for this stage" }, { status: 400 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const signoffLabel = `${role} signed off` + (stage !== "PENDING_SIGNOFF" ? ` (${stage})` : "");
    await supabase.from("appraisal_audit").insert({
      appraisal_id: appraisalId,
      action_type: "signoff",
      actor_id: user.id,
      summary: signoffLabel,
    });

    if (stage === "PENDING_SIGNOFF") {
      const { data: signoffs } = await supabase
        .from("appraisal_signoffs")
        .select("role")
        .eq("appraisal_id", appraisalId)
        .eq("stage", "PENDING_SIGNOFF");
      const hasEmployee = signoffs?.some((s) => s.role === "EMPLOYEE");
      const hasManager = signoffs?.some((s) => s.role === "MANAGER");
      if (hasEmployee && hasManager) {
        const { error: transErr } = await transitionStatus(
          supabase,
          appraisalId,
          "HOD_REVIEW",
          user.id,
          "Dual sign-off complete"
        );
        if (transErr) return NextResponse.json({ error: transErr }, { status: 400 });
        return NextResponse.json({ success: true, status: "HOD_REVIEW", advanced: true });
      }
      return NextResponse.json({ success: true, status: "PENDING_SIGNOFF", advanced: false });
    }

    if (stage === "HOD_REVIEW" && role === "HOD") {
      const { error: transErr } = await transitionStatus(
        supabase,
        appraisalId,
        "HR_REVIEW",
        user.id,
        "HOD signed off"
      );
      if (transErr) return NextResponse.json({ error: transErr }, { status: 400 });
      return NextResponse.json({ success: true, status: "HR_REVIEW", advanced: true });
    }

    return NextResponse.json({ success: true, status, advanced: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
