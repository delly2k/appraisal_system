-- --------------------------------------------------
-- SIGNATURE TYPES
-- --------------------------------------------------

create type signoff_type as enum (
  'employee_acknowledgement',
  'manager_signoff',
  'reviewing_manager_signoff',
  'hr_finalization'
);

-- --------------------------------------------------
-- APPRAISAL SIGNOFFS
-- Digital approvals: employee acknowledgement, manager sign-off, reviewing manager, HR closure.
-- --------------------------------------------------

create table appraisal_signoffs (

  id uuid primary key default gen_random_uuid(),

  appraisal_id uuid
    references appraisals(id),

  signoff_role signoff_type,

  signed_by uuid
    references app_users(id),

  signature_hash text,

  signed_at timestamptz default now()
);

-- --------------------------------------------------
-- AUDIT LOG
-- --------------------------------------------------

create table audit_log (

  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references app_users(id),

  entity_type text,

  entity_id uuid,

  action text,

  previous_data jsonb,

  new_data jsonb,

  created_at timestamptz default now()
);

create index idx_audit_entity
on audit_log(entity_type, entity_id);
