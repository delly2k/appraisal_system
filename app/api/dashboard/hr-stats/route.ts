import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCurrentUser } from "@/lib/auth";
import { fetchHrDashboardStats } from "@/lib/dashboard-hr-stats";

/**
 * GET /api/dashboard/hr-stats
 * Organisation metrics for HR dashboard. HR and admin only.
 * Session gate + app role from getCurrentUser (roles live in app_users).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    const isHr = user?.roles?.some((r) => r === "hr" || r === "admin") ?? false;
    if (!isHr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stats = await fetchHrDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load HR stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
