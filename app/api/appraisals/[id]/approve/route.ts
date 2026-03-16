import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { transitionStatus } from "@/lib/appraisal-workflow";
import { isAppraisalStatus } from "@/types/appraisal";
import { resolveManagerSystemUserId } from "@/lib/hrmis-approval-auth";
import { allowAppraisalTestBypass } from "@/lib/appraisal-test-bypass";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

const ROLE = ["EMPLOYEE", "MANAGER"] as const;
type ApprovalRole = (typeof ROLE)[number];

function isApprovalRole(s: string): s is ApprovalRole {
  return ROLE.includes(s as ApprovalRole);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const role = body?.role as string | undefined;
    const comment = body?.comment as string | undefined;

    if (role == null || !isApprovalRole(role)) {
      return NextResponse.json({ error: "role must be EMPLOYEE or MANAGER" }, { status: 400 });
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
    if (!isAppraisalStatus(status) || status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Appraisal must be in PENDING_APPROVAL to approve" },
        { status: 400 }
      );
    }

    if (role === "EMPLOYEE" && !allowAppraisalTestBypass() && appraisal.employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Only the employee can approve as EMPLOYEE" }, { status: 403 });
    }
    if (role === "MANAGER" && !allowAppraisalTestBypass()) {
      const managerSystemUserId = await resolveManagerSystemUserId(appraisal.employee_id) ?? appraisal.manager_employee_id ?? null;
      if (managerSystemUserId !== user.employee_id) {
        return NextResponse.json({ error: "Only the manager can approve as MANAGER" }, { status: 403 });
      }
    }

    const { error: insErr } = await supabase.from("appraisal_approvals").insert({
      appraisal_id: appraisalId,
      approved_by: user.id,
      role,
      comment: comment ?? null,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "You have already approved" }, { status: 400 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const approvalLabel = role === "EMPLOYEE" ? "Employee approved workplan" : "Manager approved workplan";
    await supabase.from("appraisal_audit").insert({
      appraisal_id: appraisalId,
      action_type: "approval",
      actor_id: user.id,
      summary: approvalLabel,
    });

    const { data: approvals } = await supabase
      .from("appraisal_approvals")
      .select("role")
      .eq("appraisal_id", appraisalId);

    const hasEmployee = approvals?.some((a) => a.role === "EMPLOYEE");
    const hasManager = approvals?.some((a) => a.role === "MANAGER");

    if (hasEmployee && hasManager) {
      const { error: transErr } = await transitionStatus(
        supabase,
        appraisalId,
        "SELF_ASSESSMENT",
        user.id,
        "Both parties approved workplan"
      );
      if (transErr) {
        return NextResponse.json({ error: transErr }, { status: 400 });
      }
      return NextResponse.json({ success: true, status: "SELF_ASSESSMENT", bothApproved: true });
    }

    return NextResponse.json({ success: true, status: "PENDING_APPROVAL", bothApproved: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
