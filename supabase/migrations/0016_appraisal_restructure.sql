-- --------------------------------------------------
-- APPRAISAL RESTRUCTURE
-- Adds technical competencies (ad-hoc per appraisal),
-- summary data (accomplishments, transfer, confirmation),
-- weight column for factors, and seeds standard factors.
-- --------------------------------------------------

-- --------------------------------------------------
-- 1. ADD WEIGHT COLUMN TO EVALUATION_FACTORS
-- --------------------------------------------------
ALTER TABLE evaluation_factors
  ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;

-- --------------------------------------------------
-- 2. ADD TECHNICAL_SCORE TO APPRAISAL_SECTION_SCORES
-- --------------------------------------------------
ALTER TABLE appraisal_section_scores
  ADD COLUMN IF NOT EXISTS technical_score NUMERIC;

-- --------------------------------------------------
-- 3. APPRAISAL TECHNICAL COMPETENCIES (ad-hoc per appraisal)
-- --------------------------------------------------
CREATE TABLE appraisal_technical_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required_level TEXT NOT NULL,
  self_rating TEXT,
  manager_rating TEXT,
  self_comments TEXT,
  manager_comments TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tech_comp_appraisal ON appraisal_technical_competencies(appraisal_id);

-- --------------------------------------------------
-- 4. APPRAISAL SUMMARY DATA
-- --------------------------------------------------
CREATE TABLE appraisal_summary_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id UUID NOT NULL UNIQUE REFERENCES appraisals(id) ON DELETE CASCADE,
  
  key_accomplishments TEXT,
  qualifications JSONB,
  
  transfer_requested BOOLEAN DEFAULT false,
  transfer_reason TEXT,
  
  is_probationary BOOLEAN DEFAULT false,
  confirmation_due_date DATE,
  confirmation_plan_of_action TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_summary_data_appraisal ON appraisal_summary_data(appraisal_id);

-- --------------------------------------------------
-- 5. RLS FOR NEW TABLES
-- --------------------------------------------------

-- APPRAISAL TECHNICAL COMPETENCIES
ALTER TABLE appraisal_technical_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_comp_select
ON appraisal_technical_competencies
FOR SELECT
USING (
  appraisal_id IN (SELECT id FROM appraisals)
);

CREATE POLICY tech_comp_insert_employee
ON appraisal_technical_competencies
FOR INSERT
WITH CHECK (
  appraisal_id IN (
    SELECT id FROM appraisals
    WHERE employee_id = (SELECT employee_id FROM app_users WHERE id = auth.uid())
  )
);

CREATE POLICY tech_comp_update_employee
ON appraisal_technical_competencies
FOR UPDATE
USING (
  appraisal_id IN (
    SELECT id FROM appraisals
    WHERE employee_id = (SELECT employee_id FROM app_users WHERE id = auth.uid())
  )
);

CREATE POLICY tech_comp_delete_employee
ON appraisal_technical_competencies
FOR DELETE
USING (
  appraisal_id IN (
    SELECT id FROM appraisals
    WHERE employee_id = (SELECT employee_id FROM app_users WHERE id = auth.uid())
  )
);

CREATE POLICY tech_comp_all_hr_admin
ON appraisal_technical_competencies
FOR ALL
USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('hr','admin'))
);

-- APPRAISAL SUMMARY DATA
ALTER TABLE appraisal_summary_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY summary_data_select
ON appraisal_summary_data
FOR SELECT
USING (
  appraisal_id IN (SELECT id FROM appraisals)
);

CREATE POLICY summary_data_insert_employee
ON appraisal_summary_data
FOR INSERT
WITH CHECK (
  appraisal_id IN (
    SELECT id FROM appraisals
    WHERE employee_id = (SELECT employee_id FROM app_users WHERE id = auth.uid())
  )
);

CREATE POLICY summary_data_update_employee
ON appraisal_summary_data
FOR UPDATE
USING (
  appraisal_id IN (
    SELECT id FROM appraisals
    WHERE employee_id = (SELECT employee_id FROM app_users WHERE id = auth.uid())
  )
);

CREATE POLICY summary_data_all_hr_admin
ON appraisal_summary_data
FOR ALL
USING (
  EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('hr','admin'))
);

-- --------------------------------------------------
-- 6. SEED STANDARD EVALUATION CATEGORIES AND FACTORS
-- --------------------------------------------------

