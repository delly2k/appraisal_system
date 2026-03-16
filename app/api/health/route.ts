import { NextResponse } from "next/server";

/**
 * Health check endpoint for load balancers and monitoring.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "appraisal-management-system",
    timestamp: new Date().toISOString(),
  });
}
