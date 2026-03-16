import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { assertTransition, InvalidAppraisalTransitionError } from "@/lib/appraisal-workflow";
import { APPRAISAL_STATUS, isAppraisalStatus, type AppraisalStatus } from "@/types/appraisal";

const UpdateStatusSchema = z.object({
  status: z.enum(APPRAISAL_STATUS as unknown as [string, ...string[]]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.roles?.length) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: appraisalId } = await params;
    if (!appraisalId) {
      return NextResponse.json(
        { error: "Appraisal id is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const nextStatus = parsed.data.status;
    if (!isAppraisalStatus(nextStatus)) {
      return NextResponse.json(
        { error: "Invalid status", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Server configuration error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key);
    const { data: row, error: fetchErr } = await supabase
      .from("appraisals")
      .select("status, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json(
        { error: "Appraisal not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const currentStatus = row.status as string;
    if (!isAppraisalStatus(currentStatus)) {
      return NextResponse.json(
        { error: "Invalid current status", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    try {
      assertTransition(currentStatus as AppraisalStatus, nextStatus as AppraisalStatus);
    } catch (e) {
      if (e instanceof InvalidAppraisalTransitionError) {
        return NextResponse.json(
          { error: e.message, code: "INVALID_APPRAISAL_TRANSITION" },
          { status: 400 }
        );
      }
      throw e;
    }

    const { error: timelineErr } = await supabase.from("appraisal_timeline").insert({
      appraisal_id: appraisalId,
      from_status: currentStatus,
      to_status: nextStatus,
      changed_by: user.id,
    });
    if (timelineErr) {
      return NextResponse.json(
        { error: timelineErr.message, code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    const auditSummary = `${currentStatus} → ${nextStatus}`;
    await supabase.from("appraisal_audit").insert({
      appraisal_id: appraisalId,
      action_type: "status_change",
      actor_id: user.id,
      summary: auditSummary,
    });

    const updatePayload: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "SUBMITTED") updatePayload.submitted_at = new Date().toISOString();
    if (nextStatus === "PENDING_SIGNOFF") updatePayload.manager_completed_at = new Date().toISOString();
    if (nextStatus === "COMPLETE") updatePayload.hr_closed_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("appraisals")
      .update(updatePayload)
      .eq("id", appraisalId);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message, code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { id: appraisalId, status: nextStatus },
      meta: {},
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Update status failed";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
