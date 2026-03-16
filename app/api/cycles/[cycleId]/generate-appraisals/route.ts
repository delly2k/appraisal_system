import { NextRequest, NextResponse } from "next/server";
import { generateAppraisalsForCycle } from "@/lib/appraisal-generator";

/**
 * POST /api/cycles/[cycleId]/generate-appraisals
 * Creates draft appraisal records for all active employees in the cycle.
 * Protect this route in production (e.g. admin or HR only).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { cycleId } = await params;
    if (!cycleId) {
      return NextResponse.json(
        { error: "cycleId is required" },
        { status: 400 }
      );
    }

    const result = await generateAppraisalsForCycle(cycleId);

    return NextResponse.json({
      cycle: result.cycleName,
      appraisals_created: result.appraisalsCreated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
