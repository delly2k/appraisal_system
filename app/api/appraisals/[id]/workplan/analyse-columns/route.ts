import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { resolveManagerAccessForAppraisal } from "@/lib/appraisal-manager-access";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

const TARGET_FIELDS = [
  { key: "corporate_objective", label: "Corporate objective", description: "Top-level strategic or corporate objective (e.g. BP2: Improve governance)" },
  { key: "division_objective", label: "Division objective", description: "Divisional or departmental objective linked to corporate objective" },
  { key: "individual_objective", label: "Individual objective", description: "Employee personal objective statement" },
  { key: "major_task", label: "Major task", description: "The main task or deliverable the employee will complete (DBJ: 'Major Tasks' column)" },
  { key: "activities", label: "Activities", description: "Sub-activities under a major task; stored combined with key output text on import" },
  { key: "key_output", label: "Key output", description: "The measurable output or deliverable (DBJ: 'Key Outputs')" },
  { key: "performance_standard", label: "Performance standard", description: "Standard or criteria for success (DBJ: 'Performance Standard / Metric')" },
  { key: "weight", label: "Weight (%)", description: "Percentage weighting; DBJ 'Weighting' uses plain numbers like 5, 10, 20 summing to 100" },
  { key: "metric_type", label: "Metric type", description: "How progress is measured: NUMBER, PERCENTAGE, DATE, BOOLEAN, or TEXT" },
  { key: "metric_target", label: "Target", description: "The numeric or quantitative target value" },
  { key: "metric_deadline", label: "Deadline / due date", description: "Target completion date for this objective" },
] as const;

export type ColumnMapping = {
  excelColumn: string;
  targetField: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "SKIP";
  reasoning: string;
};

