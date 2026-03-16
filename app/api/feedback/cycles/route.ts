import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

/**
 * GET /api/feedback/cycles
 * List 360 feedback cycles. Returns all cycles (any authenticated user can see) ordered by end_date desc.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("feedback_cycle")
      .select("id, cycle_name, description, linked_appraisal_cycle_id, start_date, end_date, status, created_at")
      .order("end_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load feedback cycles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
