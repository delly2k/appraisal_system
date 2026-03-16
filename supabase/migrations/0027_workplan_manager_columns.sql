-- Manager assessment columns on workplan_items.
-- Employee values (metric_actual_raw, metric_completion_date, actual_result) are never modified after employee submits.
-- mgr_* columns are used only during MANAGER_REVIEW.

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS mgr_actual_raw       NUMERIC,
  ADD COLUMN IF NOT EXISTS mgr_completion_date  DATE,
  ADD COLUMN IF NOT EXISTS mgr_result           NUMERIC;
