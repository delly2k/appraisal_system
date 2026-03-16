import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";
import { collectAppraisalEvidence } from "@/lib/evidence-collectors";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { employeeId, appraisalId, reviewStart, reviewEnd } = body as {
      employeeId: string;
      appraisalId: string;
      reviewStart: string;
      reviewEnd: string;
    };
    if (!employeeId || !appraisalId || !reviewStart || !reviewEnd) {
      return NextResponse.json({ error: "Missing employeeId, appraisalId, reviewStart, or reviewEnd" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: appraisal } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();
    if (!appraisal || appraisal.employee_id !== employeeId) return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    if (!canAccessEvidenceForEmployee(user, employeeId, { appraisalManagerId: appraisal.manager_employee_id ?? undefined })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const collected = await collectAppraisalEvidence(supabase, employeeId, appraisalId, reviewStart, reviewEnd);
    return NextResponse.json({ collected });
  } catch (e) {
    console.error("[evidence/collect/appraisal]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