-- Insert categories if they don't exist
INSERT INTO evaluation_categories (name, category_type, applies_to, active)
SELECT 'Core Competencies', 'core', 'both', true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_categories WHERE category_type = 'core');

INSERT INTO evaluation_categories (name, category_type, applies_to, active)
SELECT 'Productivity', 'productivity', 'both', true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_categories WHERE category_type = 'productivity');

INSERT INTO evaluation_categories (name, category_type, applies_to, active)
SELECT 'Leadership', 'leadership', 'management', true
WHERE NOT EXISTS (SELECT 1 FROM evaluation_categories WHERE category_type = 'leadership');

-- Seed Core Competency factors
DO $$
DECLARE
  core_cat_id UUID;
BEGIN
  SELECT id INTO core_cat_id FROM evaluation_categories WHERE category_type = 'core' LIMIT 1;
  
  IF core_cat_id IS NOT NULL THEN
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT core_cat_id, 'Professionalism', 'Demonstrates professional conduct, ethics, and integrity', 1, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = core_cat_id AND name = 'Professionalism');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT core_cat_id, 'Communication', 'Effectively communicates verbally and in writing', 2, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = core_cat_id AND name = 'Communication');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT core_cat_id, 'Interpersonal Skills', 'Works well with others and builds positive relationships', 3, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = core_cat_id AND name = 'Interpersonal Skills');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT core_cat_id, 'Initiative', 'Takes proactive action and shows self-motivation', 4, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = core_cat_id AND name = 'Initiative');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT core_cat_id, 'Teamwork and Cooperation', 'Collaborates effectively with team members', 5, 0, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = core_cat_id AND name = 'Teamwork and Cooperation');
  END IF;
END $$;

-- Seed Productivity factors with weights
DO $$
DECLARE
  prod_cat_id UUID;
BEGIN
  SELECT id INTO prod_cat_id FROM evaluation_categories WHERE category_type = 'productivity' LIMIT 1;
  
  IF prod_cat_id IS NOT NULL THEN
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT prod_cat_id, 'Planning and Organisation', 'Plans work effectively and manages resources efficiently', 1, 20, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = prod_cat_id AND name = 'Planning and Organisation');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT prod_cat_id, 'Effective Time Management', 'Manages time well and meets deadlines', 2, 10, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = prod_cat_id AND name = 'Effective Time Management');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT prod_cat_id, 'Quality of Output', 'Produces high-quality work with attention to detail', 3, 20, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = prod_cat_id AND name = 'Quality of Output');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT prod_cat_id, 'Attendance and Punctuality', 'Maintains good attendance and arrives on time', 4, 10, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = prod_cat_id AND name = 'Attendance and Punctuality');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT prod_cat_id, 'Problem Solving and Decision Making', 'Analyzes problems and makes sound decisions', 5, 10, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = prod_cat_id AND name = 'Problem Solving and Decision Making');
  END IF;
END $$;

-- Seed Leadership factors with weights (management only)
DO $$
DECLARE
  lead_cat_id UUID;
BEGIN
  SELECT id INTO lead_cat_id FROM evaluation_categories WHERE category_type = 'leadership' LIMIT 1;
  
  IF lead_cat_id IS NOT NULL THEN
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT lead_cat_id, 'Thought Leadership', 'Develops frameworks, drives innovation, introduces cost savings and revenue opportunities', 1, 35, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = lead_cat_id AND name = 'Thought Leadership');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT lead_cat_id, 'Operational Effectiveness', 'Service quality, contract management, SLAs, audit and risk management', 2, 35, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = lead_cat_id AND name = 'Operational Effectiveness');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT lead_cat_id, 'Governance and Reporting', 'Divisional reports, board reports, stakeholder reports, policy management', 3, 20, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = lead_cat_id AND name = 'Governance and Reporting');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT lead_cat_id, 'Institutional Engagement', 'Participation in internal and external company events', 4, 10, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = lead_cat_id AND name = 'Institutional Engagement');
    
    INSERT INTO evaluation_factors (category_id, name, description, display_order, weight, active)
    SELECT lead_cat_id, 'People Management', 'Team development, motivation, productivity, talent management, appraisals', 5, 35, true
    WHERE NOT EXISTS (SELECT 1 FROM evaluation_factors WHERE category_id = lead_cat_id AND name = 'People Management');
  END IF;
END $$;
