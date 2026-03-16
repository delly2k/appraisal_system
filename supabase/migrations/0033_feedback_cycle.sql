-- 360 Feedback cycles: one per appraisal cycle, created automatically when appraisal cycle is created.
-- Status: Draft (default), Active, Closed. HR activates when feedback should begin.

create type feedback_cycle_status as enum (
  'Draft',
  'Active',
  'Closed'
);

create table feedback_cycle (
  id uuid primary key default gen_random_uuid(),
  cycle_name text not null,
  description text,
  linked_appraisal_cycle_id uuid not null references appraisal_cycles(id) on delete cascade,
  start_date date,
  end_date date,
  status feedback_cycle_status not null default 'Draft',
  created_at timestamptz default now(),
  created_by uuid references app_users(id)
);

create unique index idx_feedback_cycle_linked_appraisal on feedback_cycle(linked_appraisal_cycle_id);
create index idx_feedback_cycle_status on feedback_cycle(status);
create index idx_feedback_cycle_dates on feedback_cycle(start_date, end_date);

comment on table feedback_cycle is '360 feedback cycle linked to an appraisal cycle; created automatically when appraisal cycle is created.';
