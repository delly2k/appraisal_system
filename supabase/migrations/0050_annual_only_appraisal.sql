-- --------------------------------------------------
-- ANNUAL ONLY APPRAISAL
-- Remove mid_year as a valid appraisal type.
-- One ANNUAL appraisal per employee per cycle.
-- Mid-year progress tracking is handled by check_ins (separate feature).
-- --------------------------------------------------

ALTER TABLE appraisals DROP CONSTRAINT IF EXISTS unique_cycle_employee_review_type;

-- Data migration: set all appraisals to annual (fixes existing mid_year/quarterly rows)
UPDATE appraisals SET review_type = 'annual' WHERE review_type IS DISTINCT FROM 'annual';

-- Deduplicate: keep one row per (cycle_id, employee_id), prefer row with latest updated_at
DELETE FROM appraisals a
USING appraisals b
WHERE a.cycle_id = b.cycle_id
  AND a.employee_id = b.employee_id
  AND a.id < b.id;

ALTER TABLE appraisals
  ADD CONSTRAINT appraisals_review_type_annual_only
  CHECK (review_type = 'annual');

COMMENT ON COLUMN appraisals.review_type IS
  'Always annual. Mid-year tracking is handled by check_ins.';

ALTER TABLE appraisals DROP CONSTRAINT IF EXISTS appraisals_status_check;
ALTER TABLE appraisals ADD CONSTRAINT appraisals_status_check CHECK (status IN (
  'DRAFT', 'PENDING_APPROVAL', 'SELF_ASSESSMENT', 'SUBMITTED',
  'MANAGER_REVIEW', 'PENDING_SIGNOFF', 'HOD_REVIEW', 'HR_REVIEW', 'COMPLETE', 'CANCELLED'
));

DROP INDEX IF EXISTS idx_appraisals_one_per_employee_per_cycle;
CREATE UNIQUE INDEX idx_appraisals_one_per_employee_per_cycle
  ON appraisals (employee_id, cycle_id)
  WHERE status != 'CANCELLED';

ALTER TABLE appraisal_cycles DROP CONSTRAINT IF EXISTS appraisal_cycles_cycle_type_check;
ALTER TABLE appraisal_cycles
  ADD CONSTRAINT appraisal_cycles_cycle_type_annual_only
  CHECK (cycle_type = 'annual');

DELETE FROM cycle_review_types WHERE review_type != 'annual';

ALTER TABLE cycle_review_types DROP CONSTRAINT IF EXISTS cycle_review_types_review_type_check;
ALTER TABLE cycle_review_types
  ADD CONSTRAINT cycle_review_types_review_type_annual_only
  CHECK (review_type = 'annual');
