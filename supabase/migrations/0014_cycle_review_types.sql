-- --------------------------------------------------
-- One cycle, multiple review types (quarterly and/or mid_year and/or annual)
-- - cycle_review_types: which review types are conducted within a cycle
-- - appraisals.review_type: each appraisal is for one review type within the cycle
-- --------------------------------------------------

-- Table: which review types are conducted within each cycle
create table cycle_review_types (
  cycle_id uuid not null references appraisal_cycles(id) on delete cascade,
  review_type cycle_type not null,
  primary key (cycle_id, review_type)
);

create index idx_cycle_review_types_cycle on cycle_review_types(cycle_id);

-- Add review_type to appraisals (one appraisal per employee per cycle per review type)
alter table appraisals
  add column review_type cycle_type not null default 'annual';

-- Backfill existing appraisals from their cycle's cycle_type
update appraisals a
set review_type = c.cycle_type
from appraisal_cycles c
where c.id = a.cycle_id;

alter table appraisals
  alter column review_type drop default;

-- Replace unique constraint: one appraisal per (cycle, employee, review_type)
alter table appraisals
  drop constraint if exists unique_cycle_employee;

alter table appraisals
  add constraint unique_cycle_employee_review_type
  unique (cycle_id, employee_id, review_type);

-- Backfill cycle_review_types: each existing cycle gets one row (its current cycle_type)
insert into cycle_review_types (cycle_id, review_type)
select id, cycle_type from appraisal_cycles
on conflict (cycle_id, review_type) do nothing;

-- Recreate appraisal_summary view to include review_type
drop view if exists appraisal_summary;

create view appraisal_summary as
select
  a.id,
  a.employee_id,
  e.full_name,
  a.manager_employee_id,
  a.cycle_id,
  c.name as cycle_name,
  a.review_type,
  a.status,
  a.is_management,
  a.created_at
from appraisals a
join employees e on e.employee_id = a.employee_id
join appraisal_cycles c on c.id = a.cycle_id;

-- RLS: cycle_review_types (read/write for hr/admin only)
alter table cycle_review_types enable row level security;

create policy cycle_review_types_select
on cycle_review_types for select
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

create policy cycle_review_types_all_hr_admin
on cycle_review_types for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);
