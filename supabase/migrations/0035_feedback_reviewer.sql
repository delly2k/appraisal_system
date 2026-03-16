-- 360 Feedback reviewer assignments: SELF, PEER, DIRECT_REPORT. Auto-generated when a participant
-- is added; HR administrators can modify assignments before the cycle begins.

create type feedback_reviewer_type as enum (
  'SELF',
  'PEER',
  'DIRECT_REPORT'
);

create type feedback_reviewer_status as enum (
  'Pending',
  'Submitted'
);

create table feedback_reviewer (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references feedback_cycle(id) on delete cascade,
  participant_employee_id text not null references employees(employee_id),
  reviewer_employee_id text not null references employees(employee_id),
  reviewer_type feedback_reviewer_type not null,
  status feedback_reviewer_status not null default 'Pending',
  created_at timestamptz default now(),
  unique (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type)
);

create index idx_feedback_reviewer_cycle on feedback_reviewer(cycle_id);
create index idx_feedback_reviewer_participant on feedback_reviewer(participant_employee_id);
create index idx_feedback_reviewer_reviewer on feedback_reviewer(reviewer_employee_id);
create index idx_feedback_reviewer_status on feedback_reviewer(status);

comment on table feedback_reviewer is 'Reviewer assignments per participant: SELF (participant), DIRECT_REPORT (all reports), PEER (up to 4 same-manager same-department). HR may modify before cycle begins.';

-- Generate reviewer assignments for a participant when they are added to feedback_participant.
create or replace function feedback_participant_generate_reviewers()
returns trigger
language plpgsql
as $$
declare
  v_manager_id text;
  v_department_id text;
begin
  -- Participant's manager and department (from employees / reporting_lines)
  select e.department_id into v_department_id
  from employees e
  where e.employee_id = new.employee_id and e.is_active = true;

  select r.manager_employee_id into v_manager_id
  from reporting_lines r
  where r.employee_id = new.employee_id and r.is_primary = true
  limit 1;

  -- SELF: participant as their own reviewer
  insert into feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  values (new.cycle_id, new.employee_id, new.employee_id, 'SELF', 'Pending')
  on conflict (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) do nothing;

  -- DIRECT_REPORT: all employees where manager_employee_id = participant
  insert into feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  select new.cycle_id, new.employee_id, r.employee_id, 'DIRECT_REPORT', 'Pending'
  from reporting_lines r
  join employees e on e.employee_id = r.employee_id and e.is_active = true
  where r.manager_employee_id = new.employee_id and r.is_primary = true
  on conflict (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) do nothing;

  -- PEER: same manager, same department, not self, not manager, not direct reports; max 4
  insert into feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  select new.cycle_id, new.employee_id, peer.employee_id, 'PEER', 'Pending'
  from (
    select distinct e.employee_id
    from reporting_lines r
    join employees e on e.employee_id = r.employee_id and e.is_active = true
    where r.manager_employee_id = v_manager_id
      and r.is_primary = true
      and v_department_id is not null and e.department_id = v_department_id
      and e.employee_id <> new.employee_id
      and (v_manager_id is null or e.employee_id <> v_manager_id)
      and not exists (
        select 1 from reporting_lines dr
        where dr.employee_id = e.employee_id and dr.manager_employee_id = new.employee_id and dr.is_primary = true
      )
    limit 4
  ) peer
  on conflict (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) do nothing;

  return new;
end;
$$;

create trigger trg_feedback_participant_generate_reviewers
  after insert on feedback_participant
  for each row
  execute function feedback_participant_generate_reviewers();
