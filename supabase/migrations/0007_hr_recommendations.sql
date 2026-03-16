-- --------------------------------------------------
-- RECOMMENDATION RULES
-- Configurable rules mapping rating labels to HR recommendations
-- (e.g. pay increment, incentive eligibility, promotion, remedial training, probation).
-- --------------------------------------------------

create table recommendation_rules (

  id uuid primary key default gen_random_uuid(),

  rating_label text not null,

  recommendation text not null,

  description text,

  active boolean default true,

  created_at timestamptz default now()
);

-- --------------------------------------------------
-- APPRAISAL RECOMMENDATIONS
-- System-generated recommendation; manager may override with justification; HR confirms final decision.
-- --------------------------------------------------

create table appraisal_recommendations (

  id uuid primary key default gen_random_uuid(),

  appraisal_id uuid
    references appraisals(id),

  system_recommendation text,

  manager_override boolean default false,

  manager_recommendation text,

  manager_justification text,

  hr_final_decision text,

  hr_decided_by uuid
    references app_users(id),

  hr_decided_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(appraisal_id)
);
