-- Section B HR Recommendations: one row per appraisal during HR Review
CREATE TABLE IF NOT EXISTS appraisal_hr_recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id     UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  recommendations  JSONB NOT NULL DEFAULT '{}',
  other_notes      TEXT,
  saved_by         UUID NOT NULL,
  saved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(appraisal_id)
);

CREATE INDEX IF NOT EXISTS idx_appraisal_hr_recommendations_appraisal ON appraisal_hr_recommendations(appraisal_id);
