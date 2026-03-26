create table if not exists employee_sync_log (
  id uuid primary key default gen_random_uuid(),
  triggered_by text not null default 'cron',
  triggered_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  employees_synced integer,
  employees_added integer,
  employees_deactivated integer,
  new_employee_ids text[],
  error_message text,
  duration_ms integer
);

create index if not exists idx_sync_log_triggered on employee_sync_log (triggered_at desc);
