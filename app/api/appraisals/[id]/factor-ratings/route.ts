import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

function canAccessAppraisal(
  user: { roles?: string[]; employee_id?: string | null; division_id?: string | null },
  appraisal: { employee_id: string; manager_employee_id: string | null; division_id?: string | null }
): boolean {
  const roles = user.roles ?? [];
  const empId = user.employee_id ?? null;
  const divId = user.division_id ?? null;
  return (
    roles.includes("hr") ||
    roles.includes("admin") ||
    appraisal.employee_id === empId ||
    appraisal.manager_employee_id === empId ||
    (roles.includes("gm") && divId != null && appraisal.division_id === divId)
  );
}

/** GET: return factor ratings for this appraisal (so client can load without RLS). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, division_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    if (!canAccessAppraisal(user, appraisal)) {
      return NextResponse.json({ error: "You do not have access to this appraisal" }, { status: 403 });
    }

    const { data: ratingData, error: rateErr } = await supabase
      .from("appraisal_factor_ratings")
      .select("factor_id, self_rating_code, manager_rating_code, self_comments, manager_comments, weight")
      .eq("appraisal_id", appraisalId);

    if (rateErr) return NextResponse.json({ error: rateErr.message }, { status: 400 });

    const { data: categories } = await supabase
      .from("evaluation_categories")
      .select("id, category_type")
      .in("category_type", ["core", "productivity", "leadership"])
      .eq("active", true);

    const catIds = (categories ?? []).map((c: { id: string }) => c.id);
    let factorRows: { id: string; category_id: string; weight: number | null }[] = [];
    if (catIds.length > 0) {
      const { data: factors } = await supabase
        .from("evaluation_factors")
        .select("id, category_id, weight")
        .in("category_id", catIds)
        .eq("active", true);
      factorRows = (factors ?? []) as { id: string; category_id: string; weight: number | null }[];
    }

    const factorMeta: Record<string, { category_id: string; weight: number | null }> = Object.fromEntries(
      factorRows.map((f) => [f.id, { category_id: f.category_id, weight: f.weight }])
    );
    const categoryTypes: Record<string, string> = Object.fromEntries(
      (categories ?? []).map((c: { id: string; category_type: string }) => [c.id, c.category_type])
    );

    return NextResponse.json({
      ratings: ratingData ?? [],
      factorMeta,
      categoryTypes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Body: { ratings: Array<{ factor_id: string; self_rating_code?: string | null; manager_rating_code?: string | null; self_comments?: string | null; manager_comments?: string | null }> } */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, status, employee_id, manager_employee_id, division_id")
      .eq("id", appraisalId)
      .single();

    if (appErr || !appraisal) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }

    if (!canAccessAppraisal(user, appraisal)) {
      return NextResponse.json({ error: "You do not have access to this appraisal" }, { status: 403 });
    }

    const body = await req.json();
    const ratings = Array.isArray(body?.ratings) ? body.ratings : [];
    if (ratings.length === 0) {
      return NextResponse.json({ success: true });
    }

    const status = (appraisal.status as string)?.toUpperCase();
    const hasWeightInPayload = ratings.some((r: { weight?: number }) => r.weight !== undefined && r.weight !== null);
    if (status === "DRAFT" && hasWeightInPayload) {
      const { data: coreCategory } = await supabase
        .from("evaluation_categories")
        .select("id")
        .eq("category_type", "core")
        .limit(1)
        .maybeSingle();
      if (coreCategory?.id) {
        const { data: coreFactors } = await supabase
          .from("evaluation_factors")
          .select("id")
          .eq("category_id", coreCategory.id)
          .eq("active", true);
        const coreFactorIds = new Set((coreFactors ?? []).map((f: { id: string }) => f.id));
        const coreInPayload = ratings.filter((r: { factor_id: string }) => coreFactorIds.has(r.factor_id));
        if (coreInPayload.length > 0) {
          const coreTotal = coreInPayload.reduce((s: number, r: { weight?: number }) => s + (Number(r.weight) || 0), 0);
          if (Math.abs(coreTotal - 100) >= 0.01) {
            return NextResponse.json(
              { error: "Core competency weights must total 100%." },
              { status: 400 }
            );
          }
        }
      }
      const { data: prodCategory } = await supabase
        .from("evaluation_categories")
        .select("id")
        .eq("category_type", "productivity")
        .limit(1)
        .maybeSingle();
      if (prodCategory?.id) {
        const { data: prodFactors } = await supabase
          .from("evaluation_factors")
          .select("id")
          .eq("category_id", prodCategory.id)
          .eq("active", true);
        const prodFactorIds = new Set((prodFactors ?? []).map((f: { id: string }) => f.id));
        const prodInPayload = ratings.filter((r: { factor_id: string }) => prodFactorIds.has(r.factor_id));
        if (prodInPayload.length > 0) {
          const prodTotal = prodInPayload.reduce((s: number, r: { weight?: number }) => s + (Number(r.weight) || 0), 0);
          if (Math.abs(prodTotal - 100) >= 0.01) {
            return NextResponse.json(
              { error: "Productivity factor weights must total 100%." },
              { status: 400 }
            );
          }
        }
      }
      const { data: leadCategory } = await supabase
        .from("evaluation_categories")
        .select("id")
        .eq("category_type", "leadership")
        .limit(1)
        .maybeSingle();
      if (leadCategory?.id) {
        const { data: leadFactors } = await supabase
          .from("evaluation_factors")
          .select("id")
          .eq("category_id", leadCategory.id)
          .eq("active", true);
        const leadFactorIds = new Set((leadFactors ?? []).map((f: { id: string }) => f.id));
        const leadInPayload = ratings.filter((r: { factor_id: string }) => leadFactorIds.has(r.factor_id));
        if (leadInPayload.length > 0) {
          const leadTotal = leadInPayload.reduce((s: number, r: { weight?: number }) => s + (Number(r.weight) || 0), 0);
          if (Math.abs(leadTotal - 100) >= 0.01) {
            return NextResponse.json(
              { error: "Leadership factor weights must total 100%." },
              { status: 400 }
            );
          }
        }
      }
    }

    for (const r of ratings) {
      const factorId = r?.factor_id;
      if (!factorId || typeof factorId !== "string") continue;

      const payload: Record<string, unknown> = {
        appraisal_id: appraisalId,
        factor_id: factorId,
        self_rating_code: r.self_rating_code ?? null,
        manager_rating_code: r.manager_rating_code ?? null,
        self_comments: r.self_comments ?? null,
        manager_comments: r.manager_comments ?? null,
      };
      if (r.weight !== undefined && r.weight !== null) payload.weight = Number(r.weight);

      const { data: existing } = await supabase
        .from("appraisal_factor_ratings")
        .select("id")
        .eq("appraisal_id", appraisalId)
        .eq("factor_id", factorId)
        .maybeSingle();

      if (existing) {
        const { error: upErr } = await supabase
          .from("appraisal_factor_ratings")
          .update(payload)
          .eq("id", existing.id);
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      } else {
        const { error: insErr } = await supabase.from("appraisal_factor_ratings").insert(payload);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
