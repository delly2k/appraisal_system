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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: suggestion, error } = await supabase
      .from("achievement_suggestions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!canAccessEvidenceForEmployee(user, suggestion.employee_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(suggestion);
  } catch (e) {
    console.error("[evidence/suggestions GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const { status: newStatus, edited_text: editedText } = body as {
      status?: "accepted" | "edited" | "rejected";
      edited_text?: string;
    };

    if (!newStatus) return NextResponse.json({ error: "Missing status" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supabase
      .from("achievement_suggestions")
      .select("id, employee_id, achievement_text")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!canAccessEvidenceForEmployee(user, existing.employee_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: { status: string; edited_text?: string } = { status: newStatus };
    if (newStatus === "edited" && editedText != null) updateData.edited_text = editedText;

    const { error: updateErr } = await supabase
      .from("achievement_suggestions")
      .update(updateData)
      .eq("id", id);

    if (updateErr) throw updateErr;

    const finalText = newStatus === "edited" && editedText ? editedText : existing.achievement_text;

    if (newStatus === "accepted" || newStatus === "edited") {
      await supabase.from("achievement_timeline").insert({
        employee_id: existing.employee_id,
        achievement_id: id,
        date_detected: new Date().toISOString().slice(0, 10),
        summary: finalText,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[evidence/suggestions PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
