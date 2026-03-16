-- Fix schema cache error: ensure appraisal_signoffs has role, stage (and comment).
-- When table was created by 0009 it has signoff_role only; 0020's CREATE TABLE IF NOT EXISTS was skipped.
-- Add new columns and backfill from signoff_role so existing code (role/stage) works.

ALTER TABLE appraisal_signoffs ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE appraisal_signoffs ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE appraisal_signoffs ADD COLUMN IF NOT EXISTS comment TEXT;

-- Ensure signoff_role exists (0009 has it; 0020-created table does not) so API can write both for SummarySection
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appraisal_signoffs' AND column_name = 'signoff_role'
  ) THEN
    ALTER TABLE appraisal_signoffs ADD COLUMN signoff_role TEXT;
  END IF;
END $$;

-- Backfill role and stage from legacy signoff_role when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appraisal_signoffs' AND column_name = 'signoff_role'
  ) THEN
    UPDATE appraisal_signoffs
    SET
      role = CASE signoff_role::text
        WHEN 'employee_acknowledgement' THEN 'EMPLOYEE'
        WHEN 'manager_signoff' THEN 'MANAGER'
        WHEN 'reviewing_manager_signoff' THEN 'HOD'
        WHEN 'hr_finalization' THEN 'HR'
        ELSE role
      END,
      stage = COALESCE(stage, 'PENDING_SIGNOFF')
    WHERE role IS NULL AND signoff_role IS NOT NULL;
  END IF;
END $$;
