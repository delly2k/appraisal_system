import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireHrAdmin() {
  const user = await getCurrentUser();
  if (!user?.roles?.length) return null;
  const isHrAdmin = user.roles.some((r) => ["hr", "admin", "super_admin"].includes(r as string));
  return isHrAdmin ? user : null;
}

/**
 * GET /api/admin/operational-plan/[cycleId]
 * Returns one cycle with objectives (HR/Admin only).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const user = await requireHrAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { cycleId } = await params;
  if (!cycleId) {
    return NextResponse.json({ error: "cycleId required" }, { status: 400 });
  }

  const { data: cycleRow, error: cycleError } = await supabase
    .from("operational_plan_cycles")
    .select("id, cycle_year, label, is_active, uploaded_by, uploaded_at, total_corp, total_dept, created_at")
    .eq("id", cycleId)
    .maybeSingle();

  if (cycleError) {
    return NextResponse.json({ error: cycleError.message }, { status: 500 });
  }
  if (!cycleRow) {
    return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  }

  let uploaded_by_name = "—";
  if (cycleRow.uploaded_by) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("display_name")
      .eq("id", cycleRow.uploaded_by)
      .maybeSingle();
    if (appUser?.display_name) uploaded_by_name = appUser.display_name;
  }

  const [corpRes, deptRes] = await Promise.all([
    supabase
      .from("corporate_objectives")
      .select("id, achieveit_id, name, created_at")
      .eq("cycle_id", cycleId)
      .order("name", { ascending: true }),
    supabase
      .from("department_objectives")
      .select("id, achieveit_id, name, division, created_at")
      .eq("cycle_id", cycleId)
      .order("name", { ascending: true }),
  ]);

  if (corpRes.error) {
    return NextResponse.json({ error: corpRes.error.message }, { status: 500 });
  }
  if (deptRes.error) {
    return NextResponse.json({ error: deptRes.error.message }, { status: 500 });
  }

  const corporate = (corpRes.data ?? []).map((r) => ({
    id: r.id,
    type: "CORPORATE" as const,
    external_id: r.achieveit_id ?? "",
    title: r.name,
    division: undefined as string | undefined,
    weight: undefined as number | undefined,
    created_at: r.created_at,
  }));

  const divisional = (deptRes.data ?? []).map((r) => ({
    id: r.id,
    type: "DIVISIONAL" as const,
    external_id: r.achieveit_id ?? "",
    title: r.name,
    division: r.division ?? undefined,
    weight: undefined as number | undefined,
    created_at: r.created_at,
  }));

  const objectives = [...corporate, ...divisional];

  return NextResponse.json({
    cycle: {
      id: cycleRow.id,
      label: cycleRow.label,
      cycle_year: cycleRow.cycle_year,
      is_active: cycleRow.is_active,
      corporate_count: cycleRow.total_corp ?? corporate.length,
      divisional_count: cycleRow.total_dept ?? divisional.length,
      created_at: cycleRow.created_at,
      uploaded_by_name,
    },
    objectives,
  });
}
