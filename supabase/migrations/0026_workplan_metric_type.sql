-- Metric type support for workplan items: NUMBER (actual/target), DATE (deadline vs completion), PERCENT (direct).
-- actual_result remains the computed 0-100 value used for points.

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS metric_type TEXT DEFAULT 'PERCENT'
    CHECK (metric_type IN ('NUMBER', 'DATE', 'PERCENT'));

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS metric_target NUMERIC;

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS metric_deadline DATE;

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS metric_actual_raw NUMERIC;

ALTER TABLE workplan_items
  ADD COLUMN IF NOT EXISTS metric_completion_date DATE;
