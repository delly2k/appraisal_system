import { NextResponse } from "next/server";

const ACHIEVEIT_API_KEY = "65409926-0809-41aa-ab3b-cbb625a9ba78";

/**
 * Proxies GET to AchieveIt exports/plans (no planId) to list plans the API key can access.
 * AchieveIt may or may not support this; response is passed through as-is.
 */
export async function GET() {
  const url = "https://api.achieveit.com/exports/plans";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `API-KEY ${ACHIEVEIT_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    try {
      const data = text ? JSON.parse(text) : {};
      return NextResponse.json(data, { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
