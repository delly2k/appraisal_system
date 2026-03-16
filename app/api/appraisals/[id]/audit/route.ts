import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    const isHR = user.roles?.includes("hr") || user.roles?.includes("admin");
    const empId = user.employee_id ?? null;
    const isEmployee = empId === appraisal.employee_id;
    const isManager = empId === appraisal.manager_employee_id;
    const canAccess = isHR || isEmployee || isManager;
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from("appraisal_audit")
      .select("id, action_type, actor_id, acted_at, summary")
      .eq("appraisal_id", appraisalId)
      .order("acted_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
    let displayNames: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from("app_users")
        .select("id, display_name, email")
        .in("id", actorIds);
      for (const u of users ?? []) {
        displayNames[u.id] = u.display_name?.trim() || u.email || "Unknown";
      }
    }

    const events = (rows ?? []).map((r) => ({
      id: r.id,
      action_type: r.action_type,
      acted_at: r.acted_at,
      summary: r.summary,
      actor_id: r.actor_id,
      actor_name: r.actor_id ? (displayNames[r.actor_id] ?? "Unknown") : "System",
    }));

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
