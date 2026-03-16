import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and service role key required");
  return createClient(url, key);
}

/**
 * GET /api/appraisals/[id]/objectives
 * Returns objectives from the active operational plan (for workplan picker).
 * Same access as workplan: user must be able to access this appraisal.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appraisalId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, division_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const canAccess =
      user.roles?.some((r) => r === "hr" || r === "admin") ||
      appraisal.employee_id === user.employee_id ||
      appraisal.manager_employee_id === user.employee_id ||
      (user.roles?.includes("gm") && appraisal.division_id === user.division_id);

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: activeCycle, error: cycleErr } = await supabase
      .from("operational_plan_cycles")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();

    if (cycleErr || !activeCycle) {
      return NextResponse.json([]);
    }

    const [corpRes, deptRes] = await Promise.all([
      supabase
        .from("corporate_objectives")
        .select("id, name, achieveit_id")
        .eq("cycle_id", activeCycle.id)
        .order("name", { ascending: true }),
      supabase
        .from("department_objectives")
        .select("id, name, division, achieveit_id, corporate_objective_id, corporate_objectives(achieveit_id)")
        .eq("cycle_id", activeCycle.id)
        .order("name", { ascending: true }),
    ]);

    const corporate = (corpRes.data ?? []).map((r) => ({
      id: r.id,
      type: "CORPORATE" as const,
      title: r.name,
      division: undefined as string | undefined,
      external_id: r.achieveit_id ?? "",
    }));

    type DeptData = NonNullable<typeof deptRes.data>;
    type DeptRow = DeptData extends (infer R)[] ? R : never;
    type DeptRowWithCo = DeptRow & {
      corporate_objectives?: { achieveit_id: string | null } | { achieveit_id: string | null }[] | null;
    };
    const divisional = (deptRes.data ?? []).map((r: DeptRowWithCo) => {
      const co = r.corporate_objectives;
      const parentId = Array.isArray(co) ? co[0]?.achieveit_id : (co as { achieveit_id?: string | null } | null)?.achieveit_id;
      return {
        id: r.id,
        type: "DIVISIONAL" as const,
        title: r.name,
        division: r.division ?? undefined,
        external_id: r.achieveit_id ?? "",
        corporate_objective_id: r.corporate_objective_id ?? undefined,
        parent_external_id: parentId ?? undefined,
      };
    });

    return NextResponse.json([...corporate, ...divisional]);
  } catch (err) {
    console.error("GET appraisal objectives error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
