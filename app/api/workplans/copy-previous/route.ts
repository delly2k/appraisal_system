import { NextRequest, NextResponse } from "next/server";
import { copyPreviousWorkplan } from "@/lib/workplan-copy";

/**
 * POST /api/workplans/copy-previous
 * Body: { "appraisalId": "uuid" }
 * Copies the employee's previous cycle workplan into the current appraisal (items with actual_result and points reset).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const appraisalId =
      typeof body?.appraisalId === "string" ? body.appraisalId.trim() : null;

    if (!appraisalId) {
      return NextResponse.json(
        { error: "appraisalId is required" },
        { status: 400 }
      );
    }

    const result = await copyPreviousWorkplan(appraisalId);

    return NextResponse.json({
      copied_items: result.copiedItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Copy failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
