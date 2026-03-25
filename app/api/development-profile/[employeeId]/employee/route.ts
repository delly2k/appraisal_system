import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { employeeId } = await params;
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

    if (user.employee_id !== employeeId) {
      return NextResponse.json({ error: "You can only update your own development profile" }, { status: 403 });
    }

    const body = await req.json();
    const {
      employee_ld_comments,
      skills,
      career_role,
      career_timeframe,
      career_expertise,
      career_remarks,
      secondment_interest,
      willing_to_relocate,
    } = body;

    const supabase = getSupabase();

    const payload: Record<string, unknown> = {
      last_updated_at: new Date().toISOString(),
    };
    if (user.source === "app_users") {
      payload.last_updated_by = user.id;
    }
    if (typeof employee_ld_comments === "string" || employee_ld_comments === null) payload.employee_ld_comments = employee_ld_comments;
    if (Array.isArray(skills)) payload.skills = skills;
    if (typeof career_role === "string" || career_role === null) payload.career_role = career_role;
    if (typeof career_timeframe === "string" || career_timeframe === null) payload.career_timeframe = career_timeframe;
    if (typeof career_expertise === "string" || career_expertise === null) payload.career_expertise = career_expertise;
    if (typeof career_remarks === "string" || career_remarks === null) payload.career_remarks = career_remarks;
    if (typeof secondment_interest === "boolean") payload.secondment_interest = secondment_interest;
    if (typeof willing_to_relocate === "boolean") payload.willing_to_relocate = willing_to_relocate;

    const { data: existing } = await supabase
      .from("employee_development_profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("employee_development_profiles")
        .update(payload)
        .eq("employee_id", employeeId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from("employee_development_profiles")
        .insert({ employee_id: employeeId, ...payload });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
