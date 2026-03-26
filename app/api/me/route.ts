import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/me
 * Returns the current app user (from NextAuth session + app_users).
 * Returns 401 if not signed in.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = createClient();
  const email = session.user.email;
  const employeeId = (session.user.employee_id as string | null | undefined) ?? null;
  const divisionId = (session.user.division_id as string | null | undefined) ?? null;

  // Roles/elevation from app_users only.
  const { data: appUser } = await supabase
    .from("app_users")
    .select("roles")
    .ilike("email", email)
    .maybeSingle();

  return NextResponse.json({
    email,
    name: session.user.name ?? null,
    employee_id: employeeId,
    division_id: divisionId,
    roles: Array.isArray(appUser?.roles) ? appUser.roles : [],
  });
}
