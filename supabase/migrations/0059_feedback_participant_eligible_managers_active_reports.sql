-- Align feedback_cycle participant seeding with DIRECT_REPORT logic in
-- feedback_participant_generate_reviewers (0049): only managers who have at least one
-- primary reporting line to an active employee (not stale lines to inactive staff).

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
        e_mgr.department_id,
        'Pending'
      from (
        select distinct rl.manager_employee_id
        from reporting_lines rl
        inner join employees e_rep
          on e_rep.employee_id = rl.employee_id
         and e_rep.is_active = true
        where rl.is_primary = true
      ) r
      join employees e_mgr
        on e_mgr.employee_id = r.manager_employee_id
       and e_mgr.is_active = true
      on conflict (cycle_id, employee_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

comment on function feedback_cycle_activate_participants() is
  'Seeds 360 participants: distinct primary managers with at least one active direct report (matches DIRECT_REPORT reviewer join).';
