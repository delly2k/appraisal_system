import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { openCycle } from "@/lib/appraisal-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.roles?.length) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    const isHrAdmin = user.roles.some((r) => r === "hr" || r === "admin");
    if (!isHrAdmin) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { cycleId } = await params;
    if (!cycleId) {
      return NextResponse.json(
        { error: "cycleId is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await openCycle(cycleId);

    return NextResponse.json({
      data: result,
      meta: { cycleId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Open cycle failed";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
