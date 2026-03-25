import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

/** True if current user (manager_employee_id) is the direct primary manager of the profile owner (employee_id). */
async function isManagerOfProfileOwner(
  supabase: SupabaseClient<any>,
  profileOwnerEmployeeId: string,
  currentUserEmployeeId: string | null | undefined
): Promise<boolean> {
  if (!currentUserEmployeeId || !profileOwnerEmployeeId) return false;
  const { data: lines } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", currentUserEmployeeId)
    .eq("employee_id", profileOwnerEmployeeId)
    .eq("is_primary", true)
    .limit(1);
  return (lines?.length ?? 0) > 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { employeeId } = await params;
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

    const supabase = getSupabase();
    const isManager = await isManagerOfProfileOwner(supabase, employeeId, user.employee_id);
    if (!isManager) {
      return NextResponse.json({ error: "Only the direct manager can update manager notes and EIP" }, { status: 403 });
    }

    const body = await req.json();
    const { eip_issued, eip_next_fy, manager_ld_notes } = body;

    const payload: Record<string, unknown> = {
      last_updated_at: new Date().toISOString(),
    };
    if (typeof eip_issued === "boolean") {
      payload.eip_issued = eip_issued;
      if (user.source === "app_users") {
        payload.eip_set_by = user.id;
      }
      payload.eip_set_at = new Date().toISOString();
    }
    if (typeof eip_next_fy === "boolean") payload.eip_next_fy = eip_next_fy;
    if (typeof manager_ld_notes === "string" || manager_ld_notes === null) {
      payload.manager_ld_notes = manager_ld_notes;
      if (user.source === "app_users") {
        payload.manager_notes_by = user.id;
      }
      payload.manager_notes_at = new Date().toISOString();
    }

    const { data: existing } = await supabase
      .from("employee_development_profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("employee_development_profiles")
        .update(payload)
        .eq("employee_id", employeeId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from("employee_development_profiles")
        .insert({ employee_id: employeeId, ...payload });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
