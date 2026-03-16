-- --------------------------------------------------
-- WORKPLANS (Form F1 equivalent)
-- One workplan per appraisal; contains multiple objectives/items.
-- Hierarchy: Corporate → Division → Individual → Task → Output → Performance Standard → Weight → Actual Result → Points
-- --------------------------------------------------

create table workplans (

  id uuid primary key default gen_random_uuid(),

  appraisal_id uuid
    references appraisals(id),

  status text default 'draft',

  approved_by_employee_id text
    references employees(employee_id),

  approved_at timestamptz,

  version int default 1,

  copied_from_workplan_id uuid,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(appraisal_id)
);

-- --------------------------------------------------
-- WORKPLAN ITEMS (objectives / tasks per workplan)
-- --------------------------------------------------

create table workplan_items (

  id uuid primary key default gen_random_uuid(),

  workplan_id uuid
    references workplans(id),

  corporate_objective text not null,

  division_objective text not null,

  individual_objective text not null,

  task text not null,

  output text not null,

  performance_standard text not null,

  weight numeric not null,

  actual_result text,

  points numeric,

  version int default 1,

  status text default 'active',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_workplan_items_workplan
on workplan_items(workplan_id);
