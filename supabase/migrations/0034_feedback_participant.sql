-- 360 Feedback participants: employees who supervise other staff (eligible when at least one
-- employee has manager_employee_id = participant.employee_id). Populated from reporting_lines when
-- the feedback cycle becomes Active.

create table feedback_participant (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references feedback_cycle(id) on delete cascade,
  employee_id text not null references employees(employee_id),
  department_id text,
  status text not null default 'Pending',
  created_at timestamptz default now(),
  unique (cycle_id, employee_id)
);

create index idx_feedback_participant_cycle on feedback_participant(cycle_id);
create index idx_feedback_participant_employee on feedback_participant(employee_id);
create index idx_feedback_participant_status on feedback_participant(status);

comment on table feedback_participant is 'Eligible 360 participants per cycle: employees who supervise at least one staff (manager_employee_id in reporting_lines). Generated when cycle status becomes Active.';

-- Generate participants when a feedback cycle is activated (status set to 'Active').
-- Eligibility: at least one row in reporting_lines where manager_employee_id = employee_id.
create or replace function feedback_cycle_activate_participants()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Active' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.status is null or old.status <> 'Active')) then
      insert into feedback_participant (cycle_id, employee_id, department_id, status)
      select
        new.id,
        r.manager_employee_id,
        e.department_id,
        'Pending'
      from (
        select distinct manager_employee_id
        from reporting_lines
        where is_primary = true
      ) r
      join employees e on e.employee_id = r.manager_employee_id and e.is_active = true
      on conflict (cycle_id, employee_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_feedback_cycle_activate_participants
  after insert or update of status on feedback_cycle
  for each row
  execute function feedback_cycle_activate_participants();
