-- Snapshot columns for work plan: employee's self-assessed Actual YTD and points,
-- preserved when manager updates actual_result/points during MANAGER_REVIEW.
ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS employee_actual_result numeric,
  ADD COLUMN IF NOT EXISTS employee_points numeric;

COMMENT ON COLUMN workplan_items.employee_actual_result IS 'Employee self-assessed Actual YTD (0-100), set when self-assessment is submitted.';
COMMENT ON COLUMN workplan_items.employee_points IS 'Employee self-assessed points, set when self-assessment is submitted.';
