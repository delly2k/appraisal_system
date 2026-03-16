-- AI-generated achievement suggestions.
CREATE TABLE IF NOT EXISTS achievement_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       TEXT NOT NULL REFERENCES employees(employee_id),
  cluster_id        UUID NOT NULL,
  achievement_text  TEXT NOT NULL,
  confidence_level  TEXT NOT NULL,
  evidence_summary  JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'pending',
  edited_text       TEXT,
  appraisal_id      UUID REFERENCES appraisals(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
