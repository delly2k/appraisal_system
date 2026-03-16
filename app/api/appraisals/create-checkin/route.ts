import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createCheckin } from "@/lib/appraisal-service";

const CreateCheckinSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().min(1),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.roles?.length) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateCheckinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await createCheckin(parsed.data);

    return NextResponse.json({
      data: result,
      meta: { cycleId: parsed.data.cycleId, quarter: parsed.data.quarter },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Create check-in failed";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
