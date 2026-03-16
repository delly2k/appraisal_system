-- --------------------------------------------------
-- Fix GM user email to match Dynamics HR (dwalters@dbankjm.com).
-- Use this if 0011 was already applied with delano.walters@dbankjm.com.
-- --------------------------------------------------

update app_users
set
  email = 'dwalters@dbankjm.com',
  employee_id = (select employee_id from employees where email = 'dwalters@dbankjm.com' limit 1),
  division_id = (select division_id from employees where email = 'dwalters@dbankjm.com' limit 1),
  updated_at = now()
where email = 'delano.walters@dbankjm.com'
  and role = 'gm';
