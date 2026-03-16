-- Ensure comment column exists on appraisal_signoffs (idempotent for envs that already have it from 0020)
ALTER TABLE appraisal_signoffs ADD COLUMN IF NOT EXISTS comment TEXT;
