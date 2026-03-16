import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveUserFromDynamics } from "@/lib/dynamics-user-resolver";

/**
 * GET /api/auth/resolve-user
 * Resolves the authenticated user to an HR employee from Dynamics 365.
 * Only authenticated users; no second login. Returns employee profile or 404.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; name?: string | null; image?: string | null; id?: string } | null;
  if (!user?.email && !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await resolveUserFromDynamics({
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      id: user?.id ?? undefined,
    });
    if (!profile) {
      return NextResponse.json(
        { resolved: false, message: "No matching employee in HR" },
        { status: 200 }
      );
    }
    return NextResponse.json({
      employeeId: profile.employeeId,
      fullName: profile.fullName,
      email: profile.email,
      jobTitle: profile.jobTitle,
      division: profile.divisionName ?? profile.divisionId ?? null,
      divisionId: profile.divisionId,
      departmentId: profile.departmentId,
      departmentName: profile.departmentName,
      managerId: profile.managerId,
    });
  } catch (err) {
    console.error("resolve-user error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve user" },
      { status: 500 }
    );
  }
}
