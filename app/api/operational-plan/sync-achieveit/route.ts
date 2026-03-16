import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

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

interface AchieveItItem {
  id?: string;
  sequenceId?: string;
  level?: string;
  name?: string;
  description?: string | null;
  statusName?: string | null;
  assignedToFullName?: string | null;
  members?: { id?: string; name?: string; type?: string }[];
}

function decodeHtml(s: string | null | undefined): string {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parentOrder(order: string): string {
  return order.split(".").slice(0, -1).join(".");
}

export async function POST(req: NextRequest) {
  const user = await requireHrAdmin();
  if (!user) {
    return NextResponse.json({ error: "Only HR or Admin can sync operational plans" }, { status: 403 });
  }

  const apiKey = process.env.ACHIEVEIT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ACHIEVEIT_API_KEY not configured" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const cycleYear = typeof body.cycleYear === "string" ? body.cycleYear.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const setAsActive = body.setAsActive === true;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }
    if (!cycleYear || !label) {
      return NextResponse.json({ error: "cycleYear and label are required" }, { status: 400 });
    }

    const allItems: AchieveItItem[] = [];
    let skip = 0;
    const take = 100;
    let totalCount = 0;

    do {
      const url = `https://api.achieveit.com/exports/plans/${encodeURIComponent(planId)}?skip=${skip}&take=${take}&sortKey=sequenceId&sortDirection=asc`;
      const res = await fetch(url, {
        headers: {
          Authorization: `API-KEY ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        const errMsg = res.status === 403 ? "Access denied to plan" : text || res.statusText;
        return NextResponse.json({ error: errMsg }, { status: res.status });
      }

      const data = (await res.json()) as { items?: AchieveItItem[]; totalCount?: number };
      const items = Array.isArray(data.items) ? data.items : [];
      if (typeof data.totalCount === "number") totalCount = data.totalCount;

      allItems.push(...items);
      skip += take;

      if (items.length < take) break;
    } while (skip < totalCount || allItems.length === totalCount);

    const corporate: { achieveit_id: string; order_ref: string; name: string; description: string | null; status: string | null; perspective: string | null }[] = [];
    const divisional: { achieveit_id: string; order_ref: string; name: string; description: string | null; status: string | null; division: string | null; assigned_to: string | null; corporate_order: string }[] = [];
    const perspectiveMap: Record<string, string> = {};

    for (const item of allItems) {
      const level = item.level ?? "";
      const order = String(item.sequenceId ?? "").trim();
      const name = decodeHtml(item.name);
      if (!order || !name) continue;

      if (level === "Balanced Scorecard Perspective") {
        perspectiveMap[order] = name;
      } else if (level === "Corporate Objective") {
        corporate.push({
          achieveit_id: String(item.id ?? ""),
          order_ref: order,
          name,
          description: item.description ? String(item.description) : null,
          status: item.statusName ? String(item.statusName) : null,
          perspective: perspectiveMap[order.split(".")[0] ?? ""] ?? null,
        });
      } else if (level === "Department Objective") {
        const div = item.members?.[0]?.name ?? null;
        divisional.push({
          achieveit_id: String(item.id ?? ""),
          order_ref: order,
          name,
          description: item.description ? String(item.description) : null,
          status: item.statusName ? String(item.statusName) : null,
          division: div ? String(div) : null,
          assigned_to: item.assignedToFullName ? String(item.assignedToFullName) : null,
          corporate_order: parentOrder(order),
        });
      }
    }

    if (corporate.length === 0) {
      return NextResponse.json(
        { error: "No Corporate Objectives found. Ensure the plan has items with level 'Corporate Objective'." },
        { status: 422 }
      );
    }

    if (setAsActive) {
      await supabase.from("operational_plan_cycles").update({ is_active: false }).eq("is_active", true);
    }

    const { data: cycle, error: cycleErr } = await supabase
      .from("operational_plan_cycles")
      .insert({
        cycle_year: cycleYear,
        label: label,
        is_active: setAsActive,
        uploaded_by: null,
        total_corp: corporate.length,
        total_dept: divisional.length,
        achieveit_plan_id: planId,
      })
      .select("id")
      .single();

    if (cycleErr || !cycle) throw cycleErr ?? new Error("Failed to create cycle");

    const cycleId = cycle.id;

    const { data: corpRows, error: corpErr } = await supabase
      .from("corporate_objectives")
      .insert(
        corporate.map((c) => ({
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
    corporate.forEach((c) => {
      orderToAchieveit[c.order_ref] = c.achieveit_id;
    });
    const corpMapByAchieveitId: Record<string, string> = {};
    corpRows?.forEach((r, i) => {
      const achieveitId = corporate[i]?.achieveit_id;
      if (achieveitId != null) corpMapByAchieveitId[achieveitId] = r.id;
    });

    const deptRows = divisional.map((d) => {
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
      const { error: deptErr } = await supabase
        .from("department_objectives")
        .insert(deptRows.slice(i, i + 100));
      if (deptErr) throw deptErr;
    }

    return NextResponse.json({
      corporate_count: corporate.length,
      divisional_count: divisional.length,
      total_fetched: allItems.length,
      planId,
    });
  } catch (err: unknown) {
    console.error("[operational-plan/sync-achieveit]", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
