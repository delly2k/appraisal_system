import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { transitionStatus } from "@/lib/appraisal-workflow";
import { isAppraisalStatus } from "@/types/appraisal";
import { allowAppraisalTestBypass } from "@/lib/appraisal-test-bypass";

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

    const isHR = user.roles?.some((r) => r === "hr" || r === "admin");
    if (!allowAppraisalTestBypass() && !isHR) {
      return NextResponse.json({ error: "Only HR can mark appraisal as complete" }, { status: 403 });
    }

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, status, cycle_id, employee_id, review_type")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const status = appraisal.status as string;
    if (!isAppraisalStatus(status) || status !== "HR_REVIEW") {
      return NextResponse.json(
        { error: "Appraisal must be in HR_REVIEW to complete" },
        { status: 400 }
      );
    }

    const { error: transErr } = await transitionStatus(
      supabase,
      appraisalId,
      "COMPLETE",
      user.id,
      "Appraisal closed"
    );

    if (transErr) {
      return NextResponse.json({ error: transErr }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: "COMPLETE" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
