import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getReportingStructureFromDynamics } from "@/lib/reporting-structure";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

/**
 * GET /api/appraisals/[id]/has-direct-reports
 * Returns whether the appraisal's employee has direct reports in HRMIS (same logic as profile).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appraisalId } = await params;
    const supabase = getSupabase();

    const { data: appraisal, error } = await supabase
      .from("appraisals")
      .select("employee_id")
      .eq("id", appraisalId)
      .single();

    if (error || !appraisal?.employee_id) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const structure = await getReportingStructureFromDynamics(
      appraisal.employee_id,
      null
    );
    const hasDirectReports = (structure.directReports?.length ?? 0) > 0;

    return NextResponse.json({ hasDirectReports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
