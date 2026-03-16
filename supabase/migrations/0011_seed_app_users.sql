-- --------------------------------------------------
-- SEED APP USERS: GM (dwalters@dbankjm.com) and Admin
-- Run Dynamics sync first so employees has dwalters@dbankjm.com (HR/Dataverse email);
-- then this migration sets employee_id/division_id for the GM from employees.
-- If employees is empty, GM is still inserted with null employee_id/division_id;
-- run sync then: UPDATE app_users SET employee_id = (SELECT employee_id FROM employees WHERE email = 'dwalters@dbankjm.com'), division_id = (SELECT division_id FROM employees WHERE email = 'dwalters@dbankjm.com') WHERE email = 'dwalters@dbankjm.com';
-- --------------------------------------------------

-- GM: Delano Walters (general manager). employee_id/division_id from employees if present.
-- Email must match Dynamics HR (internalemailaddress), e.g. dwalters@dbankjm.com.
insert into app_users (aad_object_id, email, display_name, role, employee_id, division_id)
values (
  'a1b2c3d4-e5f6-4789-a012-000000000001',
  'dwalters@dbankjm.com',
  'Delano Walters',
  'gm',
  (select employee_id from employees where email = 'dwalters@dbankjm.com' limit 1),
  (select division_id from employees where email = 'dwalters@dbankjm.com' limit 1)
)
on conflict (email) do update set
  display_name = excluded.display_name,
  role = excluded.role,
  employee_id = coalesce(excluded.employee_id, app_users.employee_id),
  division_id = coalesce(excluded.division_id, app_users.division_id),
  updated_at = now();

-- Admin user (full access). No employee link required.
insert into app_users (aad_object_id, email, display_name, role)
values (
  'a1b2c3d4-e5f6-4789-a012-000000000002',
  'admin@dbankjm.com',
  'Administrator',
  'admin'
)
on conflict (email) do update set
  display_name = excluded.display_name,
  role = excluded.role,
  updated_at = now();
