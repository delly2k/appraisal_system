import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { legacyRoleForRoles } from "@/lib/app-user-legacy-role";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireHrAdmin() {
  const user = await getCurrentUser();
  if (!user?.roles?.length) return null;
  const isAdmin = user.roles.some((r) => r === "hr" || r === "admin");
  return isAdmin ? user : null;
}

const ALLOWED_ROLES = ["admin", "hr"] as const;

/**
 * PATCH /api/admin/users/[id]
 * Update app user display_name, roles, employee_id, division_id, or is_active. HR/admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "User id required" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const display_name = body.display_name !== undefined ? (body.display_name === null || body.display_name === "" ? null : String(body.display_name).trim()) : undefined;
    const legacyRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : undefined;
    const rolesRaw = Array.isArray(body.roles) ? body.roles : legacyRole ? [legacyRole] : undefined;
    const roles = rolesRaw
      ? rolesRaw
          .map((r: unknown) => String(r).trim().toLowerCase())
          .filter((r: string): r is (typeof ALLOWED_ROLES)[number] =>
            ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number])
          )
      : undefined;
    const employee_id = body.employee_id !== undefined ? (body.employee_id === null ? null : String(body.employee_id).trim()) : undefined;
    const division_id = body.division_id !== undefined ? (body.division_id === null ? null : String(body.division_id).trim()) : undefined;
    const is_active = typeof body.is_active === "boolean" ? body.is_active : undefined;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (display_name !== undefined) updates.display_name = display_name;
    if (rolesRaw !== undefined) {
      if (!roles || roles.length !== rolesRaw.length) {
        return NextResponse.json({ error: "Invalid roles (only hr/admin allowed)" }, { status: 400 });
      }
      updates.roles = roles;
      updates.role = legacyRoleForRoles(roles);
    }
    if (employee_id !== undefined) updates.employee_id = employee_id || null;
    if (division_id !== undefined) updates.division_id = division_id || null;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id)
      .select("roles, display_name, employee_id, division_id, is_active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, user: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update user failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
