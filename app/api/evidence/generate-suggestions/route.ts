import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";
import { getGraphToken } from "@/lib/azure-graph-token";
import { collectAppraisalEvidence } from "@/lib/evidence-collectors";
import { extractKeywords, keywordMatch } from "@/lib/evidence-keywords";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

interface EvidenceRow {
  id?: string;
  activity_type: string;
  title: string | null;
  activity_date: string;
  confidence_weight?: number;
  related_goal_id?: string | null;
  description?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { employeeId, appraisalId, reviewStart, reviewEnd } = body as {
      employeeId: string;
      appraisalId: string;
      reviewStart: string;
      reviewEnd: string;
    };
    if (!employeeId || !appraisalId || !reviewStart || !reviewEnd) {
      return NextResponse.json({ error: "Missing employeeId, appraisalId, reviewStart, or reviewEnd" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: appraisal } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();
    if (!appraisal || appraisal.employee_id !== employeeId) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }
    if (!canAccessEvidenceForEmployee(user, employeeId, { appraisalManagerId: appraisal.manager_employee_id ?? undefined })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const graphToken = await getGraphToken();
    const graphStatus = graphToken ? "live" : "stub";
    const graphNote = graphToken
      ? "Connected to Microsoft Graph"
      : "Requires Azure Graph OAuth — not yet connected";

    const appraisalResult = await collectAppraisalEvidence(supabase, employeeId, appraisalId, reviewStart, reviewEnd);
    const appraisalCollected = appraisalResult.collected;

    const base = (
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
      "http://localhost:3000"
    ).replace(/\/$/, "");

    let calendarCollected = 0;
    let calendarDiag: unknown = undefined;
    try {
      const calRes = await fetch(`${base}/api/evidence/collect/calendar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ employeeId, reviewStart, reviewEnd, graphToken }),
      });
      const calData = await calRes.json();
      calendarCollected = calData.collected ?? 0;
      calendarDiag = calData?.diagnosis;
    } catch (e) {
      console.warn("[generate-suggestions] calendar collector unavailable:", e);
    }

    let sharepointCollected = 0;
    let sharePointDiag: unknown = undefined;
    try {
      const spRes = await fetch(`${base}/api/evidence/collect/sharepoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ employeeId, reviewStart, reviewEnd, graphToken }),
      });
      const spData = await spRes.json();
      sharepointCollected = spData.collected ?? 0;
      sharePointDiag = spData?.diagnosis;
    } catch (e) {
      console.warn("[generate-suggestions] sharepoint collector unavailable:", e);
    }

    const { data: workplanEarly } = await supabase
      .from("workplans")
      .select("id")
      .eq("appraisal_id", appraisalId)
      .maybeSingle();

    const { data: workplanItemsEarly } = workplanEarly
      ? await supabase
          .from("workplan_items")
          .select("id, corporate_objective, division_objective, individual_objective, major_task, key_output, performance_standard")
          .eq("workplan_id", workplanEarly.id)
      : { data: null as null };

    const workplanItemsForEmail = workplanItemsEarly ?? [];

    let emailCollected = 0;
    let emailDiag: unknown = undefined;
    try {
      const emailRes = await fetch(`${base}/api/evidence/collect/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          employeeId,
          reviewStart,
          reviewEnd,
          graphToken,
          workplanItems: workplanItemsForEmail,
          appraisalManagerId: appraisal.manager_employee_id ?? undefined,
        }),
      });
      const emailData = await emailRes.json();
      emailCollected = emailData.collected ?? 0;
      emailDiag = emailData?.diagnosis;
    } catch (e) {
      console.warn("[generate-suggestions] email collector unavailable:", e);
    }

    const scanReport = {
      generatedAt: new Date().toISOString(),
      totalCollected: appraisalCollected + calendarCollected + sharepointCollected + emailCollected,
      sources: [
        {
          name: "Appraisal / Workplan",
          attempted: true,
          collected: appraisalCollected,
          status: "live",
          note: "Reads workplan objectives, tasks, and outcomes from Supabase",
        },
        {
          name: "Calendar / Meetings",
          attempted: true,
          collected: calendarCollected,
          status: graphStatus,
          note: graphToken
            ? "Reading calendar events via Microsoft Graph"
            : "Requires Azure Graph OAuth — not yet connected",
        },
        {
          name: "SharePoint / OneDrive",
          attempted: true,
          collected: sharepointCollected,
          status: graphStatus,
          note: graphToken
            ? "Reading OneDrive and SharePoint files via Microsoft Graph"
            : "Requires Azure Graph OAuth — not yet connected",
        },
        {
          name: "Email (Sent Items)",
          attempted: true,
          collected: emailCollected,
          status: graphStatus,
          note: graphToken
            ? "Sent mail matched to workplan objectives via Microsoft Graph"
            : graphNote,
        },
      ],
    };

    const diagnosis = {
      appraisal: appraisalResult.diagnosis,
      calendar: calendarDiag,
      sharePoint: sharePointDiag,
      email: emailDiag,
      clustering: undefined as unknown,
    };

    const { data: workplan } = workplanEarly
      ? { data: workplanEarly }
      : await supabase.from("workplans").select("id").eq("appraisal_id", appraisalId).single();

    if (!workplan) {
      return NextResponse.json({
        suggestions: [],
        scanReport,
        diagnosis,
        message: "No workplan found for this appraisal.",
      });
    }

    const { data: workplanItems } = await supabase
      .from("workplan_items")
      .select("id, corporate_objective, division_objective, individual_objective, major_task, key_output, performance_standard, actual_result, updated_at")
      .eq("workplan_id", workplan.id);

    if (!workplanItems?.length) {
      return NextResponse.json({
        suggestions: [],
        scanReport,
        diagnosis,
        message: "No workplan items found.",
      });
    }

    const { data: allEvidenceRows } = await supabase
      .from("evidence_items")
      .select("id, activity_type, title, activity_date, confidence_weight, related_goal_id")
      .eq("employee_id", employeeId)
      .gte("activity_date", reviewStart)
      .lte("activity_date", reviewEnd);

    const allEvidenceItems = (allEvidenceRows ?? []) as EvidenceRow[];
    const today = new Date().toISOString().slice(0, 10);

    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const suggestions: Array<{
      id: string;
      achievement_text: string;
      confidence_level: string;
      evidence_summary: string[];
    }> = [];

    for (const item of workplanItems as Array<{
      id: string;
      corporate_objective?: string | null;
      division_objective?: string | null;
      individual_objective?: string | null;
      major_task?: string | null;
      key_output?: string | null;
      performance_standard?: string | null;
      actual_result?: string | null;
      updated_at?: string | null;
    }>) {
      const searchTerms = [
        item.major_task,
        item.key_output,
        item.corporate_objective,
        item.division_objective,
        item.individual_objective,
        item.performance_standard,
      ]
        .filter(Boolean)
        .join(" ");
      const itemWords = extractKeywords(searchTerms);

      const matchingEvidence = allEvidenceItems.filter((ev) => {
        if (ev.related_goal_id === item.id) return true;
        const evWords = extractKeywords(ev.title ?? "");
        return keywordMatch(itemWords, evWords);
      });

      const hasActualResult = item.actual_result != null && String(item.actual_result).trim() !== "";
      const anchorEvidence: EvidenceRow = {
        activity_type: hasActualResult ? "goal_milestone_completed" : "task_completed",
        title: item.major_task ?? item.division_objective ?? item.individual_objective ?? "Workplan objective",
        activity_date: item.updated_at?.slice(0, 10) ?? today,
        confidence_weight: hasActualResult ? 100 : 85,
      };

      const evidenceForItem: EvidenceRow[] = [anchorEvidence, ...matchingEvidence];
      const totalScore = evidenceForItem.reduce((s, e) => s + (e.confidence_weight ?? 0), 0);
      if (totalScore < 100) continue;

      const taskLabel = item.major_task ?? item.division_objective ?? "Not specified";
      const keyOutputLabel = item.key_output ?? "Not specified";
      const standardLabel = item.performance_standard ?? "Not specified";
      const actualLabel = item.actual_result != null ? String(item.actual_result) : "In progress";

      const prompt = `You are generating a performance appraisal achievement for a specific workplan objective.

The employee's objective was:
- Task: ${taskLabel}
- Key output: ${keyOutputLabel}
- Performance standard: ${standardLabel}
- Actual result: ${actualLabel}

Supporting evidence (documents, meetings, and activity related to this objective):
${evidenceForItem
        .map((e) => {
          const extra =
            e.description && String(e.description).trim()
              ? ` — ${String(e.description).trim().slice(0, 120)}`
              : "";
          return `- ${e.activity_type}: ${e.title} (${e.activity_date})${extra}`;
        })
        .join("\n")}

Write one concise achievement statement that describes what was accomplished for THIS objective specifically.
Use ONLY the evidence provided. Do not invent activities.
State facts only. Do not exaggerate.

Respond in JSON only:
{
  "achievement": "string",
  "evidence_bullets": ["string"],
  "confidence": "high" | "medium" | "low"
}`.trim();

      let raw: string;
      let msg: Awaited<ReturnType<typeof anthropic.messages.create>> | null = null;
      try {
        msg = await anthropic.messages.create({
          model,
          max_tokens: 512,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        });
        const block = msg.content.find((b) => b.type === "text");
        raw = block && "text" in block ? block.text : "{}";
      } catch (err) {
        console.error("[generate-suggestions] Anthropic error for workplan item", item.id, err);
        continue;
      }

      raw = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      let parsed: { achievement?: string; evidence_bullets?: string[]; confidence?: string };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        continue;
      }

      const achievementText = parsed.achievement ?? "";
      if (!achievementText) continue;

      const confidence = ["high", "medium", "low"].includes(parsed.confidence ?? "")
        ? (parsed.confidence as "high" | "medium" | "low")
        : "medium";
      const evidenceSummary = Array.isArray(parsed.evidence_bullets)
        ? parsed.evidence_bullets
        : evidenceForItem.map((e) => `${e.activity_type}: ${e.title}`);

      const { data: inserted } = await supabase
        .from("achievement_suggestions")
        .insert({
          employee_id: employeeId,
          cluster_id: item.id,
          achievement_text: achievementText,
          confidence_level: confidence,
          evidence_summary: evidenceSummary,
          status: "pending",
          appraisal_id: appraisalId,
        })
        .select("id")
        .single();

      if (inserted) {
        const tokensUsed =
          msg?.usage && "input_tokens" in msg.usage
            ? (msg.usage.input_tokens ?? 0) + (msg.usage && "output_tokens" in msg.usage ? msg.usage.output_tokens ?? 0 : 0)
            : 0;
        await supabase.from("ai_audit_log").insert({
          employee_id: employeeId,
          cluster_id: item.id,
          prompt_used: prompt,
          suggestion_generated: achievementText,
          accepted_by_user: false,
          model_used: model,
          tokens_used: tokensUsed,
        });

        suggestions.push({
          id: inserted.id,
          achievement_text: achievementText,
          confidence_level: confidence,
          evidence_summary: evidenceSummary,
        });
      }
    }

    return NextResponse.json({
      suggestions,
      scanReport,
      diagnosis,
      ...(suggestions.length === 0 ? { message: "No workplan items had sufficient supporting evidence to generate suggestions." } : {}),
    });
  } catch (e) {
    console.error("[evidence/generate-suggestions]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