function fallbackMatch(headers: string[]): ColumnMapping[] {
  const lower = (s: string) => (s ?? "").toLowerCase().trim();
  const used = new Set<string>();

  return headers.map((excelCol) => {
    const raw = String(excelCol ?? "");
    const e = lower(raw);

    if (e === "#" || e === "no." || e === "no") {
      return { excelColumn: raw, targetField: null, confidence: "SKIP", reasoning: "Row number column — ignore" };
    }

    let targetField: string | null = null;
    let confidence: ColumnMapping["confidence"] = "SKIP";
    let reasoning = "No match";

    const tryAssign = (key: string, conf: ColumnMapping["confidence"], reason: string) => {
      if (used.has(key)) return false;
      targetField = key;
      confidence = conf;
      reasoning = reason;
      used.add(key);
      return true;
    };

    if (e.includes("performance standard") && e.includes("metric")) {
      if (tryAssign("performance_standard", "HIGH", "DBJ: Performance Standard / Metric")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e === "performance standard" || (e.includes("performance") && e.includes("standard") && !e.includes("metric"))) {
      if (tryAssign("performance_standard", "HIGH", "Performance standard")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e === "key outputs" || e === "key output" || (e.includes("key") && e.includes("output"))) {
      if (tryAssign("key_output", "HIGH", "Key output(s)")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e === "activities" || (e.includes("activit") && !e.includes("objective"))) {
      if (tryAssign("activities", "HIGH", "DBJ Activities column")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e === "weighting" || e === "weight %" || e === "weight%" || (e.includes("weight") && e.includes("%"))) {
      if (tryAssign("weight", "HIGH", "Weight / Weighting")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e === "weight") {
      if (tryAssign("weight", "HIGH", "Weight")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e.includes("mis-") && e.includes("ker")) {
      if (tryAssign("division_objective", "HIGH", "DBJ MIS-KER division objective column")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e.includes("corporate") && e.includes("objective")) {
      if (tryAssign("corporate_objective", "HIGH", "Corporate objective")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (e.includes("division") && e.includes("objective")) {
      if (tryAssign("division_objective", "HIGH", "Division objective")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if ((e.includes("major") && e.includes("task")) || e === "major tasks" || e === "major task") {
      if (tryAssign("major_task", "HIGH", "Major task(s)")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }
    if (
      (e.includes("target") && (e.includes("date") || e.includes("due"))) ||
      e === "target date" ||
      e === "due date"
    ) {
      if (tryAssign("metric_deadline", "MEDIUM", "Target / due date column")) {
        return { excelColumn: raw, targetField, confidence, reasoning };
      }
    }

    for (const f of TARGET_FIELDS) {
      if (used.has(f.key)) continue;
      const label = lower(f.label);
      const key = lower(f.key);
      if (e === key || e === label || e.replace(/\s+/g, "_") === key) {
        targetField = f.key;
        confidence = "HIGH";
        reasoning = "Exact or close match to target field";
        used.add(f.key);
        break;
      }
      if (e.includes("corporate") && f.key === "corporate_objective") {
        if (tryAssign(f.key, "MEDIUM", "Contains 'corporate'")) break;
      }
      if (e.includes("division") && f.key === "division_objective") {
        if (tryAssign(f.key, "MEDIUM", "Contains 'division'")) break;
      }
      if (e.includes("major") && e.includes("task") && f.key === "major_task") {
        if (tryAssign(f.key, "HIGH", "Major task")) break;
      }
      if (e.includes("key") && e.includes("output") && f.key === "key_output") {
        if (tryAssign(f.key, "HIGH", "Key output")) break;
      }
      if (e.includes("performance") && e.includes("standard") && f.key === "performance_standard") {
        if (tryAssign(f.key, "HIGH", "Performance standard")) break;
      }
      if ((e.includes("weight") || e === "weight%") && f.key === "weight") {
        if (tryAssign(f.key, "HIGH", "Weight")) break;
      }
      if (e.includes("target") && f.key === "metric_target" && !e.includes("date") && !e.includes("due")) {
        if (tryAssign(f.key, "MEDIUM", "Target")) break;
      }
      if ((e.includes("deadline") || e.includes("due") || e.includes("date")) && f.key === "metric_deadline") {
        if (tryAssign(f.key, "MEDIUM", "Deadline/date")) break;
      }
    }
    return { excelColumn: raw, targetField, confidence, reasoning };
  });
}

/** When the model skips a column, fill from rule-based fallback if that target is still unclaimed. */
function mergeAiMappingsWithFallback(headers: string[], aiMappings: ColumnMapping[]): ColumnMapping[] {
  const normalize = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const fbList = fallbackMatch(headers);
  const fbByCol = new Map(fbList.map((m) => [normalize(m.excelColumn), m]));
  const aiByCol = new Map<string, ColumnMapping>();
  for (const m of aiMappings) {
    aiByCol.set(normalize(m.excelColumn), m);
  }

  const usedTargets = new Set<string>();
  for (const m of aiMappings) {
    if (m.targetField) usedTargets.add(m.targetField);
  }

  return headers.map((h) => {
    const key = normalize(h);
    const aiRow = aiByCol.get(key);
    const fbRow = fbByCol.get(key);
    if (aiRow?.targetField) {
      return {
        excelColumn: h,
        targetField: aiRow.targetField,
        confidence: aiRow.confidence,
        reasoning: aiRow.reasoning,
      };
    }
    if (fbRow?.targetField && !usedTargets.has(fbRow.targetField)) {
      usedTargets.add(fbRow.targetField);
      return {
        excelColumn: h,
        targetField: fbRow.targetField,
        confidence: fbRow.confidence,
        reasoning: `Heuristic: ${fbRow.reasoning}`,
      };
    }
    return {
      excelColumn: h,
      targetField: null,
      confidence: "SKIP",
      reasoning: aiRow?.reasoning || fbRow?.reasoning || "No mapping",
    };
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await context.params;
    const body = await req.json();
    const { headers: rawHeaders, sampleRows = [] } = body as { headers?: string[]; sampleRows?: object[] };
    const headers = Array.isArray(rawHeaders) ? rawHeaders : [];

    const supabase = getSupabaseAdmin();
    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, division_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const managerAccess = await resolveManagerAccessForAppraisal({
      supabase,
      appraisalId,
      appraisalEmployeeId: appraisal.employee_id,
      appraisalManagerEmployeeId: appraisal.manager_employee_id,
      currentEmployeeId: user.employee_id ?? null,
    });
    const canAccess =
      user.roles?.some((r) => r === "hr" || r === "admin") ||
      appraisal.employee_id === user.employee_id ||
      managerAccess.hasManagerAccess ||
      (user.roles?.includes("gm") && appraisal.division_id === user.division_id);
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sample = (Array.isArray(sampleRows) ? sampleRows : []).slice(0, 3);
    const targetDesc = TARGET_FIELDS.map((f) => `- ${f.key}: ${f.label} — ${f.description}`).join("\n");

    const prompt = `You are mapping Excel column headers to database fields for a performance management system.

This may be a DBJ HR workplan template (Copy_of_DBJ_Individual_Workplan_Sheet) or a general spreadsheet.
DBJ-specific rules:
- Column "Performance Standard / Metric" maps to performance_standard.
- "Activities" maps to activities (activity lines; stored with key output on import).
- "Key Outputs" maps to key_output.
- "Major Tasks" maps to major_task.
- Map columns whose headers contain "MIS-KER", "MIS KER", or similar divisional KER codes to division_objective; corporate / strategic columns to corporate_objective. Never leave those unmapped when the header clearly indicates them.
- The "#" or "No." column is only a row index — use targetField null and confidence SKIP (do not map to a data field).
- "Weighting" and "Weight %" both map to weight as numeric percentage points (e.g. 20 means 20%).

Excel columns found: ${JSON.stringify(headers)}

Sample data (first 3 rows):
${JSON.stringify(sample, null, 2)}

Target database fields:
${targetDesc}

For each Excel column, determine the best matching database field.
Return ONLY valid JSON in this exact format:
{
  "mappings": [
    {
      "excelColumn": "Corporate Obj",
      "targetField": "corporate_objective",
      "confidence": "HIGH",
      "reasoning": "Column name directly matches corporate objective field"
    }
  ]
}

confidence must be one of: HIGH, MEDIUM, LOW, SKIP
Use SKIP when the column clearly doesn't match any target field. Set targetField to null for SKIP.
For row-number columns use targetField null and confidence SKIP.
Never map two Excel columns to the same target field.
Allowed targetField values must be one of: ${TARGET_FIELDS.map((f) => f.key).join(", ")}, or null for skip.`;

    let mappings: ColumnMapping[];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
        const msg = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
        });
        const block = msg.content.find((b) => b.type === "text");
        const raw = block && "text" in block ? block.text : "{}";
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { mappings?: ColumnMapping[] };
        if (Array.isArray(parsed.mappings) && parsed.mappings.length > 0) {
          const fieldKeys = new Set<string>(TARGET_FIELDS.map((f) => f.key));
          const normalizedAi = parsed.mappings.map((m) => {
            const rawTf = m.targetField === null || m.targetField === undefined || m.targetField === "SKIP" ? null : String(m.targetField);
            const lowerTf = rawTf?.toLowerCase() ?? "";
            let normalized: string | null = rawTf;
            if (!rawTf || lowerTf === "skip" || lowerTf === "row_number") normalized = null;
            else if (!fieldKeys.has(rawTf)) normalized = null;
            return {
              excelColumn: String(m.excelColumn ?? ""),
              targetField: normalized,
              confidence: ["HIGH", "MEDIUM", "LOW", "SKIP"].includes(m.confidence) ? m.confidence : "SKIP",
              reasoning: String(m.reasoning ?? ""),
            };
          });
          mappings = mergeAiMappingsWithFallback(headers, normalizedAi);
        } else {
          mappings = fallbackMatch(headers);
        }
      } catch {
        mappings = fallbackMatch(headers);
      }
    } else {
      mappings = fallbackMatch(headers);
    }

    return NextResponse.json({ mappings });
  } catch (err) {
    console.error("[workplan/analyse-columns]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
