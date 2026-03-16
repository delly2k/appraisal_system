-- --------------------------------------------------
-- DEVELOPMENT PROFILES
-- One per employee; spans multiple years, not tied to appraisal cycle.
-- --------------------------------------------------

create table development_profiles (

  id uuid primary key default gen_random_uuid(),

  employee_id text
    references employees(employee_id),

  development_summary text,

  manager_comments text,

  last_reviewed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(employee_id)
);

-- --------------------------------------------------
-- SKILLS TO DEVELOP
-- --------------------------------------------------

create table development_skills (

  id uuid primary key default gen_random_uuid(),

  profile_id uuid
    references development_profiles(id),

  skill_name text,

  development_action text,

  target_completion_date date,

  status text default 'planned',

  created_at timestamptz default now()
);

-- --------------------------------------------------
-- CAREER ASPIRATIONS
-- --------------------------------------------------

create table career_aspirations (

  id uuid primary key default gen_random_uuid(),

  profile_id uuid
    references development_profiles(id),

  desired_future_role text,

  secondment_interest boolean default false,

  relocation_interest boolean default false,

  career_comments text,

  created_at timestamptz default now()
);
