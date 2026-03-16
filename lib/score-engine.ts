import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Appraisal scoring engine.
 * Replicates Excel-style calculation: factor ratings × weights → section scores → total → rating band.
 * Stores results in appraisal_section_scores.
 */

type CategoryType = "core" | "productivity" | "leadership";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  return createClient(url, key);
}

/** Section scores and final rating. */
export interface CalculatedScores {
  competency_score: number | null;
  technical_score: number | null;
  productivity_score: number | null;
  leadership_score: number | null;
  workplan_score: number | null;
  total_score: number | null;
  final_rating: string | null;
}

/**
 * Calculate section scores from competency ratings, workplan points, then total and rating band.
 * Upserts into appraisal_section_scores.
 */
export async function calculateAppraisalScore(
  appraisalId: string
): Promise<CalculatedScores> {
  const supabase = getSupabaseAdmin();

  const { data: appraisal, error: appraisalError } = await supabase
    .from("appraisals")
    .select("id, employee_id, is_management")
    .eq("id", appraisalId)
    .single();

  if (appraisalError || !appraisal) {
    throw new Error(appraisalError?.message ?? "Appraisal not found");
  }

  const { data: ratingScale } = await supabase
    .from("rating_scale")
    .select("code, factor");
  const factorByCode = new Map<string, number>(
    (ratingScale ?? []).map((r) => [r.code, Number(r.factor)])
  );

  const { data: ratings } = await supabase
    .from("appraisal_factor_ratings")
    .select("factor_id, self_rating_code, manager_rating_code, weight")
    .eq("appraisal_id", appraisalId);

  // Technical: weighted sum (weight × factor) / totalWeight × 100
  let technical_score: number | null = null;
  const { data: techComps } = await supabase
    .from("appraisal_technical_competencies")
    .select("manager_rating, self_rating, weight")
    .eq("appraisal_id", appraisalId);

  if (techComps?.length) {
    let techWeightedSum = 0;
    let techTotalWeight = 0;
    for (const tc of techComps) {
      const code = tc.manager_rating ?? tc.self_rating ?? null;
      const factorValue = code ? factorByCode.get(code) ?? 0 : 0;
      const w = Number(tc.weight) || 0;
      if (w > 0) {
        techWeightedSum += w * factorValue;
        techTotalWeight += w;
      }
    }
    if (techTotalWeight > 0) {
      technical_score = Math.min(100, Math.max(0, (techWeightedSum / techTotalWeight) * 100));
    } else {
      // Fallback: unweighted average when no weights
      let techSum = 0;
      let techCount = 0;
      for (const tc of techComps) {
        const code = tc.manager_rating ?? tc.self_rating ?? null;
        const factorValue = code ? factorByCode.get(code) ?? 0 : 0;
        if (code) {
          techSum += factorValue;
          techCount += 1;
        }
      }
      if (techCount > 0) {
        technical_score = Math.min(100, Math.max(0, (techSum / techCount) * 100));
      }
    }
  }

  if (!ratings?.length && !techComps?.length) {
    const empty = await upsertScores(supabase, appraisalId, {
      competency_score: null,
      technical_score: null,
      productivity_score: null,
      leadership_score: null,
      workplan_score: null,
      total_score: null,
      final_rating: null,
    });
    return empty;
  }

  const factorIds = [...new Set((ratings ?? []).map((r) => r.factor_id))];
  const { data: factors } = await supabase
    .from("evaluation_factors")
    .select("id, category_id, weight")
    .in("id", factorIds);
  const categoryIdByFactorId = new Map<string, string>(
    (factors ?? []).map((f) => [f.id, f.category_id])
  );
  const weightByFactorId = new Map<string, number>(
    (factors ?? []).map((f) => [f.id, Number(f.weight) || 0])
  );

  const { data: categories } = await supabase
    .from("evaluation_categories")
    .select("id, category_type")
    .in("id", [...new Set(categoryIdByFactorId.values())]);
  const categoryTypeById = new Map<string, CategoryType>(
    (categories ?? []).map((c) => [c.id, c.category_type as CategoryType])
  );

  const pointsByCategory: Record<CategoryType, { sum: number; totalWeight: number; sumFactor: number; count: number }> = {
    core: { sum: 0, totalWeight: 0, sumFactor: 0, count: 0 },
    productivity: { sum: 0, totalWeight: 0, sumFactor: 0, count: 0 },
    leadership: { sum: 0, totalWeight: 0, sumFactor: 0, count: 0 },
  };

  for (const r of ratings ?? []) {
    const code = r.manager_rating_code ?? r.self_rating_code ?? null;
    const factorValue = code ? factorByCode.get(code) ?? 0 : 0;
    const catId = categoryIdByFactorId.get(r.factor_id);
    const categoryType = catId ? categoryTypeById.get(catId) : null;
    if (!categoryType) continue;
    const w = r.weight != null ? Number(r.weight) : weightByFactorId.get(r.factor_id) ?? 0;
    const bucket = pointsByCategory[categoryType];
    bucket.sum += w * factorValue;
    bucket.totalWeight += w;
    if (code) {
      bucket.sumFactor += factorValue;
      bucket.count += 1;
    }
  }

  const competency_score = sectionScoreFromBucket(pointsByCategory.core);
  const productivity_score = sectionScoreFromBucket(pointsByCategory.productivity);
  const leadership_score = sectionScoreFromBucket(pointsByCategory.leadership);

  let workplan_score: number | null = null;
  const { data: workplan } = await supabase
    .from("workplans")
    .select("id")
    .eq("appraisal_id", appraisalId)
    .single();

  if (workplan?.id) {
    const { data: items } = await supabase
      .from("workplan_items")
      .select("weight, points")
      .eq("workplan_id", workplan.id);
    let totalWeight = 0;
    let weightedSum = 0;
    for (const item of items ?? []) {
      const w = Number(item.weight) || 0;
      const p = item.points != null ? Number(item.points) : 0;
      totalWeight += w;
      weightedSum += p * w;
    }
    if (totalWeight > 0) {
      workplan_score = Math.min(100, Math.max(0, weightedSum / totalWeight));
    } else {
      workplan_score = 0;
    }
  }

  // Calculate total score: average of all sections
  // Non-management: (core + technical + productivity + workplan) / 4
  // Management: (core + technical + productivity + leadership + workplan) / 5
  const sections: number[] = [];
  if (competency_score != null) sections.push(competency_score);
  if (technical_score != null) sections.push(technical_score);
  if (productivity_score != null) sections.push(productivity_score);
  if (appraisal.is_management && leadership_score != null) sections.push(leadership_score);
  if (workplan_score != null) sections.push(workplan_score);

  const divisor = appraisal.is_management ? 5 : 4;
  const total_score = sections.length
    ? Math.min(100, Math.max(0, sections.reduce((a, b) => a + b, 0) / divisor))
    : null;

  const final_rating =
    total_score != null ? await lookupRatingBand(supabase, total_score) : null;

  return upsertScores(supabase, appraisalId, {
    competency_score,
    technical_score,
    productivity_score,
    leadership_score,
    workplan_score,
    total_score,
    final_rating,
  });
}

