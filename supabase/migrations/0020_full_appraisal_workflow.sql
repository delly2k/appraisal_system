-- --------------------------------------------------
-- FULL APPRAISAL WORKFLOW (9-phase DBJ process)
-- New status values, appraisal_approvals, appraisal_signoffs, appraisal_timeline.
-- --------------------------------------------------

-- 1. New tables

CREATE TABLE IF NOT EXISTS appraisal_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  approved_by   UUID NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER')),
  approved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment       TEXT,
  UNIQUE(appraisal_id, role)
);

CREATE INDEX IF NOT EXISTS idx_appraisal_approvals_appraisal ON appraisal_approvals(appraisal_id);

CREATE TABLE IF NOT EXISTS appraisal_signoffs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  signed_by     UUID NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HOD', 'HR')),
  stage         TEXT NOT NULL CHECK (stage IN ('PENDING_SIGNOFF', 'HOD_REVIEW', 'HR_REVIEW')),
  signed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment       TEXT,
  UNIQUE(appraisal_id, role, stage)
);

CREATE INDEX IF NOT EXISTS idx_appraisal_signoffs_appraisal ON appraisal_signoffs(appraisal_id);

CREATE TABLE IF NOT EXISTS appraisal_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id  UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  changed_by    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT
);

CREATE INDEX IF NOT EXISTS idx_appraisal_timeline_appraisal ON appraisal_timeline(appraisal_id);

-- 2. Manager and HOD for approval/signoff are derived from HRMIS (Dataverse) at runtime;
--    they are not stored on appraisals for authorization (manager_employee_id may remain for display/cache).

-- 3. Migrate status from enum to text with CHECK
-- Drop dependents so we can alter status column.
DROP TRIGGER IF EXISTS trg_set_initial_appraisal_status ON appraisals;
DROP VIEW IF EXISTS appraisal_summary CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appraisals' AND column_name = 'status'
  ) AND (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appraisals' AND column_name = 'status'
  ) != 'text' THEN
    ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS status_phase TEXT;

    UPDATE appraisals SET status_phase = CASE status::text
      WHEN 'draft' THEN 'DRAFT'
      WHEN 'workplan_draft' THEN 'DRAFT'
      WHEN 'workplan_submitted' THEN 'PENDING_APPROVAL'
      WHEN 'workplan_approved' THEN 'SELF_ASSESSMENT'
      WHEN 'self_assessment' THEN 'SELF_ASSESSMENT'
      WHEN 'self_submitted' THEN 'SUBMITTED'
      WHEN 'manager_in_review' THEN 'MANAGER_REVIEW'
      WHEN 'manager_review' THEN 'MANAGER_REVIEW'
      WHEN 'manager_completed' THEN 'PENDING_SIGNOFF'
      WHEN 'employee_acknowledged' THEN 'HOD_REVIEW'
      WHEN 'hr_in_review' THEN 'HR_REVIEW'
      WHEN 'closed' THEN 'COMPLETE'
      ELSE 'DRAFT'
    END;

    ALTER TABLE appraisals ALTER COLUMN status_phase SET DEFAULT 'DRAFT';
    ALTER TABLE appraisals DROP COLUMN status;
    ALTER TABLE appraisals RENAME COLUMN status_phase TO status;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appraisals' AND column_name = 'status'
  ) THEN
    ALTER TABLE appraisals ADD COLUMN status TEXT DEFAULT 'DRAFT';
  END IF;
END $$;

ALTER TABLE appraisals DROP CONSTRAINT IF EXISTS appraisals_status_check;
ALTER TABLE appraisals ADD CONSTRAINT appraisals_status_check CHECK (status IN (
  'DRAFT', 'PENDING_APPROVAL', 'SELF_ASSESSMENT', 'SUBMITTED',
  'MANAGER_REVIEW', 'PENDING_SIGNOFF', 'HOD_REVIEW', 'HR_REVIEW', 'COMPLETE'
));
ALTER TABLE appraisals ALTER COLUMN status SET DEFAULT 'DRAFT';

-- 4. Trigger for new appraisals
DROP TRIGGER IF EXISTS trg_set_initial_appraisal_status ON appraisals;
CREATE OR REPLACE FUNCTION set_initial_appraisal_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT NULL AND trim(NEW.status) != '' THEN RETURN NEW; END IF;
  NEW.status := 'DRAFT';
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_initial_appraisal_status
BEFORE INSERT ON appraisals FOR EACH ROW
EXECUTE PROCEDURE set_initial_appraisal_status();

-- Recreate appraisal_summary view (dropped above so status column could be migrated)
CREATE VIEW appraisal_summary AS
SELECT
  a.id,
  a.employee_id,
  e.full_name,
  a.manager_employee_id,
  a.cycle_id,
  c.name AS cycle_name,
  a.review_type,
  a.status,
  a.is_management,
  a.created_at
FROM appraisals a
JOIN employees e ON e.employee_id = a.employee_id
JOIN appraisal_cycles c ON c.id = a.cycle_id;

-- 5. RLS
ALTER TABLE appraisal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appraisal_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appraisal_approvals_select ON appraisal_approvals;
CREATE POLICY appraisal_approvals_select ON appraisal_approvals FOR SELECT
  USING (appraisal_id IN (SELECT id FROM appraisals));
DROP POLICY IF EXISTS appraisal_approvals_insert ON appraisal_approvals;
CREATE POLICY appraisal_approvals_insert ON appraisal_approvals FOR INSERT
  WITH CHECK (appraisal_id IN (SELECT id FROM appraisals));

DROP POLICY IF EXISTS appraisal_signoffs_select ON appraisal_signoffs;
CREATE POLICY appraisal_signoffs_select ON appraisal_signoffs FOR SELECT
  USING (appraisal_id IN (SELECT id FROM appraisals));
DROP POLICY IF EXISTS appraisal_signoffs_insert ON appraisal_signoffs;
CREATE POLICY appraisal_signoffs_insert ON appraisal_signoffs FOR INSERT
  WITH CHECK (appraisal_id IN (SELECT id FROM appraisals));

DROP POLICY IF EXISTS appraisal_timeline_select ON appraisal_timeline;
CREATE POLICY appraisal_timeline_select ON appraisal_timeline FOR SELECT
  USING (appraisal_id IN (SELECT id FROM appraisals));
DROP POLICY IF EXISTS appraisal_timeline_insert ON appraisal_timeline;
CREATE POLICY appraisal_timeline_insert ON appraisal_timeline FOR INSERT
  WITH CHECK (appraisal_id IN (SELECT id FROM appraisals));

COMMENT ON COLUMN appraisals.status IS '9-phase: DRAFT, PENDING_APPROVAL, SELF_ASSESSMENT, SUBMITTED, MANAGER_REVIEW, PENDING_SIGNOFF, HOD_REVIEW, HR_REVIEW, COMPLETE';
