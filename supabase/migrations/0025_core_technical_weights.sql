-- Weights for Core (per-appraisal override) and Technical competencies (per row).
-- Core: appraisal_factor_ratings.weight overrides evaluation_factors.weight when set.
-- Technical: weight on each appraisal_technical_competencies row.

ALTER TABLE appraisal_factor_ratings
  ADD COLUMN IF NOT EXISTS weight NUMERIC;

ALTER TABLE appraisal_technical_competencies
  ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
