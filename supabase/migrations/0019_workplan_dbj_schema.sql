-- --------------------------------------------------
-- Workplan items: DBJ spreadsheet alignment
-- Rename task→major_task, output→key_output; actual_result as numeric (Actual YTD 0-100)
-- --------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workplan_items' AND column_name = 'task'
  ) THEN
    ALTER TABLE workplan_items RENAME COLUMN task TO major_task;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workplan_items' AND column_name = 'output'
  ) THEN
    ALTER TABLE workplan_items RENAME COLUMN output TO key_output;
  END IF;
END $$;

-- actual_result: convert TEXT to NUMERIC (Actual YTD 0-100). Non-numeric or empty -> NULL.
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'workplan_items' AND column_name = 'actual_result';
  IF v_type = 'text' THEN
    ALTER TABLE workplan_items ADD COLUMN IF NOT EXISTS actual_result_ytd numeric;
    UPDATE workplan_items
      SET actual_result_ytd = CASE
        WHEN actual_result IS NULL OR trim(actual_result) = '' THEN NULL
        WHEN trim(actual_result) ~ '^[0-9]+\.?[0-9]*$' THEN least(100, greatest(0, trim(actual_result)::numeric))
        ELSE NULL
      END;
    ALTER TABLE workplan_items DROP COLUMN actual_result;
    ALTER TABLE workplan_items RENAME COLUMN actual_result_ytd TO actual_result;
  END IF;
END $$;

-- Ensure major_task and key_output allow empty (for new rows)
ALTER TABLE workplan_items ALTER COLUMN major_task DROP NOT NULL;
ALTER TABLE workplan_items ALTER COLUMN key_output DROP NOT NULL;
ALTER TABLE workplan_items ALTER COLUMN corporate_objective DROP NOT NULL;
ALTER TABLE workplan_items ALTER COLUMN division_objective DROP NOT NULL;
ALTER TABLE workplan_items ALTER COLUMN individual_objective DROP NOT NULL;
ALTER TABLE workplan_items ALTER COLUMN performance_standard DROP NOT NULL;
