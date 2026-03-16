-- Audit log for AI generation calls.
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          TEXT NOT NULL REFERENCES employees(employee_id),
  cluster_id           UUID,
  prompt_used          TEXT,
  suggestion_generated TEXT,
  accepted_by_user     BOOLEAN DEFAULT false,
  model_used           TEXT,
  tokens_used          INTEGER,
  timestamp            TIMESTAMPTZ DEFAULT now()
);
