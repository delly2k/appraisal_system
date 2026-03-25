import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const NOT_LINKED = {
  error: "Your account must be linked to an employee record before EQ progress can be saved.",
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ draft: null, questions: [] });

  const supabase = createClient();
  const { data: questions, error } = await supabase
    .from("eq_questions")
    .select("id, text, competency")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const employeeId = user.employee_id?.trim();
  if (!employeeId) {
    return NextResponse.json({ draft: null, questions: questions ?? [] });
  }

  const { data: draft } = await supabase
    .from("eq_drafts")
    .select("responses, last_page, updated_at")
    .eq("employee_id", employeeId)
    .maybeSingle();

  return NextResponse.json({ draft: draft ?? null, questions: questions ?? [] });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = user.employee_id?.trim();
  if (!employeeId) {
    return NextResponse.json(NOT_LINKED, { status: 403 });
  }

  let body: { responses?: Record<string, unknown>; last_page?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const responses = body.responses != null && typeof body.responses === "object" && !Array.isArray(body.responses) ? body.responses : {};
  const rawPage = body.last_page;
  const last_page =
    typeof rawPage === "number" && Number.isInteger(rawPage) ? Math.max(0, Math.min(4, rawPage)) : 0;

  const supabase = createClient();

  const updatedAt = new Date().toISOString();
  const row = {
    responses,
    last_page,
    updated_at: updatedAt,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("eq_drafts")
    .update(row)
    .eq("employee_id", employeeId)
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (updatedRows && updatedRows.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: insertError } = await supabase.from("eq_drafts").insert({
    employee_id: employeeId,
    ...row,
  });

  if (insertError) {
    const dup =
      insertError.code === "23505" ||
      /duplicate key|unique constraint/i.test(String(insertError.message ?? ""));
    if (dup) {
      const { error: retryErr } = await supabase.from("eq_drafts").update(row).eq("employee_id", employeeId);
      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = user.employee_id?.trim();
  if (!employeeId) {
    return NextResponse.json(NOT_LINKED, { status: 403 });
  }

  const supabase = createClient();

  const { data: last } = await supabase
    .from("eq_results")
    .select("taken_at")
    .eq("employee_id", employeeId)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last) {
    const days = Math.floor((Date.now() - new Date(last.taken_at).getTime()) / 86400000);
    if (days < 90) {
      return NextResponse.json({ error: `Retake available in ${90 - days} days` }, { status: 429 });
    }
  }

  const { sa_total, me_total, mo_total, e_total, ss_total, responses } = await req.json();

  const { data, error } = await supabase
    .from("eq_results")
    .insert({ employee_id: employeeId, sa_total, me_total, mo_total, e_total, ss_total, responses })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("eq_drafts").delete().eq("employee_id", employeeId);
  return NextResponse.json({ id: data.id });
}
