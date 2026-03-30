-- Key development profiles and snapshots by employees.employee_id (text), not app_users(id).
-- Aligns with session user.employee_id and avoids requiring app_users rows for every employee.

-- ---------------------------------------------------------------------------
-- development_profile_snapshots
-- ---------------------------------------------------------------------------
alter table development_profile_snapshots
  drop constraint if exists development_profile_snapshots_employee_id_fkey;

alter table development_profile_snapshots
  add column employee_id_new text;

update development_profile_snapshots s
set employee_id_new = u.employee_id
from app_users u
where s.employee_id::text = u.id::text;

update development_profile_snapshots s
set employee_id_new = a.employee_id
from appraisals a
where s.appraisal_id = a.id
  and s.employee_id_new is null;

delete from development_profile_snapshots where employee_id_new is null;

alter table development_profile_snapshots drop column employee_id;
alter table development_profile_snapshots rename column employee_id_new to employee_id;
alter table development_profile_snapshots alter column employee_id set not null;

alter table development_profile_snapshots
  add constraint development_profile_snapshots_employee_id_fkey
  foreign key (employee_id) references employees(employee_id);

-- ---------------------------------------------------------------------------
-- employee_development_profiles
-- ---------------------------------------------------------------------------
alter table employee_development_profiles
  drop constraint if exists employee_development_profiles_employee_id_fkey;

alter table employee_development_profiles
  drop constraint if exists employee_development_profiles_employee_id_key;

alter table employee_development_profiles
  add column employee_id_new text;

update employee_development_profiles p
set employee_id_new = u.employee_id
from app_users u
where p.employee_id::text = u.id::text;

delete from employee_development_profiles where employee_id_new is null;

alter table employee_development_profiles drop column employee_id;
alter table employee_development_profiles rename column employee_id_new to employee_id;
alter table employee_development_profiles alter column employee_id set not null;

alter table employee_development_profiles
  add constraint employee_development_profiles_employee_id_key unique (employee_id);

alter table employee_development_profiles
  add constraint employee_development_profiles_employee_id_fkey
  foreign key (employee_id) references employees(employee_id);

-- Replace old btree index (uuid) with same name on text key
drop index if exists idx_employee_development_profiles_employee;
create index if not exists idx_employee_development_profiles_employee
  on employee_development_profiles(employee_id);
