import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { cancelAgreement } from "@/lib/adobe-sign";
import { sendNotification, type SupabaseLike } from "@/lib/notifications";

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
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason ?? "Cancelled by reviewer";

    const supabase = getSupabaseAdmin();

    const { data: agreement, error: aggErr } = await supabase
      .from("appraisal_agreements")
      .select("id, adobe_agreement_id, appraisal_id")
      .eq("appraisal_id", appraisalId)
      .eq("status", "OUT_FOR_SIGNATURE")
      .maybeSingle();

    if (aggErr || !agreement) {
      return NextResponse.json({ error: "No active agreement found" }, { status: 404 });
    }

    const { data: appraisal } = await supabase
      .from("appraisals")
      .select("employee_id, manager_employee_id")
      .eq("id", agreement.appraisal_id)
      .single();

    if (!appraisal) return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const isManager = currentUser.employee_id === appraisal.manager_employee_id;
    const isHR = currentUser.roles?.some((r) => r === "hr" || r === "admin");
    if (!isManager && !isHR) {
      return NextResponse.json({ error: "Only the manager or HR may cancel sign-off" }, { status: 403 });
    }

    await cancelAgreement(agreement.adobe_agreement_id, reason);

    await supabase
      .from("appraisal_agreements")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", agreement.id);

    await supabase
      .from("appraisals")
      .update({ status: "MANAGER_REVIEW" })
      .eq("id", appraisalId);

    await sendNotification(
      {
        recipientEmployeeId: appraisal.employee_id,
        type: "SIGNOFF_CANCELLED",
        message: "Sign-off for your FY 2026 appraisal has been cancelled and returned to Manager Review.",
        appraisalId,
      },
      supabase as unknown as SupabaseLike
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
