-- --------------------------------------------------
-- is_active: annual stays inactive until mid_year completes
-- When cycle opens: mid_year = active, annual = inactive.
-- When mid_year appraisal completes: unlock annual (is_active = true).
-- --------------------------------------------------

ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Backfill: annual rows with a sibling mid_year that is not yet COMPLETE should be inactive
UPDATE appraisals a
SET is_active = false
WHERE a.review_type = 'annual'
  AND EXISTS (
    SELECT 1 FROM appraisals m
    WHERE m.cycle_id = a.cycle_id
      AND m.employee_id = a.employee_id
      AND m.review_type = 'mid_year'
      AND m.status IS DISTINCT FROM 'COMPLETE'
  );

-- Where mid_year is COMPLETE, annual should be active
UPDATE appraisals a
SET is_active = true
WHERE a.review_type = 'annual'
  AND EXISTS (
    SELECT 1 FROM appraisals m
    WHERE m.cycle_id = a.cycle_id
      AND m.employee_id = a.employee_id
      AND m.review_type = 'mid_year'
      AND m.status = 'COMPLETE'
  );

COMMENT ON COLUMN appraisals.is_active IS 'False for annual when mid_year exists and is not COMPLETE; unlocks to true when mid_year completes.';
