-- --------------------------------------------------
-- ENUM TYPES
-- --------------------------------------------------

create type competency_category_type as enum (
  'core',
  'productivity',
  'leadership'
);

create type competency_applies_to as enum (
  'management',
  'non_management',
  'both'
);

-- --------------------------------------------------
-- COMPETENCY CATEGORIES
-- --------------------------------------------------

create table evaluation_categories (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  category_type competency_category_type not null,

  applies_to competency_applies_to default 'both',

  active boolean default true,

  created_by uuid references app_users(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_eval_category_type
on evaluation_categories(category_type);

-- --------------------------------------------------
-- COMPETENCY FACTORS
-- --------------------------------------------------

create table evaluation_factors (
  id uuid primary key default gen_random_uuid(),

  category_id uuid not null
    references evaluation_categories(id),

  name text not null,

  description text,

  display_order int default 0,

  active boolean default true,

  created_by uuid references app_users(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_factor_category
on evaluation_factors(category_id);

-- --------------------------------------------------
-- RATING SCALE (A-E)
-- --------------------------------------------------

create table rating_scale (
  id uuid primary key default gen_random_uuid(),

  code text unique not null,

  factor numeric not null,

  label text not null,

  description text
);

insert into rating_scale (code, factor, label) values
('A',1.0,'Highly Exceeds Expectations'),
('B',0.8,'Exceeds Expectations'),
('C',0.6,'Meets Expectations'),
('D',0.4,'Below Expectations'),
('E',0.2,'Far Below Expectations');

-- --------------------------------------------------
-- RATING BANDS
-- --------------------------------------------------

create table rating_bands (
  id uuid primary key default gen_random_uuid(),

  min_score numeric not null,

  max_score numeric,

  label text not null,

  sort_order int
);

insert into rating_bands (min_score,max_score,label,sort_order) values
(95,100,'Highly Exceeds Expectations',1),
(90,95,'Exceeds Expectations',2),
(80,90,'Meets Expectations',3),
(70,79,'Below Expectations',4),
(0,70,'Far Below Expectations',5);

-- --------------------------------------------------
-- FACTOR RATINGS
-- --------------------------------------------------

create table appraisal_factor_ratings (
  id uuid primary key default gen_random_uuid(),

  appraisal_id uuid
    references appraisals(id),

  factor_id uuid
    references evaluation_factors(id),

  self_rating_code text
    references rating_scale(code),

  manager_rating_code text
    references rating_scale(code),

  self_comments text,

  manager_comments text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(appraisal_id,factor_id)
);
