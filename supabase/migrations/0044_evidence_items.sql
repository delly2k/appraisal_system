-- Evidence items for AI achievement builder (Phase 1).
-- Stores activities from appraisal, SharePoint, calendar, etc.
CREATE TABLE IF NOT EXISTS evidence_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       TEXT NOT NULL REFERENCES employees(employee_id),
  source_system     TEXT NOT NULL,
  activity_type     TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  activity_date     DATE NOT NULL,
  reference_url     TEXT,
  related_goal_id   UUID REFERENCES workplan_items(id),
  confidence_weight INTEGER NOT NULL DEFAULT 50,
  cluster_id        UUID,
  fingerprint       TEXT UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_employee_date ON evidence_items(employee_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_evidence_items_cluster ON evidence_items(cluster_id);
