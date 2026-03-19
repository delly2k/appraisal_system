import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

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
  { key: "major_task", label: "Major task", description: "The main task or deliverable the employee will complete" },
  { key: "key_output", label: "Key output", description: "The measurable output or deliverable for this task" },
  { key: "performance_standard", label: "Performance standard", description: "The standard or criteria used to measure success" },
  { key: "weight", label: "Weight (%)", description: "Percentage weighting of this objective (all objectives must sum to 100)" },
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
    const e = lower(excelCol);
    let targetField: string | null = null;
    let confidence: ColumnMapping["confidence"] = "SKIP";
    let reasoning = "No match";

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
      if (e.includes("corporate") && f.key === "corporate_objective") { targetField = f.key; confidence = "MEDIUM"; reasoning = "Contains 'corporate'"; used.add(f.key); break; }
      if (e.includes("division") && f.key === "division_objective") { targetField = f.key; confidence = "MEDIUM"; reasoning = "Contains 'division'"; used.add(f.key); break; }
      if (e.includes("major") && e.includes("task") && f.key === "major_task") { targetField = f.key; confidence = "HIGH"; reasoning = "Major task"; used.add(f.key); break; }
      if (e.includes("key") && e.includes("output") && f.key === "key_output") { targetField = f.key; confidence = "HIGH"; reasoning = "Key output"; used.add(f.key); break; }
      if (e.includes("performance") && e.includes("standard") && f.key === "performance_standard") { targetField = f.key; confidence = "HIGH"; reasoning = "Performance standard"; used.add(f.key); break; }
      if ((e.includes("weight") || e === "weight%") && f.key === "weight") { targetField = f.key; confidence = "HIGH"; reasoning = "Weight"; used.add(f.key); break; }
      if (e.includes("target") && f.key === "metric_target") { targetField = f.key; confidence = "MEDIUM"; reasoning = "Target"; used.add(f.key); break; }
      if ((e.includes("deadline") || e.includes("due") || e.includes("date")) && f.key === "metric_deadline") { targetField = f.key; confidence = "MEDIUM"; reasoning = "Deadline/date"; used.add(f.key); break; }
    }
    return { excelColumn: excelCol, targetField, confidence, reasoning };
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

    if (appErr || !appraisal)
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });

    const canAccess =
      user.roles?.some((r) => r === "hr" || r === "admin") ||
      appraisal.employee_id === user.employee_id ||
      appraisal.manager_employee_id === user.employee_id ||
      (user.roles?.includes("gm") && appraisal.division_id === user.division_id);
    if (!canAccess)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sample = (Array.isArray(sampleRows) ? sampleRows : []).slice(0, 3);
    const targetDesc = TARGET_FIELDS.map((f) => `- ${f.key}: ${f.label} — ${f.description}`).join("\n");

    const prompt = `You are mapping Excel column headers to database fields for a performance management system.

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
Never map two Excel columns to the same target field.`;

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
          mappings = parsed.mappings.map((m) => ({
            excelColumn: String(m.excelColumn ?? ""),
            targetField: m.targetField === null || m.targetField === "SKIP" ? null : String(m.targetField),
            confidence: ["HIGH", "MEDIUM", "LOW", "SKIP"].includes(m.confidence) ? m.confidence : "SKIP",
            reasoning: String(m.reasoning ?? ""),
          }));
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
