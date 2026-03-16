import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * HR Recommendation Engine.
 * Generates system recommendations from appraisal_section_scores.final_rating
 * using recommendation_rules. Does not set or change manager override; that is handled elsewhere.
 */

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

export interface GenerateRecommendationResult {
  appraisalId: string;
  recommendation: string | null;
  status: "generated" | "no_rule" | "no_score";
}

/**
 * Generate system recommendation for an appraisal from its final rating.
 * Idempotent: upserts appraisal_recommendations; only system_recommendation is set/updated.
 * Manager override fields are not modified by this service.
 */
export async function generateRecommendation(
  appraisalId: string
): Promise<GenerateRecommendationResult> {
  const supabase = getSupabaseAdmin();

  const { data: scoreRow, error: scoreError } = await supabase
    .from("appraisal_section_scores")
    .select("total_score, final_rating")
    .eq("appraisal_id", appraisalId)
    .single();

  if (scoreError || !scoreRow) {
    return {
      appraisalId,
      recommendation: null,
      status: "no_score",
    };
  }

  const finalRating = scoreRow.final_rating;
  if (!finalRating) {
    return {
      appraisalId,
      recommendation: null,
      status: "no_score",
    };
  }

  const { data: rule, error: ruleError } = await supabase
    .from("recommendation_rules")
    .select("recommendation")
    .eq("rating_label", finalRating)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (ruleError || !rule) {
    return {
      appraisalId,
      recommendation: null,
      status: "no_rule",
    };
  }

  const systemRecommendation = rule.recommendation;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("appraisal_recommendations")
    .select("appraisal_id")
    .eq("appraisal_id", appraisalId)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("appraisal_recommendations")
      .update({
        system_recommendation: systemRecommendation,
        updated_at: now,
      })
      .eq("appraisal_id", appraisalId);

    if (updateError) {
      throw new Error(`Failed to update recommendation: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from("appraisal_recommendations")
      .insert({
        appraisal_id: appraisalId,
        system_recommendation: systemRecommendation,
        manager_override: false,
      });

    if (insertError) {
      throw new Error(`Failed to save recommendation: ${insertError.message}`);
    }
  }

  return {
    appraisalId,
    recommendation: systemRecommendation,
    status: "generated",
  };
}
