import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/achieveit/plan?skip=0&take=100
 * Fetches the plan export for ACHIEVEIT_PLAN_ID from env (avoids CORS, uses server env).
 */
export async function GET(request: NextRequest) {
  const planId = process.env.ACHIEVEIT_PLAN_ID;
  const apiKey = process.env.ACHIEVEIT_API_KEY;

  if (!planId || !apiKey) {
    return NextResponse.json(
      { error: "ACHIEVEIT_PLAN_ID and ACHIEVEIT_API_KEY must be set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0", 10) || 0);
  const take = Math.min(500, Math.max(1, parseInt(searchParams.get("take") ?? "100", 10) || 100));

  const url = `https://api.achieveit.com/exports/plans/${planId}?skip=${skip}&take=${take}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `API-KEY ${apiKey}`,
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.statusText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
