import { NextResponse } from "next/server";
import { syncEmployees, syncReportingLines } from "@/lib/dynamics-sync";

/**
 * POST /api/sync/employees
 * Runs full sync: employees and reporting lines from Dynamics 365 Dataverse into Supabase.
 * Requires Dynamics and Supabase env vars; use with auth in production.
 */
export async function POST() {
  try {
    const employees_synced = await syncEmployees();
    const reporting_lines_synced = await syncReportingLines();

    return NextResponse.json({
      employees_synced,
      reporting_lines_synced,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
