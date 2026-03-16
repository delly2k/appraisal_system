import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardDataForEmployee } from "@/lib/appraisal-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.roles?.length) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const isOwn = user.employee_id === employeeId;
    const isHrAdmin = user.roles.some((r) => r === "hr" || r === "admin");
    const isManager = user.roles.includes("manager");
    const isGm = user.roles.includes("gm");
    if (!isOwn && !isHrAdmin && !isManager && !isGm) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const data = await getDashboardDataForEmployee(employeeId);
    if (!data) {
      return NextResponse.json({
        data: null,
        meta: { message: "No open cycle or no data" },
      });
    }

    return NextResponse.json({ data, meta: {} });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Dashboard data failed";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