function sectionScoreFromBucket(bucket: {
  sum: number;
  totalWeight: number;
  sumFactor: number;
  count: number;
}): number | null {
  if (bucket.totalWeight > 0) {
    const pct = (bucket.sum / bucket.totalWeight) * 100;
    return Math.min(100, Math.max(0, pct));
  }
  if (bucket.count > 0) {
    const avg = bucket.sumFactor / bucket.count;
    return Math.min(100, Math.max(0, avg * 100));
  }
  return null;
}

async function lookupRatingBand(
  supabase: SupabaseClient,
  totalScore: number
): Promise<string | null> {
  const { data: bands } = await supabase
    .from("rating_bands")
    .select("min_score, max_score, label")
    .lte("min_score", totalScore)
    .order("min_score", { ascending: false });

  for (const b of bands ?? []) {
    const max = b.max_score != null ? Number(b.max_score) : 100;
    if (totalScore <= max) return b.label;
  }
  return null;
}

async function upsertScores(
  supabase: SupabaseClient,
  appraisalId: string,
  scores: CalculatedScores
): Promise<CalculatedScores> {
  const row = {
    appraisal_id: appraisalId,
    competency_score: scores.competency_score,
    technical_score: scores.technical_score,
    productivity_score: scores.productivity_score,
    leadership_score: scores.leadership_score,
    workplan_score: scores.workplan_score,
    total_score: scores.total_score,
    final_rating: scores.final_rating,
    calculated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("appraisal_section_scores")
    .upsert(row, { onConflict: "appraisal_id" });

  if (error) {
    throw new Error(`Failed to store scores: ${error.message}`);
  }

  return scores;
}
