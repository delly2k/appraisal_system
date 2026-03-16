import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { transitionStatus } from "@/lib/appraisal-workflow";
import { allowAppraisalTestBypass } from "@/lib/appraisal-test-bypass";
import { isAppraisalStatus } from "@/types/appraisal";
import { fetchCompletionReport } from "@/lib/appraisal-completion";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
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
      .select("id, status, employee_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const status = appraisal.status as string;
    if (!isAppraisalStatus(status) || status !== "SELF_ASSESSMENT") {
      return NextResponse.json(
        { error: "Appraisal must be in SELF_ASSESSMENT to submit" },
        { status: 400 }
      );
    }

    if (!allowAppraisalTestBypass() && appraisal.employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Only the employee can submit self-assessment" }, { status: 403 });
    }

    const report = await fetchCompletionReport(supabase, appraisalId);
    if (!report?.canSubmit) {
      const message = report?.blockers?.length
        ? `Complete all required fields: ${report.blockers.join("; ")}`
        : "Complete all required fields before submitting.";
      return NextResponse.json({ error: message, blockers: report?.blockers }, { status: 400 });
    }

    const { error: transErr } = await transitionStatus(
      supabase,
      appraisalId,
      "MANAGER_REVIEW",
      user.id,
      "Self-assessment submitted"
    );

    if (transErr) {
      return NextResponse.json({ error: transErr }, { status: 400 });
    }

    // Snapshot work plan: preserve employee's actual_result and points for manager view
    const { data: workplan } = await supabase
      .from("workplans")
      .select("id")
      .eq("appraisal_id", appraisalId)
      .maybeSingle();

    if (workplan?.id) {
      const { data: items } = await supabase
        .from("workplan_items")
        .select("id, actual_result, points")
        .eq("workplan_id", workplan.id);
      if (items?.length) {
        for (const item of items) {
          await supabase
            .from("workplan_items")
            .update({
              employee_actual_result: item.actual_result,
              employee_points: item.points,
            })
            .eq("id", item.id);
        }
      }
    }

    // Snapshot development profile at submission time for manager/HOD/HR to see as-of submission
    const { data: profileOwner } = await supabase
      .from("app_users")
      .select("id")
      .eq("employee_id", appraisal.employee_id)
      .maybeSingle();
    if (profileOwner?.id) {
      const { data: devProfile } = await supabase
        .from("employee_development_profiles")
        .select("*")
        .eq("employee_id", profileOwner.id)
        .maybeSingle();
      if (devProfile) {
        await supabase
          .from("development_profile_snapshots")
          .upsert(
            {
              appraisal_id: appraisalId,
              employee_id: profileOwner.id,
              snapshot_data: devProfile as Record<string, unknown>,
              snapshotted_at: new Date().toISOString(),
            },
            { onConflict: "appraisal_id" }
          );
      }
    }

    return NextResponse.json({ success: true, status: "MANAGER_REVIEW" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
