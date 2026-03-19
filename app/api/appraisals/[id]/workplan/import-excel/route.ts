import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import * as XLSX from "xlsx";
import type { ColumnMapping } from "../analyse-columns/route";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

type WorkplanItemInsert = {
  workplan_id: string;
  corporate_objective: string;
  division_objective: string;
  individual_objective: string;
  major_task: string;
  key_output: string;
  performance_standard: string;
  weight: number;
  status: string;
  version: number;
  metric_type?: string | null;
  metric_target?: number | null;
  metric_deadline?: string | null;
};

function applyMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping[]
): WorkplanItemInsert[] {
  const nonEmpty = rows.filter((row) =>
    Object.values(row).some((v) => v !== null && v !== "" && v !== undefined)
  );

  const typeMap: Record<string, string> = {
    NUMBER: "NUMBER",
    NUM: "NUMBER",
    "#": "NUMBER",
    PERCENTAGE: "PERCENT",
    PERCENT: "PERCENT",
    "%": "PERCENT",
    DATE: "DATE",
    DEADLINE: "DATE",
    BOOLEAN: "PERCENT",
    "YES/NO": "PERCENT",
    BOOL: "PERCENT",
    TEXT: "PERCENT",
    NARRATIVE: "PERCENT",
  };

  const out: WorkplanItemInsert[] = [];
  for (const row of nonEmpty) {
    const item: Partial<WorkplanItemInsert> = {
      corporate_objective: "",
      division_objective: "",
      individual_objective: "",
      major_task: "",
      key_output: "",
      performance_standard: "",
      weight: 0,
      status: "active",
      version: 1,
    };

    for (const m of mapping) {
      if (!m.targetField || m.targetField === "SKIP") continue;
      const rawValue = (row as Record<string, unknown>)[m.excelColumn];
      if (rawValue === undefined || rawValue === null || rawValue === "") continue;

      if (m.targetField === "weight") {
        const parsed = parseFloat(String(rawValue).replace(/%/g, "").trim());
        item.weight = Number.isNaN(parsed) ? 0 : parsed;
      } else if (m.targetField === "metric_target") {
        const parsed = parseFloat(String(rawValue));
        item.metric_target = Number.isNaN(parsed) ? null : parsed;
      } else if (m.targetField === "metric_type") {
        const v = String(rawValue).toUpperCase().trim();
        item.metric_type = typeMap[v] ?? "PERCENT";
      } else if (m.targetField === "metric_deadline") {
        if (typeof rawValue === "number") {
          const date = XLSX.SSF.parse_date_code(rawValue);
          if (date && date.y && date.m && date.d) {
            item.metric_deadline = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
          } else {
            item.metric_deadline = String(rawValue).trim();
          }
        } else {
          item.metric_deadline = String(rawValue).trim();
        }
      } else {
        (item as Record<string, unknown>)[m.targetField] = String(rawValue).trim();
      }
    }

    if (item.major_task && (item.weight ?? 0) > 0) {
      out.push({
        workplan_id: "",
        corporate_objective: item.corporate_objective ?? "",
        division_objective: item.division_objective ?? "",
        individual_objective: item.individual_objective ?? "",
        major_task: item.major_task,
        key_output: item.key_output ?? "",
        performance_standard: item.performance_standard ?? "",
        weight: item.weight ?? 0,
        status: "active",
        version: 1,
        metric_type: item.metric_type ?? "PERCENT",
        metric_target: item.metric_target ?? null,
        metric_deadline: item.metric_deadline ?? null,
      });
    }
  }
  return out;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await context.params;
    const body = await req.json();
    const {
      workplanId,
      rows = [],
      mapping = [],
      filename = "",
      sheetName = "",
    } = body as {
      workplanId: string;
      rows: Record<string, unknown>[];
      mapping: ColumnMapping[];
      filename: string;
      sheetName: string;
    };

    if (!workplanId || !appraisalId) {
      return NextResponse.json({ error: "workplanId and appraisalId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, status")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal)
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const canEdit =
      user.roles?.some((r) => r === "hr" || r === "admin") ||
      appraisal.employee_id === user.employee_id ||
      appraisal.manager_employee_id === user.employee_id;
    if (!canEdit)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appStatus = (appraisal.status ?? "").toUpperCase();
    if (appStatus !== "DRAFT") {
      return NextResponse.json({ error: "Appraisal must be in DRAFT to import workplan" }, { status: 422 });
    }

    const { data: workplan, error: wpErr } = await supabase
      .from("workplans")
      .select("id, status")
      .eq("id", workplanId)
      .eq("appraisal_id", appraisalId)
      .single();

    if (wpErr || !workplan)
      return NextResponse.json({ error: "Workplan not found" }, { status: 404 });

    const wpStatus = (workplan.status ?? "draft").toLowerCase();
    if (wpStatus !== "draft") {
      return NextResponse.json({ error: "Workplan is locked; cannot import" }, { status: 422 });
    }

    const itemsToInsert = applyMapping(rows, mapping);
    const errors: string[] = [];

    for (const it of itemsToInsert) {
      if (!it.major_task || !it.major_task.trim()) errors.push("Every row must have a Major task.");
      if (it.weight == null || Number.isNaN(it.weight)) errors.push("Every row must have a Weight.");
    }
    const totalWeight = itemsToInsert.reduce((s, i) => s + i.weight, 0);
    if (Math.abs(totalWeight - 100) > 2) {
      errors.push(`Weights sum to ${totalWeight.toFixed(1)}%; they must sum to 100% (±2).`);
    }
    const majorTasks = itemsToInsert.map((i) => i.major_task.trim().toLowerCase());
    const dupes = majorTasks.filter((t, i) => majorTasks.indexOf(t) !== i);
    if (dupes.length > 0) {
      errors.push("Duplicate major task detected — consider adjusting before importing.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    const { error: delErr } = await supabase
      .from("workplan_items")
      .delete()
      .eq("workplan_id", workplanId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    const insertPayload = itemsToInsert.map((item) => ({
      ...item,
      workplan_id: workplanId,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("workplan_items")
      .insert(insertPayload)
      .select();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    await supabase
      .from("workplans")
      .update({
        imported_from_file: filename || null,
        imported_sheet: sheetName || null,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", workplanId);

    return NextResponse.json({
      imported: (inserted ?? []).length,
      items: inserted ?? [],
    });
  } catch (err) {
    console.error("[workplan/import-excel]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
