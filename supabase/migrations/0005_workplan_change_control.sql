-- --------------------------------------------------
-- CHANGE REQUEST STATUS ENUM
-- --------------------------------------------------

create type change_request_status as enum (
  'draft',
  'submitted',
  'manager_review',
  'approved',
  'rejected'
);

-- --------------------------------------------------
-- WORKPLAN CHANGE REQUESTS
-- --------------------------------------------------

create table workplan_change_requests (

  id uuid primary key default gen_random_uuid(),

  workplan_id uuid not null
    references workplans(id),

  requested_by_user uuid
    references app_users(id),

  reason text not null,

  status change_request_status default 'draft',

  manager_approval_user uuid
    references app_users(id),

  manager_approval_at timestamptz,

  hr_approval_user uuid
    references app_users(id),

  hr_approval_at timestamptz,

  rejection_reason text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_change_request_workplan
on workplan_change_requests(workplan_id);

-- --------------------------------------------------
-- PROPOSED ITEM CHANGES
-- --------------------------------------------------

create table workplan_item_change_proposals (

  id uuid primary key default gen_random_uuid(),

  change_request_id uuid
    references workplan_change_requests(id),

  original_workplan_item_id uuid
    references workplan_items(id),

  proposed_task text,

  proposed_output text,

  proposed_standard text,

  proposed_weight numeric,

  proposed_objective text,

  change_type text,

  created_at timestamptz default now()
);
