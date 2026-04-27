import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { allowAppraisalTestBypass } from "@/lib/appraisal-test-bypass";
import { resolveManagerAccessForAppraisal } from "@/lib/appraisal-manager-access";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and service role key required");
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ id: string; checkinId: string }> };

function canAccessAppraisal(
  user: { roles?: string[]; employee_id?: string | null; division_id?: string | null },
  appraisal: { employee_id: string; manager_employee_id: string | null; division_id?: string | null },
  hasManagerAccess: boolean
) {
  return (
    user.roles?.some((r) => r === "hr" || r === "admin") ||
    appraisal.employee_id === user.employee_id ||
    hasManagerAccess ||
    (user.roles?.includes("gm") && appraisal.division_id === user.division_id)
  );
}

function isManagerOrHR(
  user: { roles?: string[]; employee_id?: string | null },
  hasManagerAccess: boolean
) {
  return (
    user.roles?.some((r) => r === "hr" || r === "admin") ||
    hasManagerAccess
  );
}

async function ensureAccessAndCheckIn(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  appraisalId: string,
  checkinId: string,
  user: { roles?: string[]; employee_id?: string | null; division_id?: string | null }
) {
  const { data: appraisal, error: appErr } = await supabase
    .from("appraisals")
    .select("id, employee_id, manager_employee_id, division_id")
    .eq("id", appraisalId)
    .single();

  if (appErr || !appraisal) return { error: NextResponse.json({ error: "Appraisal not found" }, { status: 404 }) };
  const managerAccess = await resolveManagerAccessForAppraisal({
    supabase,
    appraisalId,
    appraisalEmployeeId: appraisal.employee_id,
    appraisalManagerEmployeeId: appraisal.manager_employee_id,
    currentEmployeeId: user.employee_id ?? null,
  });
  if (!canAccessAppraisal(user, appraisal, managerAccess.hasManagerAccess)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const { data: checkIn, error: ciErr } = await supabase
    .from("check_ins")
    .select("*")
    .eq("id", checkinId)
    .eq("appraisal_id", appraisalId)
    .single();

  if (ciErr || !checkIn) return { error: NextResponse.json({ error: "Check-in not found" }, { status: 404 }) };
  return { appraisal, checkIn };
}

// GET — single check-in with all responses + workplan item details
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId, checkinId } = await context.params;
    const supabase = getSupabaseAdmin();

    const result = await ensureAccessAndCheckIn(supabase, appraisalId, checkinId, user);
    if (result.error) return result.error;
    const { checkIn } = result;

    const { data: responses, error: respErr } = await supabase
      .from("check_in_responses")
      .select("*")
      .eq("check_in_id", checkinId)
      .order("created_at", { ascending: true });

    if (respErr) {
      return NextResponse.json({ error: respErr.message }, { status: 500 });
    }

    const itemIds = [...new Set((responses ?? []).map((r: { workplan_item_id: string }) => r.workplan_item_id))];
    const { data: wpItems } = itemIds.length
      ? await supabase
          .from("workplan_items")
          .select("id, major_task, corporate_objective, division_objective, key_output, performance_standard, metric_target, metric_type, weight")
          .in("id", itemIds)
      : { data: [] };

    type WpItem = { id: string; major_task: unknown; corporate_objective: unknown; division_objective: unknown; key_output: unknown; performance_standard: unknown; metric_target: unknown; metric_type: unknown; weight: unknown };
    const itemList: WpItem[] = Array.isArray(wpItems) ? wpItems : [];
    const itemMap = itemList.reduce<Record<string, WpItem>>((acc, r) => {
      if (r?.id) acc[r.id] = r;
      return acc;
    }, {});

    const enrichedResponses = (responses ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      workplan_item: itemMap[r.workplan_item_id as string]
        ? {
            id: itemMap[r.workplan_item_id as string].id,
            major_task: itemMap[r.workplan_item_id as string].major_task ?? "",
            corporate_objective: itemMap[r.workplan_item_id as string].corporate_objective ?? "",
            division_objective: itemMap[r.workplan_item_id as string].division_objective ?? "",
            key_output: itemMap[r.workplan_item_id as string].key_output ?? "",
            performance_standard: itemMap[r.workplan_item_id as string].performance_standard ?? "",
            metric_target: itemMap[r.workplan_item_id as string].metric_target ?? null,
            metric_type: itemMap[r.workplan_item_id as string].metric_type ?? null,
            weight: Number(itemMap[r.workplan_item_id as string].weight) ?? 0,
          }
        : undefined,
    }));

    let initiated_by_employee: { full_name: string } | undefined;
    if (checkIn.initiated_by) {
      const { data: initEmp } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", checkIn.initiated_by)
        .single();
      if (initEmp?.full_name) initiated_by_employee = { full_name: initEmp.full_name };
    }

    return NextResponse.json({
      ...checkIn,
      responses: enrichedResponses,
      initiated_by_employee,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update check-in (employee submit/draft, manager respond/complete/cancel)
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId, checkinId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { action, responses: bodyResponses, manager_overall_notes, saveOnly } = body as {
      action?: string;
      responses?: Array<{
        workplan_item_id: string;
        employee_status?: string;
        progress_pct?: number | null;
        employee_comment?: string | null;
        mgr_status_override?: string;
        mgr_comment?: string | null;
      }>;
      manager_overall_notes?: string | null;
      saveOnly?: boolean;
    };

    const supabase = getSupabaseAdmin();
    const result = await ensureAccessAndCheckIn(supabase, appraisalId, checkinId, user);
    if (result.error) return result.error;
    const { appraisal, checkIn } = result;

    const now = new Date().toISOString();
    const status = checkIn.status as string;

    if (action === "EMPLOYEE_SUBMIT") {
      if (appraisal.employee_id !== user.employee_id && !user.roles?.some((r) => r === "hr" || r === "admin")) {
        return NextResponse.json({ error: "Only the employee can submit" }, { status: 403 });
      }
      if (status !== "OPEN") {
        return NextResponse.json({ error: "Check-in is not open for submission" }, { status: 400 });
      }
      for (const r of bodyResponses ?? []) {
        const payload: Record<string, unknown> = {
          employee_status: r.employee_status ?? null,
          progress_pct: r.progress_pct != null ? Math.min(100, Math.max(0, Number(r.progress_pct))) : null,
          employee_comment: r.employee_comment ?? null,
          employee_updated_at: now,
          updated_at: now,
        };
        await supabase
          .from("check_in_responses")
          .update(payload)
          .eq("check_in_id", checkinId)
          .eq("workplan_item_id", r.workplan_item_id);
      }
      await supabase
        .from("check_ins")
        .update({ status: "EMPLOYEE_SUBMITTED", employee_submitted_at: now, updated_at: now })
        .eq("id", checkinId);
      try {
        const { sendCheckInSubmittedToManager } = await import("@/lib/notifications");
        const { data: empRow } = await supabase.from("employees").select("full_name").eq("employee_id", appraisal.employee_id).single();
        const employeeName = empRow?.full_name ?? "Employee";
        let managerEmail: string | null = null;
        if (appraisal.manager_employee_id) {
          const { data: appUser } = await supabase.from("app_users").select("email").eq("employee_id", appraisal.manager_employee_id).limit(1).maybeSingle();
          managerEmail = appUser?.email ?? null;
        }
        await sendCheckInSubmittedToManager({
          appraisalId,
          checkInId: checkinId,
          employeeName,
          checkInTitle: (checkIn as { title?: string }).title ?? "Check-in",
          managerEmail,
        });
        const { createNotificationForEmployeeId } = await import("@/lib/notifications/create");
        await createNotificationForEmployeeId(appraisal.manager_employee_id, {
          type: "checkin.completed",
          title: "Check-in submitted",
          body: `${employeeName} has submitted their check-in: "${(checkIn as { title?: string }).title ?? "Check-in"}".`,
          link: `/appraisals/${appraisalId}`,
          metadata: { appraisal_id: appraisalId, check_in_id: checkinId },
        });
      } catch {
        // notification is non-blocking
      }
      return NextResponse.json({ success: true });
    }

    if (action === "EMPLOYEE_SAVE_DRAFT") {
      if (appraisal.employee_id !== user.employee_id && !user.roles?.some((r) => r === "hr" || r === "admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (status !== "OPEN") {
        return NextResponse.json({ error: "Check-in is not open for draft" }, { status: 400 });
      }
      for (const r of bodyResponses ?? []) {
        const payload: Record<string, unknown> = {
          employee_status: r.employee_status ?? null,
          progress_pct: r.progress_pct != null ? Math.min(100, Math.max(0, Number(r.progress_pct))) : null,
          employee_comment: r.employee_comment ?? null,
          employee_updated_at: now,
          updated_at: now,
        };
        await supabase
          .from("check_in_responses")
          .update(payload)
          .eq("check_in_id", checkinId)
          .eq("workplan_item_id", r.workplan_item_id);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "MANAGER_RESPOND") {
      const managerAccess = await resolveManagerAccessForAppraisal({
        supabase,
        appraisalId,
        appraisalEmployeeId: appraisal.employee_id,
        appraisalManagerEmployeeId: appraisal.manager_employee_id,
        currentEmployeeId: user.employee_id ?? null,
      });
      if (!isManagerOrHR(user, managerAccess.hasManagerAccess)) {
        return NextResponse.json({ error: "Only the manager or HR can add a response" }, { status: 403 });
      }
      if (status !== "EMPLOYEE_SUBMITTED") {
        return NextResponse.json({ error: "Check-in must be in EMPLOYEE_SUBMITTED to add manager response" }, { status: 400 });
      }
      for (const r of bodyResponses ?? []) {
        const payload: Record<string, unknown> = {
          mgr_status_override: r.mgr_status_override ?? null,
          mgr_comment: r.mgr_comment ?? null,
          updated_at: now,
        };
        await supabase
          .from("check_in_responses")
          .update(payload)
          .eq("check_in_id", checkinId)
          .eq("workplan_item_id", r.workplan_item_id);
      }
      await supabase
        .from("check_ins")
        .update({
          manager_overall_notes: manager_overall_notes != null ? String(manager_overall_notes).trim() || null : (checkIn as { manager_overall_notes?: string | null }).manager_overall_notes,
          updated_at: now,
        })
        .eq("id", checkinId);
      return NextResponse.json({ success: true });
    }

    if (action === "MANAGER_COMPLETE") {
      const managerAccess = await resolveManagerAccessForAppraisal({
        supabase,
        appraisalId,
        appraisalEmployeeId: appraisal.employee_id,
        appraisalManagerEmployeeId: appraisal.manager_employee_id,
        currentEmployeeId: user.employee_id ?? null,
      });
      if (!isManagerOrHR(user, managerAccess.hasManagerAccess) && !allowAppraisalTestBypass()) {
        return NextResponse.json({ error: "Only the manager or HR can complete" }, { status: 403 });
      }
      if (status !== "EMPLOYEE_SUBMITTED") {
        return NextResponse.json({ error: "Check-in must be in EMPLOYEE_SUBMITTED to complete" }, { status: 400 });
      }
      for (const r of bodyResponses ?? []) {
        const payload: Record<string, unknown> = {
          mgr_status_override: r.mgr_status_override ?? null,
          mgr_comment: r.mgr_comment ?? null,
          mgr_acknowledged_at: now,
          updated_at: now,
        };
        await supabase
          .from("check_in_responses")
          .update(payload)
          .eq("check_in_id", checkinId)
          .eq("workplan_item_id", r.workplan_item_id);
      }
      await supabase
        .from("check_ins")
        .update({
          status: "MANAGER_REVIEWED",
          manager_reviewed_at: now,
          manager_overall_notes: manager_overall_notes != null ? String(manager_overall_notes).trim() || null : (checkIn as { manager_overall_notes?: string | null }).manager_overall_notes,
          updated_at: now,
        })
        .eq("id", checkinId);
      try {
        const { sendCheckInReviewedToEmployee } = await import("@/lib/notifications");
        const { data: empRow } = await supabase.from("employees").select("full_name, email").eq("employee_id", appraisal.employee_id).single();
        const employeeName = empRow?.full_name ?? "Employee";
        const employeeEmail = empRow?.email ?? null;
        await sendCheckInReviewedToEmployee({
          appraisalId,
          checkInId: checkinId,
          employeeName,
          employeeEmail,
        });
        const { createNotificationForEmployeeId } = await import("@/lib/notifications/create");
        await createNotificationForEmployeeId(appraisal.employee_id, {
          type: "system.announcement",
          title: "Check-in reviewed",
          body: "Your manager has reviewed your check-in. Log in to the appraisal portal to view their feedback.",
          link: `/appraisals/${appraisalId}`,
          metadata: { appraisal_id: appraisalId, check_in_id: checkinId, kind: "checkin_manager_reviewed" },
        });
      } catch {
        // notification is non-blocking
      }
      return NextResponse.json({ success: true });
    }

    if (action === "CANCEL") {
      const managerAccess = await resolveManagerAccessForAppraisal({
        supabase,
        appraisalId,
        appraisalEmployeeId: appraisal.employee_id,
        appraisalManagerEmployeeId: appraisal.manager_employee_id,
        currentEmployeeId: user.employee_id ?? null,
      });
      if (!isManagerOrHR(user, managerAccess.hasManagerAccess) && !allowAppraisalTestBypass()) {
        return NextResponse.json({ error: "Only the manager or HR can cancel" }, { status: 403 });
      }
      await supabase
        .from("check_ins")
        .update({ status: "CANCELLED", updated_at: now })
        .eq("id", checkinId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
