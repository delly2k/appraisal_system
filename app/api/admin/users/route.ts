import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { legacyRoleForRoles } from "@/lib/app-user-legacy-role";
import { randomUUID } from "crypto";

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

/**
 * GET /api/admin/users
 * List app users for HR/admin. Returns id, email, display_name, roles, employee_id, division_id, is_active, created_at.
 */
export async function GET() {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, display_name, role, roles, employee_id, division_id, is_active, created_at")
      .order("email", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []).map((u) => {
      const dbRoles = Array.isArray((u as { roles?: unknown }).roles)
        ? ((u as { roles?: unknown[] }).roles ?? []).map((r) => String(r))
        : [];
      const fallbackRole = typeof (u as { role?: unknown }).role === "string" ? String((u as { role?: unknown }).role) : null;
      const roles =
        dbRoles.length > 0
          ? dbRoles
          : fallbackRole && fallbackRole !== "individual"
            ? [fallbackRole]
            : [];
      return { ...u, roles };
    });

    const empIds = [...new Set(rows.map((r) => r.employee_id).filter((id): id is string => !!id && String(id).length > 0))];
    const empById = new Map<string, { division_id: string | null; division_name: string | null }>();
    if (empIds.length > 0) {
      const { data: emps } = await supabase
        .from("employees")
        .select("employee_id, division_id, division_name")
        .in("employee_id", empIds);
      for (const e of emps ?? []) {
        if (e.employee_id) {
          empById.set(String(e.employee_id), {
            division_id: e.division_id ? String(e.division_id) : null,
            division_name: e.division_name ? String(e.division_name) : null,
          });
        }
      }
    }

    const divIdsNeedingName = new Set<string>();
    for (const u of rows) {
      const fromEmp = u.employee_id ? empById.get(String(u.employee_id)) : undefined;
      const hasName = !!(fromEmp?.division_name && String(fromEmp.division_name).trim());
      if (!hasName && u.division_id) divIdsNeedingName.add(String(u.division_id));
    }
    const divIdToName = new Map<string, string>();
    if (divIdsNeedingName.size > 0) {
      const { data: divRows } = await supabase
        .from("employees")
        .select("division_id, division_name")
        .in("division_id", [...divIdsNeedingName]);
      for (const d of divRows ?? []) {
        const did = d.division_id ? String(d.division_id) : "";
        const nm = d.division_name ? String(d.division_name).trim() : "";
        if (did && nm && !divIdToName.has(did)) divIdToName.set(did, nm);
      }
    }

    const enriched = rows.map((u) => {
      const fromEmp = u.employee_id ? empById.get(String(u.employee_id)) : undefined;
      let division_name: string | null =
        fromEmp?.division_name && String(fromEmp.division_name).trim() ? String(fromEmp.division_name) : null;
      if (!division_name && u.division_id) {
        const n = divIdToName.get(String(u.division_id));
        division_name = n ?? null;
      }
      return { ...u, division_name };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : "List users failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const ALLOWED_ROLES = ["admin", "hr"] as const;

/**
 * POST /api/admin/users
 * Create a new app user. HR/admin only. Body: email (required), display_name?, roles?, employee_id?, division_id?, is_active?.
 * aad_object_id is set to a placeholder UUID until the user signs in (can be updated later).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireHrAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() || null : null;
    const legacyRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : null;
    const rolesRaw = Array.isArray(body.roles) ? body.roles : legacyRole ? [legacyRole] : [];
    const roles = rolesRaw
      .map((r: unknown) => String(r).trim().toLowerCase())
      .filter((r: string): r is (typeof ALLOWED_ROLES)[number] =>
        ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number])
      );
    const employee_id = body.employee_id !== undefined ? (body.employee_id === null || body.employee_id === "" ? null : String(body.employee_id).trim()) : null;
    const division_id = body.division_id !== undefined ? (body.division_id === null || body.division_id === "" ? null : String(body.division_id).trim()) : null;
    const is_active = typeof body.is_active === "boolean" ? body.is_active : true;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (rolesRaw.length > 0 && roles.length !== rolesRaw.length) {
      return NextResponse.json({ error: "roles can only include hr and admin" }, { status: 400 });
    }

    const aad_object_id = randomUUID();
    const role = legacyRoleForRoles(roles);
    const { data: created, error } = await supabase
      .from("app_users")
      .insert({
        aad_object_id,
        email,
        display_name,
        role,
        roles,
        employee_id,
        division_id,
        is_active,
      })
      .select("id, email, display_name, role, roles, employee_id, division_id, is_active, created_at")
      .single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create user failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
