import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await context.params;
    const body = await req.json();
    const { text } = body as { text: string };
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: appraisal } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();

    if (!appraisal) return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const canAccess =
      user.roles?.some((r) => r === "hr" || r === "admin") ||
      appraisal.employee_id === user.employee_id ||
      appraisal.manager_employee_id === user.employee_id;

    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: existing } = await supabase
      .from("appraisal_summary_data")
      .select("id, key_accomplishments")
      .eq("appraisal_id", appraisalId)
      .maybeSingle();

    const current = (existing?.key_accomplishments ?? "").trim();
    const appended = current ? `${current}\n\n• ${text.trim()}` : `• ${text.trim()}`;

    if (existing) {
      await supabase
        .from("appraisal_summary_data")
        .update({ key_accomplishments: appended })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("appraisal_summary_data")
        .insert({ appraisal_id: appraisalId, key_accomplishments: appended });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[summary/append-achievement]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
