import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * DEPRECATED: Phase progression is now per-appraisal and automatic.
 * When a manager approves a workplan, that appraisal moves to SELF_ASSESSMENT immediately.
 * This bulk "open assessment phase" is no longer the primary mechanism; cycle has OPEN/CLOSED only.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  await getCurrentUser();
  const { cycleId } = await params;
  return NextResponse.json(
    {
      deprecated: true,
      message:
        "Phase progression is per-appraisal; no bulk open-assessment. Each appraisal moves to self-assessment when its manager approves the workplan.",
      cycleId,
    },
    { status: 410 }
  );
}
