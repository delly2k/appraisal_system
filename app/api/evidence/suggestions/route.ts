import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const appraisalId = searchParams.get("appraisalId");
    const employeeId = searchParams.get("employeeId");

    if (!appraisalId || !employeeId) {
      return NextResponse.json(
        { error: "Missing appraisalId or employeeId" },
        { status: 400 }
      );
    }

    if (!canAccessEvidenceForEmployee(user, employeeId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: rows, error } = await supabase
      .from("achievement_suggestions")
      .select("id, achievement_text, confidence_level, evidence_summary")
      .eq("appraisal_id", appraisalId)
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const suggestions = (rows ?? []).map((r) => ({
      id: r.id,
      achievement_text: r.achievement_text,
      confidence_level: r.confidence_level,
      evidence_summary: Array.isArray(r.evidence_summary) ? r.evidence_summary : [],
    }));

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("[evidence/suggestions list GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
