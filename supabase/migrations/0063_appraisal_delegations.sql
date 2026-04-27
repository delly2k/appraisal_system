create table if not exists appraisal_delegations (
  id uuid primary key default gen_random_uuid(),
  appraisal_id uuid not null references appraisals(id) on delete cascade,
  delegated_by uuid not null,
  delegated_to uuid not null,
  delegated_to_name text not null,
  created_at timestamptz default now(),
  unique(appraisal_id)
);

create index if not exists idx_appraisal_delegations_appraisal_id
  on appraisal_delegations(appraisal_id);
create index if not exists idx_appraisal_delegations_delegated_to
  on appraisal_delegations(delegated_to);

alter table appraisal_delegations enable row level security;

drop policy if exists appraisal_delegations_manager_select on appraisal_delegations;
create policy appraisal_delegations_manager_select
on appraisal_delegations
for select
using (
  exists (
    select 1
    from appraisals a
    where a.id = appraisal_delegations.appraisal_id
      and a.manager_employee_id = (
        select employee_id
        from app_users
        where id = auth.uid()
      )
  )
);

drop policy if exists appraisal_delegations_manager_insert on appraisal_delegations;
create policy appraisal_delegations_manager_insert
on appraisal_delegations
for insert
with check (
  exists (
    select 1
    from appraisals a
    where a.id = appraisal_delegations.appraisal_id
      and a.manager_employee_id = (
        select employee_id
        from app_users
        where id = auth.uid()
      )
  )
);

drop policy if exists appraisal_delegations_manager_update on appraisal_delegations;
create policy appraisal_delegations_manager_update
on appraisal_delegations
for update
using (
  exists (
    select 1
    from appraisals a
    where a.id = appraisal_delegations.appraisal_id
      and a.manager_employee_id = (
        select employee_id
        from app_users
        where id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from appraisals a
    where a.id = appraisal_delegations.appraisal_id
      and a.manager_employee_id = (
        select employee_id
        from app_users
        where id = auth.uid()
      )
  )
);

drop policy if exists appraisal_delegations_manager_delete on appraisal_delegations;
create policy appraisal_delegations_manager_delete
on appraisal_delegations
for delete
using (
  exists (
    select 1
    from appraisals a
    where a.id = appraisal_delegations.appraisal_id
      and a.manager_employee_id = (
        select employee_id
        from app_users
        where id = auth.uid()
      )
  )
);

drop policy if exists appraisal_delegations_delegate_read on appraisal_delegations;
create policy appraisal_delegations_delegate_read
on appraisal_delegations
for select
using (
  delegated_to::text = (
    select employee_id
    from app_users
    where id = auth.uid()
  )
);
