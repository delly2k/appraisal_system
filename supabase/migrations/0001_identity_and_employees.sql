-- Enable required extensions
create extension if not exists "pgcrypto";

-- --------------------------------------------------
-- ENUM TYPES
-- --------------------------------------------------

create type user_role as enum (
  'admin',
  'hr',
  'gm',
  'manager',
  'individual'
);

create type employee_type as enum (
  'management',
  'non_management'
);

-- --------------------------------------------------
-- APP USERS
-- --------------------------------------------------

create table app_users (
  id uuid primary key default gen_random_uuid(),
  aad_object_id text unique not null,
  email text unique not null,
  display_name text,
  role user_role not null,
  employee_id text,
  division_id text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- --------------------------------------------------
-- EMPLOYEES (synced from Dynamics)
-- --------------------------------------------------

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  aad_object_id text unique,
  email text unique,
  full_name text,
  job_title text,
  grade text,
  division_id text,
  division_name text,
  department_id text,
  department_name text,
  employee_type employee_type default 'non_management',
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- --------------------------------------------------
-- REPORTING LINES
-- --------------------------------------------------

create table reporting_lines (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  manager_employee_id text not null,
  is_primary boolean default true,
  effective_from date,
  effective_to date,
  last_synced_at timestamptz,
  created_at timestamptz default now(),

  constraint fk_employee
    foreign key (employee_id)
    references employees(employee_id),

  constraint fk_manager
    foreign key (manager_employee_id)
    references employees(employee_id)
);

create index idx_reporting_employee
on reporting_lines(employee_id);

create index idx_reporting_manager
on reporting_lines(manager_employee_id);

-- --------------------------------------------------
-- USER SIGNATURES
-- --------------------------------------------------

create table user_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id),
  signature_type text,
  signature_value text,
  signature_hash text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
