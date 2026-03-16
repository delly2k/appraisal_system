import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is HR or admin
    const roles = user.roles ?? [];
    if (!roles.includes("hr") && !roles.includes("admin")) {
      return NextResponse.json(
        { error: "Only HR/Admin can open the assessment phase" },
        { status: 403 }
      );
    }

    const { cycleId } = await params;
    const supabase = getSupabaseAdmin();

    // Call the open_assessment_phase function
    const { data: result, error: openErr } = await supabase.rpc(
      "open_assessment_phase",
      { p_cycle_id: cycleId }
    );

    if (openErr) {
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Failed to open assessment phase" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      stats: result.stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
