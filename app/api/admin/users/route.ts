import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
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
 * List app users for HR/admin. Returns id, email, display_name, role, employee_id, division_id, is_active, created_at.
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
      .select("id, email, display_name, role, employee_id, division_id, is_active, created_at")
      .order("email", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "List users failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const ALLOWED_ROLES = ["admin", "hr", "gm", "manager", "individual"] as const;

/**
 * POST /api/admin/users
 * Create a new app user. HR/admin only. Body: email (required), display_name?, role (required), employee_id?, division_id?, is_active?.
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
    const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    const employee_id = body.employee_id !== undefined ? (body.employee_id === null || body.employee_id === "" ? null : String(body.employee_id).trim()) : null;
    const division_id = body.division_id !== undefined ? (body.division_id === null || body.division_id === "" ? null : String(body.division_id).trim()) : null;
    const is_active = typeof body.is_active === "boolean" ? body.is_active : true;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "role is required and must be one of: admin, hr, gm, manager, individual" }, { status: 400 });
    }

    const aad_object_id = randomUUID();
    const { data: created, error } = await supabase
      .from("app_users")
      .insert({
        aad_object_id,
        email,
        display_name,
        role,
        employee_id,
        division_id,
        is_active,
      })
      .select("id, email, display_name, role, employee_id, division_id, is_active, created_at")
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
