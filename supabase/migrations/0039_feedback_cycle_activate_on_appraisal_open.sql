-- When an appraisal cycle is opened (status = 'open'), activate the linked 360 feedback cycle
-- so participants and reviewers are generated. One-time backfill: set 360 to Active for any
-- appraisal cycle that is already open.

-- Backfill: activate 360 cycles whose linked appraisal cycle is already open
update feedback_cycle fc
set status = 'Active'
from appraisal_cycles ac
where fc.linked_appraisal_cycle_id = ac.id
  and ac.status = 'open'
  and fc.status = 'Draft';

-- When appraisal_cycles.status becomes 'open', set linked feedback_cycle to Active
create or replace function appraisal_cycle_activate_360()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'open' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.status is null or old.status <> 'open')) then
      update feedback_cycle
      set status = 'Active'
      where linked_appraisal_cycle_id = new.id
        and status = 'Draft';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_appraisal_cycle_activate_360
  after insert or update of status on appraisal_cycles
  for each row
  execute function appraisal_cycle_activate_360();

comment on function appraisal_cycle_activate_360() is 'When an appraisal cycle is opened (status=open), set linked feedback_cycle to Active so 360 participants and reviewers are generated.';
