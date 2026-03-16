import { NextRequest, NextResponse } from "next/server";
import { calculateAppraisalScore } from "@/lib/score-engine";

/**
 * POST /api/appraisals/[id]/calculate-score
 * Runs the scoring engine for the appraisal and stores results in appraisal_section_scores.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appraisalId } = await params;
    if (!appraisalId) {
      return NextResponse.json(
        { error: "Appraisal id is required" },
        { status: 400 }
      );
    }

    const scores = await calculateAppraisalScore(appraisalId);

    return NextResponse.json(scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calculate score failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
