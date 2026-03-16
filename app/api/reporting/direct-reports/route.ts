import { NextRequest } from "next/server";
import { getDirectReportsForEmployee } from "@/lib/reporting-structure";

/**
 * GET /api/reporting/direct-reports?employeeId=xxx
 * Returns direct reports for the given xrm1_employeeid (for expandable "People reporting to you").
 */
export async function GET(request: NextRequest) {
  const employeeId = request.nextUrl.searchParams.get("employeeId");
  if (!employeeId?.trim()) {
    return Response.json({ error: "employeeId required" }, { status: 400 });
  }
  try {
    const reports = await getDirectReportsForEmployee(employeeId.trim());
    return Response.json(reports);
  } catch (err) {
    console.error("[api/reporting/direct-reports]", err);
    return Response.json({ error: "Failed to load direct reports" }, { status: 500 });
  }
}
