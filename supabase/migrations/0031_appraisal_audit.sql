-- Audit trail: one row per action on an appraisal (who, when, what).
CREATE TABLE IF NOT EXISTS appraisal_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  actor_id    UUID,
  acted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary     TEXT NOT NULL,
  detail      JSONB
);

CREATE INDEX IF NOT EXISTS idx_appraisal_audit_appraisal_acted ON appraisal_audit(appraisal_id, acted_at DESC);

ALTER TABLE appraisal_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appraisal_audit_select ON appraisal_audit;
CREATE POLICY appraisal_audit_select ON appraisal_audit FOR SELECT
  USING (appraisal_id IN (SELECT id FROM appraisals));
DROP POLICY IF EXISTS appraisal_audit_insert ON appraisal_audit;
CREATE POLICY appraisal_audit_insert ON appraisal_audit FOR INSERT
  WITH CHECK (appraisal_id IN (SELECT id FROM appraisals));

-- Backfill from existing appraisal_timeline so the audit tab shows history.
INSERT INTO appraisal_audit (appraisal_id, action_type, actor_id, acted_at, summary)
SELECT
  t.appraisal_id,
  'status_change',
  CASE WHEN t.changed_by ~ '^[0-9a-fA-F-]{36}$' THEN t.changed_by::uuid ELSE NULL END,
  t.changed_at,
  COALESCE(NULLIF(trim(t.note), ''), t.from_status || ' → ' || t.to_status)
FROM appraisal_timeline t
WHERE NOT EXISTS (
  SELECT 1 FROM appraisal_audit a
  WHERE a.appraisal_id = t.appraisal_id AND a.acted_at = t.changed_at AND a.action_type = 'status_change'
);
