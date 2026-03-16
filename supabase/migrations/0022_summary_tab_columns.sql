-- Add columns for DBJ Summary tab (Section B HR Recommendations, Section C Learning & Development, HR Submission block)
-- No new tables; extend appraisal_summary_data.

ALTER TABLE appraisal_summary_data
  ADD COLUMN IF NOT EXISTS hr_recommendations JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_development JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hr_submission JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signoff_comments JSONB DEFAULT '{}';

COMMENT ON COLUMN appraisal_summary_data.hr_recommendations IS 'Section B: Pay Increment, Withhold, Eligible for Award, etc. (checkbox flags)';
COMMENT ON COLUMN appraisal_summary_data.learning_development IS 'Section C: improvement plan issued/required, skills table, career aspirations';
COMMENT ON COLUMN appraisal_summary_data.hr_submission IS 'HR submission block: action date, received by, FOR HR USE ONLY';
COMMENT ON COLUMN appraisal_summary_data.signoff_comments IS 'Section D/E/F: manager_comment, employee_comment, hod_comment (draft before sign-off)';
