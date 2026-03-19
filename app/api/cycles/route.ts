import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createCycle } from "@/lib/appraisal-service";

const CreateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  cycle_type: z.enum(["annual"]).default("annual"),
  fiscal_year: z.string().min(1),
  quarter: z.string().nullable().optional(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
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
    const isHrAdmin = user.roles.some((r) => r === "hr" || r === "admin");
    if (!isHrAdmin) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { fiscal_year, start_date, end_date, cycle_type, quarter } =
      parsed.data;
    const name = parsed.data.name ?? `FY ${fiscal_year}`;

    const result = await createCycle({
      name,
      cycle_type,
      fiscal_year,
      quarter: quarter ?? null,
      start_date,
      end_date,
    });

    return NextResponse.json({
      data: result,
      meta: { created: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create cycle failed";
    const code =
      message.includes("already exists") ? "DUPLICATE_FISCAL_YEAR" : "INTERNAL_ERROR";
    const status = message.includes("already exists") ? 400 : 500;
    return NextResponse.json(
      { error: message, code },
      { status }
    );
  }
}
