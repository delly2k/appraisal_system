import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { employeeId } = await context.params;
    if (!employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });

    if (!canAccessEvidenceForEmployee(user, employeeId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from("achievement_timeline")
      .select("id, achievement_id, date_detected, summary")
      .eq("employee_id", employeeId)
      .order("date_detected", { ascending: false });

    const byMonth = new Map<string, typeof rows>();
    for (const r of rows ?? []) {
      const month = r.date_detected?.slice(0, 7) ?? "";
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(r);
    }

    const months = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, achievements]) => ({ month, achievements }));

    return NextResponse.json({ months });
  } catch (e) {
    console.error("[evidence/timeline GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
