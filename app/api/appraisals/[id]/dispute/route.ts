import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { transitionStatus } from "@/lib/appraisal-workflow";
import { isAppraisalStatus } from "@/types/appraisal";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const comment = (body?.comment ?? body?.reason ?? "") as string;

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
    if (!isAppraisalStatus(status) || status !== "PENDING_SIGNOFF") {
      return NextResponse.json(
        { error: "Appraisal must be in PENDING_SIGNOFF to raise dispute" },
        { status: 400 }
      );
    }

    if (appraisal.employee_id !== user.employee_id) {
      return NextResponse.json({ error: "Only the employee can raise a dispute" }, { status: 403 });
    }

    const { error: transErr } = await transitionStatus(
      supabase,
      appraisalId,
      "MANAGER_REVIEW",
      user.id,
      comment ? `Dispute: ${comment}` : "Returned to manager"
    );

    if (transErr) {
      return NextResponse.json({ error: transErr }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: "MANAGER_REVIEW" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
