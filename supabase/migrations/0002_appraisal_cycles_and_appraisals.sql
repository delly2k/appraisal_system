-- --------------------------------------------------
-- ENUM TYPES
-- --------------------------------------------------

create type cycle_type as enum (
  'quarterly',
  'mid_year',
  'annual'
);

create type cycle_status as enum (
  'draft',
  'open',
  'closed',
  'archived'
);

create type appraisal_status as enum (
  'draft',
  'self_submitted',
  'manager_in_review',
  'manager_completed',
  'employee_acknowledged',
  'hr_in_review',
  'closed'
);

create type appraisal_purpose as enum (
  'appointment',
  'promotion',
  'transfer',
  'resignation',
  'end_of_year',
  'other'
);

-- --------------------------------------------------
-- APPRAISAL CYCLES
-- --------------------------------------------------

create table appraisal_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cycle_type cycle_type not null,
  fiscal_year text not null,
  quarter text,
  start_date date not null,
  end_date date not null,
  status cycle_status default 'draft',
  created_by uuid references app_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_cycle_year
on appraisal_cycles(fiscal_year);

-- --------------------------------------------------
-- APPRAISALS
-- --------------------------------------------------

create table appraisals (
  id uuid primary key default gen_random_uuid(),

  cycle_id uuid not null
    references appraisal_cycles(id),

  employee_id text not null
    references employees(employee_id),

  manager_employee_id text
    references employees(employee_id),

  division_id text,

  purpose appraisal_purpose default 'end_of_year',
  purpose_other text,

  date_started_in_post date,

  interim_reviews_count int default 0,

  status appraisal_status default 'draft',

  is_management boolean default false,

  submitted_at timestamptz,
  manager_completed_at timestamptz,
  employee_ack_at timestamptz,
  hr_closed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint unique_cycle_employee
  unique (cycle_id, employee_id)
);

create index idx_appraisal_employee
on appraisals(employee_id);

create index idx_appraisal_manager
on appraisals(manager_employee_id);

create index idx_appraisal_cycle
on appraisals(cycle_id);

-- --------------------------------------------------
-- AUTO SET MANAGEMENT FLAG
-- --------------------------------------------------

create or replace function set_management_flag()
returns trigger
language plpgsql
as $$
begin
  select
    case
      when employee_type = 'management'
      then true
      else false
    end
  into new.is_management
  from employees
  where employee_id = new.employee_id;

  return new;
end;
$$;

create trigger trg_set_management_flag
before insert or update
on appraisals
for each row
execute procedure set_management_flag();

-- --------------------------------------------------
-- HELPER VIEW
-- --------------------------------------------------

create view appraisal_summary as
select
  a.id,
  a.employee_id,
  e.full_name,
  a.manager_employee_id,
  a.cycle_id,
  c.name as cycle_name,
  a.status,
  a.is_management,
  a.created_at
from appraisals a
join employees e
  on e.employee_id = a.employee_id
join appraisal_cycles c
  on c.id = a.cycle_id;
