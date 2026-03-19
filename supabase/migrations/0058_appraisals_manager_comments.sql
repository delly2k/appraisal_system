-- Add manager_comments to appraisals for sign-off and PDF (used by signoff/submit and appraisal-pdf).
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS manager_comments TEXT;
