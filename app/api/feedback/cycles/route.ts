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
    const isHrOrAdmin = (user.roles ?? []).some((r) => r === "hr" || r === "admin");

    let cycleIds: string[] | null = null;
    if (!isHrOrAdmin) {
      const employeeId = user.employee_id ?? null;
      if (!employeeId) return NextResponse.json([]);

      const [{ data: participantRows }, { data: reviewerRows }] = await Promise.all([
        supabase.from("feedback_participant").select("cycle_id").eq("employee_id", employeeId),
        supabase.from("feedback_reviewer").select("cycle_id").eq("reviewer_employee_id", employeeId),
      ]);
      const idSet = new Set<string>();
      for (const r of participantRows ?? []) idSet.add(r.cycle_id);
      for (const r of reviewerRows ?? []) idSet.add(r.cycle_id);
      cycleIds = [...idSet];
      if (cycleIds.length === 0) return NextResponse.json([]);
    }

    let query = supabase
      .from("feedback_cycle")
      .select("id, cycle_name, description, linked_appraisal_cycle_id, start_date, end_date, status, created_at")
      .order("end_date", { ascending: false });
    if (cycleIds) query = query.in("id", cycleIds);
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load feedback cycles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
