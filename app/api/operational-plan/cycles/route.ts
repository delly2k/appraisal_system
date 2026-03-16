import { NextResponse } from "next/server";
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
 * GET /api/operational-plan/cycles
 * Returns operational plan cycles (HR/Admin only).
 */
export async function GET() {
  const user = await requireHrAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("operational_plan_cycles")
    .select("id, cycle_year, label, is_active, uploaded_at, total_corp, total_dept, achieveit_plan_id")
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
