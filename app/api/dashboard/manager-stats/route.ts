import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCurrentUser } from "@/lib/auth";
import { fetchManagerDashboardStats } from "@/lib/dashboard-manager-stats";
import { getReportingStructureFromDynamics } from "@/lib/reporting-structure";

/**
 * GET /api/dashboard/manager-stats
 * Direct reports + appraisal snapshot for manager dashboard (HRMIS / Dynamics, not reporting_lines).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const structure = await getReportingStructureFromDynamics(
      user.employee_id ?? null,
      user.email ?? null
    );
    if ((structure.directReports?.length ?? 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await fetchManagerDashboardStats(user, structure);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load manager stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
