/**
 * Single source of truth for appraisal summary (manager review score).
 * Builds the input for calcSummary() so Summary tab, signoff/status, and PDF
 * all use the same data: workplan with mgr_result when present, manager ratings.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SummaryCalcProps, WeightedRatingItem, WorkplanItemSummary } from "@/lib/summary-calc";

export interface BuildSummaryInputResult extends SummaryCalcProps {
  /** Same as isManagementTrack; exposed for callers that need it. */
  isManagementTrack: boolean;
}

/**
 * Load appraisal summary input (manager review = final score).
 * Uses mgr_result when present for workplan; manager_rating for factors and technical.
 */
export async function buildSummaryInput(
  appraisalId: string,
  supabase: SupabaseClient,
  options?: { showLeadership?: boolean }
): Promise<BuildSummaryInputResult> {
  const { data: appraisal, error: appErr } = await supabase
    .from("appraisals")
    .select("id, employee_id, is_management")
    .eq("id", appraisalId)
    .single();

  if (appErr || !appraisal) {
    throw new Error("Appraisal not found");
  }

  const isManagementTrack = options?.showLeadership ?? !!appraisal.is_management;

  // Workplan: mgr_result when present, else actual_result
  const { data: workplan } = await supabase.from("workplans").select("id").eq("appraisal_id", appraisalId).single();
  let workplanItems: WorkplanItemSummary[] = [];
  if (workplan?.id) {
    const { data: items } = await supabase
      .from("workplan_items")
      .select("weight, actual_result, mgr_result")
      .eq("workplan_id", workplan.id);
    workplanItems = (items ?? []).map((i: { weight?: number; actual_result?: number | string | null; mgr_result?: number | string | null }) => {
      const effectiveActual =
        i.mgr_result != null && i.mgr_result !== ""
          ? Number(i.mgr_result)
          : i.actual_result != null
            ? Number(i.actual_result)
            : null;
      return {
        weight: Number(i.weight) ?? 0,
        actual_result: effectiveActual,
      };
    });
  }

  // Factor ratings + category mapping (same as factor-ratings API)
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

  const { data: ratingRows } = await supabase
    .from("appraisal_factor_ratings")
    .select("factor_id, manager_rating_code, self_rating_code, weight")
    .eq("appraisal_id", appraisalId);

  const competencies: WeightedRatingItem[] = [];
  const productivity: WeightedRatingItem[] = [];
  const leadership: WeightedRatingItem[] = [];

  for (const r of ratingRows ?? []) {
    const meta = factorMeta[(r as { factor_id: string }).factor_id];
    if (!meta) continue;
    const catType = categoryTypes[meta.category_id];
    const item: WeightedRatingItem = {
      manager_rating: (r as { manager_rating_code?: string | null }).manager_rating_code ?? null,
      self_rating: (r as { self_rating_code?: string | null }).self_rating_code ?? null,
      weight: (r as { weight?: number | null }).weight != null ? Number((r as { weight?: number | null }).weight) : (meta.weight != null ? Number(meta.weight) : 0),
    };
    if (catType === "core") competencies.push(item);
    else if (catType === "productivity") productivity.push(item);
    else if (catType === "leadership" && isManagementTrack) leadership.push(item);
  }

  // Technical competencies (manager rating = final)
  const { data: techRows } = await supabase
    .from("appraisal_technical_competencies")
    .select("manager_rating, self_rating, weight")
    .eq("appraisal_id", appraisalId)
    .order("display_order");

  const technical: WeightedRatingItem[] = (techRows ?? []).map(
    (t: { manager_rating?: string | null; self_rating?: string | null; weight?: number | null }) => ({
      manager_rating: t.manager_rating ?? null,
      self_rating: t.self_rating ?? null,
      weight: t.weight != null ? Number(t.weight) : 0,
    })
  );

  return {
    workplanItems,
    competencies,
    technical,
    productivity,
    leadership,
    isManagementTrack,
  };
}
