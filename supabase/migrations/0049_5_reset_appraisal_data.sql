-- --------------------------------------------------
-- RESET APPRAISAL DATA (run before 0050_annual_only_appraisal)
-- Removes all appraisal-related data so 0050 runs on empty tables.
-- --------------------------------------------------

-- Workplan children (reference workplans)
TRUNCATE workplan_items CASCADE;
TRUNCATE workplan_change_requests CASCADE;

-- Workplans (reference appraisals)
TRUNCATE workplans CASCADE;

-- Appraisal children (reference appraisals)
TRUNCATE appraisal_approvals CASCADE;
TRUNCATE appraisal_signoffs CASCADE;
TRUNCATE appraisal_timeline CASCADE;
TRUNCATE appraisal_audit CASCADE;
TRUNCATE appraisal_technical_competencies CASCADE;
TRUNCATE appraisal_summary_data CASCADE;
TRUNCATE appraisal_hr_recommendations CASCADE;
TRUNCATE appraisal_section_scores CASCADE;
TRUNCATE appraisal_recommendations CASCADE;
TRUNCATE appraisal_factor_ratings CASCADE;

-- Tables that reference appraisals (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'achievement_suggestions') THEN
    TRUNCATE achievement_suggestions CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'development_profile_snapshots') THEN
    TRUNCATE development_profile_snapshots CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_development_profiles') THEN
    TRUNCATE employee_development_profiles CASCADE;
  END IF;
END $$;

-- Appraisals
TRUNCATE appraisals CASCADE;

-- Feedback cycles reference appraisal_cycles; truncate feedback_cycle and its children first
TRUNCATE feedback_cycle CASCADE;

-- Cycle review types (reference appraisal_cycles)
TRUNCATE cycle_review_types CASCADE;

-- Appraisal cycles
TRUNCATE appraisal_cycles CASCADE;
