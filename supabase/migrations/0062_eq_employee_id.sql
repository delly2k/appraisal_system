-- EQ: key by employees.employee_id (text) so regular staff without app_users rows can save results/drafts.

drop table if exists eq_drafts cascade;
drop table if exists eq_results cascade;

create table eq_results (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  sa_total smallint not null check (sa_total between 10 and 50),
  me_total smallint not null check (me_total between 10 and 50),
  mo_total smallint not null check (mo_total between 10 and 50),
  e_total smallint not null check (e_total between 10 and 50),
  ss_total smallint not null check (ss_total between 10 and 50),
  total_score smallint generated always as (sa_total + me_total + mo_total + e_total + ss_total) stored,
  responses jsonb not null,
  taken_at timestamptz not null default now()
);

create table eq_drafts (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  responses jsonb not null default '{}',
  last_page smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id)
);

create index idx_eq_results_emp on eq_results (employee_id, taken_at desc);
create index idx_eq_draft_emp on eq_drafts (employee_id);

alter table eq_results enable row level security;
alter table eq_drafts enable row level security;

-- Match session email from JWT to employees.email (Supabase Auth / future client access). API routes use service role.
create policy eq_results_own on eq_results for all
using (
  employee_id in (
    select e.employee_id
    from employees e
    where e.is_active = true
      and e.email is not null
      and lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
)
with check (
  employee_id in (
    select e.employee_id
    from employees e
    where e.is_active = true
      and e.email is not null
      and lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);

create policy eq_drafts_own on eq_drafts for all
using (
  employee_id in (
    select e.employee_id
    from employees e
    where e.is_active = true
      and e.email is not null
      and lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
)
with check (
  employee_id in (
    select e.employee_id
    from employees e
    where e.is_active = true
      and e.email is not null
      and lower(trim(e.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);
