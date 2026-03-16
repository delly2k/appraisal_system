-- Operational Plan cycles (one per financial year)
create table if not exists operational_plan_cycles (
  id            uuid primary key default gen_random_uuid(),
  cycle_year    varchar(20)   not null,
  label         varchar(255)  not null,
  is_active     boolean       not null default false,
  uploaded_by   uuid          references auth.users(id) on delete set null,
  uploaded_at   timestamptz   not null default now(),
  total_corp    integer,
  total_dept    integer,
  created_at    timestamptz   not null default now()
);

create unique index if not exists uq_one_active_cycle
  on operational_plan_cycles (is_active)
  where is_active = true;

create table if not exists corporate_objectives (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid         not null references operational_plan_cycles(id) on delete cascade,
  achieveit_id    varchar(255),
  order_ref       varchar(30)  not null,
  perspective     varchar(255),
  name            varchar(500) not null,
  description     text,
  status          varchar(50),
  created_at      timestamptz  not null default now()
);

create index if not exists idx_corp_obj_cycle on corporate_objectives(cycle_id);
create index if not exists idx_corp_obj_order on corporate_objectives(cycle_id, order_ref);

create table if not exists department_objectives (
  id                     uuid primary key default gen_random_uuid(),
  cycle_id               uuid         not null references operational_plan_cycles(id) on delete cascade,
  corporate_objective_id uuid         references corporate_objectives(id) on delete set null,
  achieveit_id           varchar(255),
  order_ref              varchar(30)  not null,
  name                   varchar(500) not null,
  description            text,
  status                 varchar(50),
  division               varchar(255),
  assigned_to            varchar(255),
  created_at             timestamptz  not null default now()
);

create index if not exists idx_dept_obj_cycle on department_objectives(cycle_id);
create index if not exists idx_dept_obj_corp  on department_objectives(corporate_objective_id);
create index if not exists idx_dept_obj_div   on department_objectives(division);

alter table operational_plan_cycles  enable row level security;
alter table corporate_objectives     enable row level security;
alter table department_objectives    enable row level security;

create policy "staff read cycles"
  on operational_plan_cycles for select to authenticated using (true);

create policy "staff read corporate objectives"
  on corporate_objectives for select to authenticated using (true);

create policy "staff read department objectives"
  on department_objectives for select to authenticated using (true);

create policy "hr manage cycles"
  on operational_plan_cycles for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  );

create policy "hr manage corporate objectives"
  on corporate_objectives for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  );

create policy "hr manage department objectives"
  on department_objectives for all to authenticated
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  )
  with check (
    exists (select 1 from user_roles where user_id = auth.uid() and role in ('hr','admin','super_admin'))
  );
