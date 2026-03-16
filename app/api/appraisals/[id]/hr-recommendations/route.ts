import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

function isHR(user: { roles?: string[] } | null): boolean {
  const roles = user?.roles ?? [];
  return roles.includes("hr") || roles.includes("admin");
}

const DEFAULT_RECOMMENDATIONS: Record<string, boolean> = {
  pay_increment: false,
  withhold_increment: false,
  eligible_for_award: false,
  not_eligible_for_award: false,
  suitable_for_promotion: false,
  job_enrichment: false,
  reassignment: false,
  remedial_action: false,
  probation: false,
  separation: false,
};

function normalizeRecommendations(obj: unknown): Record<string, boolean> {
  if (obj == null || typeof obj !== "object") return { ...DEFAULT_RECOMMENDATIONS };
  const out = { ...DEFAULT_RECOMMENDATIONS };
  for (const key of Object.keys(DEFAULT_RECOMMENDATIONS)) {
    if (typeof (obj as Record<string, unknown>)[key] === "boolean") {
      out[key] = (obj as Record<string, boolean>)[key];
    }
  }
  return out;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isHR(user)) return NextResponse.json({ error: "HR access required" }, { status: 403 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: row, error } = await supabase
      .from("appraisal_hr_recommendations")
      .select("recommendations, other_notes, saved_at")
      .eq("appraisal_id", appraisalId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ recommendations: DEFAULT_RECOMMENDATIONS, other_notes: "", saved_at: null }, { status: 200 });

    return NextResponse.json({
      recommendations: normalizeRecommendations(row.recommendations),
      other_notes: row.other_notes ?? "",
      saved_at: row.saved_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isHR(user)) return NextResponse.json({ error: "HR access required" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const recommendations = normalizeRecommendations(body?.recommendations);
    const other_notes = typeof body?.other_notes === "string" ? body.other_notes : "";

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, status")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }
    if ((appraisal.status as string) !== "HR_REVIEW") {
      return NextResponse.json({ error: "Appraisal must be in HR Review to save recommendations" }, { status: 400 });
    }

    const { error: upsertErr } = await supabase
      .from("appraisal_hr_recommendations")
      .upsert(
        {
          appraisal_id: appraisalId,
          recommendations,
          other_notes: other_notes || null,
          saved_by: user.id,
          saved_at: new Date().toISOString(),
        },
        { onConflict: "appraisal_id" }
      );

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    await supabase.from("appraisal_audit").insert({
      appraisal_id: appraisalId,
      action_type: "hr_recommendations_saved",
      actor_id: user.id,
      summary: "Saved HR recommendations",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
