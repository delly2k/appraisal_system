-- --------------------------------------------------
-- Store each employee's division/department head (system user id).
-- The reporting page uses the logged-in user's employee row to show "your division head".
-- Populated when we resolve or sync that employee's data from HR.
-- --------------------------------------------------

alter table employees
add column if not exists department_head_system_user_id text;

comment on column employees.department_head_system_user_id is 'System user id of the division/department head for this employee; used on reporting page from the logged-in user''s row.';
