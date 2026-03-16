import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { parseAchieveItExcel } from "@/lib/parse-achieveit";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireHrAdmin() {
  const user = await getCurrentUser();
  if (!user?.roles?.length) return null;
  const isHrAdmin = user.roles.some((r) => ["hr", "admin", "super_admin"].includes(r as string));
  return isHrAdmin ? user : null;
}

export async function POST(req: NextRequest) {
  const user = await requireHrAdmin();
  if (!user) {
    return NextResponse.json({ error: "Only HR or Admin can upload operational plans" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const cycleYear = form.get("cycle_year") as string | null;
    const label = form.get("label") as string | null;
    const setActive = form.get("set_active") === "true";

    if (!file || !cycleYear?.trim() || !label?.trim()) {
      return NextResponse.json({ error: "file, cycle_year and label are required" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseAchieveItExcel(buffer);

    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: parsed.errors[0] }, { status: 422 });
    }

    if (setActive) {
      await supabase.from("operational_plan_cycles").update({ is_active: false }).eq("is_active", true);
    }

    const { data: cycle, error: cycleErr } = await supabase
      .from("operational_plan_cycles")
      .insert({
        cycle_year: cycleYear.trim(),
        label: label.trim(),
        is_active: setActive,
        uploaded_by: null,
        total_corp: parsed.corporateObjectives.length,
        total_dept: parsed.departmentObjectives.length,
      })
      .select("id")
      .single();

    if (cycleErr || !cycle) throw cycleErr ?? new Error("Failed to create cycle");

    const cycleId = cycle.id;

    const { data: corpRows, error: corpErr } = await supabase
      .from("corporate_objectives")
      .insert(
        parsed.corporateObjectives.map((c) => ({
          cycle_id: cycleId,
          achieveit_id: c.achieveit_id,
          order_ref: c.order_ref,
          perspective: c.perspective,
          name: c.name,
          description: c.description,
          status: c.status,
        }))
      )
      .select("id, achieveit_id");

    if (corpErr) throw corpErr;

    const orderToAchieveit: Record<string, string> = {};
    parsed.corporateObjectives.forEach((c) => {
      orderToAchieveit[c.order_ref] = c.achieveit_id;
    });
    const corpMapByAchieveitId: Record<string, string> = {};
    corpRows?.forEach((r, i) => {
      const achieveitId = parsed.corporateObjectives[i]?.achieveit_id;
      if (achieveitId != null) corpMapByAchieveitId[achieveitId] = r.id;
    });

    const deptRows = parsed.departmentObjectives.map((d) => {
      const parentAchieveitId = orderToAchieveit[d.corporate_order] ?? null;
      return {
        cycle_id: cycleId,
        corporate_objective_id: parentAchieveitId ? (corpMapByAchieveitId[parentAchieveitId] ?? null) : null,
        achieveit_id: d.achieveit_id,
        order_ref: d.order_ref,
        name: d.name,
        description: d.description,
        status: d.status,
        division: d.division,
        assigned_to: d.assigned_to,
      };
    });

    for (let i = 0; i < deptRows.length; i += 100) {
      const { error: deptErr } = await supabase.from("department_objectives").insert(deptRows.slice(i, i + 100));
      if (deptErr) throw deptErr;
    }

    return NextResponse.json({
      success: true,
      cycle_id: cycleId,
      inserted: {
        corporate_objectives: parsed.corporateObjectives.length,
        department_objectives: parsed.departmentObjectives.length,
      },
    });
  } catch (err: unknown) {
    console.error("[operational-plan/upload]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
