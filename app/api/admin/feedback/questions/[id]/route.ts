import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireHrAdmin() {
  const user = await getCurrentUser();
  if (!user?.roles?.length) return null;
  const isAdmin = user.roles.some((r) => r === "hr" || r === "admin");
  return isAdmin ? user : null;
}

const REVIEWER_TYPES = ["SELF", "MANAGER", "PEER", "DIRECT_REPORT"] as const;

type ReviewerType = (typeof REVIEWER_TYPES)[number];

function normalizeReviewerType(value: unknown): ReviewerType | null {
  const t = String(value ?? "").trim().toUpperCase();
  return REVIEWER_TYPES.includes(t as ReviewerType) ? (t as ReviewerType) : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHrAdmin();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.reviewer_type != null) {
      const rt = normalizeReviewerType(body.reviewer_type);
      if (!rt) return NextResponse.json({ error: "Invalid reviewer_type" }, { status: 400 });
      updates.reviewer_type = rt;
    }

    if (body.competency_group != null || body.category != null) {
      const cg = String(body.competency_group ?? body.category ?? "").trim();
      if (!cg) return NextResponse.json({ error: "competency_group/category cannot be empty" }, { status: 400 });
      updates.competency_group = cg;
    }

    if (body.question_text != null) {
      const qt = String(body.question_text ?? "").trim();
      if (!qt) return NextResponse.json({ error: "question_text cannot be empty" }, { status: 400 });
      updates.question_text = qt;
    }

    if (body.sort_order != null) {
      const so = Number(body.sort_order);
      if (!Number.isFinite(so)) return NextResponse.json({ error: "sort_order must be numeric" }, { status: 400 });
      updates.sort_order = Math.max(1, Math.floor(so));
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("feedback_question")
      .update(updates)
      .eq("id", id)
      .select("id, reviewer_type, competency_group, question_text, sort_order, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, question: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireHrAdmin();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { error } = await supabase.from("feedback_question").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
