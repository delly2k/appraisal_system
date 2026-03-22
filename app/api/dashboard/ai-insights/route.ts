import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth-options";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getCurrentUser();
    const isHr = user?.roles?.some((r) => r === "hr" || r === "admin") ?? false;
    if (!isHr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      scoreDistribution,
      meanScore,
      stdDeviation,
      stagePipeline,
      divisionBreakdown,
    } = body as Record<string, unknown>;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured (ANTHROPIC_API_KEY missing)" },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

    const userPrompt = `Here is the FY 2026 performance appraisal data:

Score distribution: ${JSON.stringify(scoreDistribution)}
Mean score: ${meanScore}
Standard deviation: ${stdDeviation}
Stage pipeline: ${JSON.stringify(stagePipeline)}
Division breakdown: ${JSON.stringify(divisionBreakdown)}

Provide 3-4 concise insights about the distribution,
highlight any anomalies or concerns, and suggest 1-2
actions HR should consider. Be specific and data-driven.
Format each insight as a bullet point starting with •`;

    const msg = await anthropic.messages.create({
      model,
      max_tokens: 500,
      system:
        "You are an HR analytics assistant for the Development Bank of Jamaica.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = msg.content.find((b) => b.type === "text");
    const text = block && "text" in block ? block.text : "";

    return NextResponse.json({ insights: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI insights failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
