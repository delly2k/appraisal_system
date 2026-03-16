-- Store AchieveIt Plan ID with each synced cycle (user-entered in UI, not from env)
ALTER TABLE operational_plan_cycles
ADD COLUMN IF NOT EXISTS achieveit_plan_id TEXT;
