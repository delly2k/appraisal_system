-- Provide user_roles view expected by operational_plan RLS (app_users has id, role).
create or replace view user_roles as
  select id as user_id, role from app_users;
