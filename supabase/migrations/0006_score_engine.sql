-- --------------------------------------------------
-- SECTION SCORES
-- Calculated by application layer from competency, productivity,
-- leadership (management only), and workplan performance; stored for reporting and history.
-- --------------------------------------------------

create table appraisal_section_scores (

  id uuid primary key default gen_random_uuid(),

  appraisal_id uuid
    references appraisals(id),

  competency_score numeric,

  productivity_score numeric,

  leadership_score numeric,

  workplan_score numeric,

  total_score numeric,

  final_rating text,

  calculated_at timestamptz default now(),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(appraisal_id)
);

create index idx_scores_appraisal
on appraisal_section_scores(appraisal_id);
