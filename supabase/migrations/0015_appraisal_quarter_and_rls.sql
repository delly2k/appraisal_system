-- --------------------------------------------------
-- Optional quarter (1-4) on appraisals for quarterly check-ins Q1-Q4.
-- Unique: (cycle_id, employee_id, review_type, coalesce(quarter, 0)).
-- RLS for appraisals and workplans is defined in 0010_rls_core_appraisal_tables.sql:
--   Employee: SELECT own rows (employee_id via app_users where id = auth.uid()).
--   Manager: SELECT rows where manager_employee_id = current user's employee_id.
--   Division (GM): SELECT rows where division_id = current user's division_id.
--   HR/Admin: Full access.
-- --------------------------------------------------

alter table appraisals
  add column if not exists quarter smallint check (quarter is null or (quarter >= 1 and quarter <= 4));

comment on column appraisals.quarter is 'Quarter 1-4 for quarterly review_type; null for mid_year/annual.';

-- Drop existing unique so we can add expression-based unique for quarter
alter table appraisals
  drop constraint if exists unique_cycle_employee_review_type;

create unique index unique_cycle_employee_review_quarter
  on appraisals (cycle_id, employee_id, review_type, coalesce(quarter, 0));
