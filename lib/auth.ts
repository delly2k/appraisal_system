import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import type { UserRole } from "@/types";
import { authOptions } from "@/lib/auth-options";

/**
 * Authentication layer.
 * Uses NextAuth session (Azure AD) when signed in; falls back to SEED_USER_EMAIL then placeholder.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  roles: UserRole[];
  jobTitle?: string;
  department?: string;
  managerId?: string;
  /** Linked employee_id from app_users / Dynamics; used for dashboard and appraisals. */
  employee_id?: string | null;
  /** Division for GM role; used by RLS and division-scoped views. */
  division_id?: string | null;
  /** Temporary fallback while app_users.role exists during migration window. */
  role?: string | null;
  /** Where `id` comes from: app portal account vs HR employee record only. */
  source?: "app_users" | "employees";
}

/** Default placeholder user when no seed user is configured. */
const PLACEHOLDER_USER: AuthUser = {
  id: "placeholder-user-id",
  email: "user@company.com",
  name: "Placeholder User",
  roles: ["employee"],
  jobTitle: "Software Engineer",
  department: "Technology",
  managerId: "placeholder-manager-id",
  employee_id: null,
};

function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function toUserRole(role: string): UserRole {
  if (role === "individual") return "employee";
  if (role === "gm" || role === "manager" || role === "hr" || role === "admin") return role as UserRole;
  return "employee";
}

/** True if the given user is the placeholder (no real session). */
export function isPlaceholderUser(user: AuthUser | null): boolean {
  return user?.id === PLACEHOLDER_USER.id || user?.email === PLACEHOLDER_USER.email;
}

/**
 * Get the current user.
 * HR/admin: row in app_users → `id` is app_users UUID.
 * Regular employees: no app_users row → `id` is employees.employee_id (Dynamics id), never the email string.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim();
  const seedEmail = process.env.SEED_USER_EMAIL?.trim();
  const email = sessionEmail ?? seedEmail;
  if (!email) return PLACEHOLDER_USER;

  const supabase = getSupabaseService();
  if (!supabase) {
    return session?.user ? null : PLACEHOLDER_USER;
  }

  const { data: row, error } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, roles, employee_id, division_id")
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && row) {
    let employee_id = row.employee_id ?? null;
    let division_id = row.division_id ?? null;
    if (!employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("employee_id, division_id")
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      if (emp) {
        employee_id = emp.employee_id ?? null;
        division_id = emp.division_id ?? null;
      }
    }
    const dbRoles = Array.isArray((row as { roles?: unknown }).roles)
      ? ((row as { roles?: unknown[] }).roles ?? []).map((r) => String(r))
      : [];
    const fallbackRole = typeof row.role === "string" ? row.role : null;
    const resolvedRoles =
      dbRoles.length > 0
        ? dbRoles
        : fallbackRole && fallbackRole !== "individual"
          ? [fallbackRole]
          : [];
    return {
      id: row.id,
      email: row.email ?? null,
      name: row.display_name ?? row.email ?? null,
      roles: resolvedRoles.map((r) => toUserRole(r)),
      employee_id,
      division_id,
      role: fallbackRole,
      source: "app_users",
    };
  }

  if (session?.user) {
    let { data: emp } = await supabase
      .from("employees")
      .select("employee_id, full_name, email, division_id")
      .ilike("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (!emp) {
      const { resolveUserFromDynamics } = await import("@/lib/dynamics-user-resolver");
      try {
        await resolveUserFromDynamics({
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
          id: (session.user as { id?: string })?.id ?? undefined,
        });
      } catch {
        // Dynamics unavailable or user not in HR; continue with null employee_id
      }
      const retry = await supabase
        .from("employees")
        .select("employee_id, full_name, email, division_id")
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      emp = retry.data;
    }

    if (!emp?.employee_id) {
      console.warn(`[auth] No app_users or employees record for: ${email}`);
      return null;
    }

    return {
      id: emp.employee_id,
      email: emp.email ?? session.user.email ?? null,
      name: (emp.full_name ?? session.user.name ?? session.user.email) ?? null,
      roles: ["employee"],
      employee_id: emp.employee_id,
      division_id: emp.division_id ?? null,
      source: "employees",
    };
  }

  // SEED_USER_EMAIL (no session): resolve from DB so `id` is never a bare email string
  const { data: seedEmp } = await supabase
    .from("employees")
    .select("employee_id, full_name, email, division_id")
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (seedEmp?.employee_id) {
    return {
      id: seedEmp.employee_id,
      email: seedEmp.email ?? email,
      name: seedEmp.full_name ?? email.split("@")[0] ?? email,
      roles: ["employee"],
      employee_id: seedEmp.employee_id,
      division_id: seedEmp.division_id ?? null,
      source: "employees",
    };
  }

  const { data: seedApp } = await supabase
    .from("app_users")
    .select("id, email, display_name, role, roles, employee_id, division_id")
    .ilike("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (seedApp) {
    let employee_id = seedApp.employee_id ?? null;
    let division_id = seedApp.division_id ?? null;
    if (!employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("employee_id, division_id")
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      if (emp) {
        employee_id = emp.employee_id ?? null;
        division_id = emp.division_id ?? null;
      }
    }
    const dbRoles = Array.isArray((seedApp as { roles?: unknown }).roles)
      ? ((seedApp as { roles?: unknown[] }).roles ?? []).map((r) => String(r))
      : [];
    const fallbackRole = typeof seedApp.role === "string" ? seedApp.role : null;
    const resolvedRoles =
      dbRoles.length > 0
        ? dbRoles
        : fallbackRole && fallbackRole !== "individual"
          ? [fallbackRole]
          : [];
    return {
      id: seedApp.id,
      email: seedApp.email ?? null,
      name: seedApp.display_name ?? seedApp.email ?? null,
      roles: resolvedRoles.map((r) => toUserRole(r)),
      employee_id,
      division_id,
      role: fallbackRole,
      source: "app_users",
    };
  }

  return PLACEHOLDER_USER;
}

/**
 * Sign in. Placeholder — no-op until Entra ID is configured.
 */
export async function signIn(): Promise<{ success: boolean; error?: string }> {
  // TODO: Redirect to Entra ID login or handle OAuth flow
  return { success: true };
}

/**
 * Sign out. Placeholder — clear local state; will clear Entra ID session when integrated.
 */
export async function signOut(): Promise<void> {
  // TODO: Clear Entra ID session and redirect to logout endpoint
}

/**
 * Check if the current session is authenticated (placeholder).
 */
export function isAuthenticated(): boolean {
  // TODO: Validate real session (e.g. JWT from Entra ID)
  return true;
}
