-- Replace A-E rating scale with 1-10 numeric scale
-- The code column changes from letter to number string

-- 1. Delete existing A-E rows
DELETE FROM rating_scale;

-- 2. Insert 1-10 scale
INSERT INTO rating_scale (id, code, factor, label, description) VALUES
  (gen_random_uuid(), '1',  0.1, 'Far below expectations',       'Performance significantly below required standard'),
  (gen_random_uuid(), '2',  0.2, 'Far below expectations',       'Performance well below required standard'),
  (gen_random_uuid(), '3',  0.3, 'Below expectations',           'Performance below required standard'),
  (gen_random_uuid(), '4',  0.4, 'Below expectations',           'Performance approaching but below standard'),
  (gen_random_uuid(), '5',  0.5, 'Approaching expectations',     'Performance approaching the required standard'),
  (gen_random_uuid(), '6',  0.6, 'Meets expectations',           'Performance meets the required standard'),
  (gen_random_uuid(), '7',  0.7, 'Meets expectations well',      'Performance consistently meets the required standard'),
  (gen_random_uuid(), '8',  0.8, 'Exceeds expectations',         'Performance exceeds the required standard'),
  (gen_random_uuid(), '9',  0.9, 'Highly exceeds expectations',  'Performance significantly exceeds the required standard'),
  (gen_random_uuid(), '10', 1.0, 'Exceptional performance',      'Outstanding performance, far exceeds all expectations');

-- 3. Map technical competencies required_level from A-E to 1-10 (before clearing factor ratings)
UPDATE appraisal_technical_competencies
SET required_level = CASE required_level
  WHEN 'A' THEN '10' WHEN 'B' THEN '8' WHEN 'C' THEN '6' WHEN 'D' THEN '4' WHEN 'E' THEN '2'
  ELSE required_level END
WHERE required_level IN ('A','B','C','D','E');

-- 4. Clear any existing factor ratings (they used A-E codes, now invalid)
DELETE FROM appraisal_factor_ratings
  WHERE self_rating_code IN ('A','B','C','D','E')
     OR manager_rating_code IN ('A','B','C','D','E');

-- 5. Add check constraint to enforce 1-10 codes only
ALTER TABLE appraisal_factor_ratings
  DROP CONSTRAINT IF EXISTS appraisal_factor_ratings_self_rating_code_check;

ALTER TABLE appraisal_factor_ratings
  ADD CONSTRAINT appraisal_factor_ratings_self_rating_code_check
  CHECK (self_rating_code IN ('1','2','3','4','5','6','7','8','9','10') OR self_rating_code IS NULL);

ALTER TABLE appraisal_factor_ratings
  DROP CONSTRAINT IF EXISTS appraisal_factor_ratings_manager_rating_code_check;

ALTER TABLE appraisal_factor_ratings
  ADD CONSTRAINT appraisal_factor_ratings_manager_rating_code_check
  CHECK (manager_rating_code IN ('1','2','3','4','5','6','7','8','9','10') OR manager_rating_code IS NULL);

COMMENT ON TABLE rating_scale IS
  '1-10 numeric rating scale. Factor is the multiplier (1=0.1, 10=1.0). Applied to competency weight to calculate score.';
