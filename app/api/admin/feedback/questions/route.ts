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

export async function GET(request: NextRequest) {
  try {
    const user = await requireHrAdmin();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const reviewerType = normalizeReviewerType(request.nextUrl.searchParams.get("reviewer_type"));
    // cycle_id: reserved for future per-cycle question sets; questions are currently global
    void request.nextUrl.searchParams.get("cycle_id");

    let query = supabase
      .from("feedback_question")
      .select("id, reviewer_type, competency_group, question_text, sort_order, created_at")
      .order("competency_group")
      .order("sort_order");

    if (reviewerType) {
      query = query.eq("reviewer_type", reviewerType);
    }

    const [{ data: questions, error: questionErr }, { data: scale, error: scaleErr }] = await Promise.all([
      query,
      supabase.from("feedback_rating_scale").select("id, value, label, sort_order").order("sort_order"),
    ]);

    if (questionErr) return NextResponse.json({ error: questionErr.message }, { status: 500 });
    if (scaleErr) return NextResponse.json({ error: scaleErr.message }, { status: 500 });

    return NextResponse.json({
      questions: questions ?? [],
      scale: scale ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load questions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireHrAdmin();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));

    const reviewer_type = normalizeReviewerType(body.reviewer_type);
    const competency_group = String(body.competency_group ?? body.category ?? "").trim();
    const question_text = String(body.question_text ?? "").trim();
    const sort_order_raw = Number(body.sort_order);

    if (!reviewer_type || !competency_group || !question_text) {
      return NextResponse.json(
        { error: "reviewer_type, competency_group/category, and question_text are required" },
        { status: 400 }
      );
    }

    let sort_order = Number.isFinite(sort_order_raw) ? Math.max(1, Math.floor(sort_order_raw)) : 0;

    if (!sort_order) {
      const { data: maxRows } = await supabase
        .from("feedback_question")
        .select("sort_order")
        .eq("reviewer_type", reviewer_type)
        .eq("competency_group", competency_group)
        .order("sort_order", { ascending: false })
        .limit(1);
      const currentMax = Number(maxRows?.[0]?.sort_order ?? 0);
      sort_order = currentMax + 1;
    }

    const { data, error } = await supabase
      .from("feedback_question")
      .insert({ reviewer_type, competency_group, question_text, sort_order })
      .select("id, reviewer_type, competency_group, question_text, sort_order, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, question: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create question";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
