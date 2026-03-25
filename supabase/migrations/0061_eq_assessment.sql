create table if not exists eq_questions (
  id smallint primary key check (id between 1 and 50),
  text text not null,
  competency text not null check (competency in ('SA', 'ME', 'MO', 'E', 'SS')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists eq_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  sa_total smallint not null check (sa_total between 10 and 50),
  me_total smallint not null check (me_total between 10 and 50),
  mo_total smallint not null check (mo_total between 10 and 50),
  e_total smallint not null check (e_total between 10 and 50),
  ss_total smallint not null check (ss_total between 10 and 50),
  total_score smallint generated always as (sa_total + me_total + mo_total + e_total + ss_total) stored,
  responses jsonb not null,
  taken_at timestamptz not null default now()
);

create index if not exists idx_eq_user on eq_results(user_id, taken_at desc);
create index if not exists idx_eq_questions_active on eq_questions(is_active, id);

alter table eq_results enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'eq_results'
      and policyname = 'eq_own'
  ) then
    create policy eq_own on eq_results for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end
$$;

create table if not exists eq_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  responses jsonb not null default '{}',
  last_page smallint not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table eq_drafts enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'eq_drafts'
      and policyname = 'eq_draft_own'
  ) then
    create policy eq_draft_own on eq_drafts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end
$$;

insert into eq_questions (id, text, competency) values
(1, 'I realise immediately when I lose my temper', 'SA'),
(2, 'I can reframe bad situations quickly', 'ME'),
(3, 'I am able to always motivate myself to do difficult tasks', 'MO'),
(4, 'I am always able to see things from the other person''s viewpoint', 'E'),
(5, 'I am an excellent listener', 'SS'),
(6, 'I know when I am happy', 'SA'),
(7, 'I do not wear my heart on my sleeve', 'ME'),
(8, 'I am usually able to prioritise important activities at work and get on with them', 'MO'),
(9, 'I am excellent at empathising with someone else''s problem', 'E'),
(10, 'I never interrupt other people''s conversations', 'SS'),
(11, 'I usually recognise when I am stressed', 'SA'),
(12, 'Others can rarely tell what kind of mood I am in', 'ME'),
(13, 'I always meet deadlines', 'MO'),
(14, 'I can tell if someone is not happy with me', 'E'),
(15, 'I am good at adapting and mixing with a variety of people', 'SS'),
(16, 'When I am being emotional I am aware of this', 'SA'),
(17, 'I rarely fly off the handle at other people', 'ME'),
(18, 'I never waste time', 'MO'),
(19, 'I can tell if a team of people are not getting along with each other', 'E'),
(20, 'People are the most interesting thing in life for me', 'SS'),
(21, 'When I feel anxious I usually can account for the reason', 'SA'),
(22, 'Difficult people do not annoy me', 'ME'),
(23, 'I do not prevaricate', 'MO'),
(24, 'I can usually understand why people are being difficult towards me', 'E'),
(25, 'I love to meet new people and get to know what makes them tick', 'SS'),
(26, 'I always know when I''m being unreasonable', 'SA'),
(27, 'I can consciously alter my frame of mind or mood', 'ME'),
(28, 'I believe you should do the difficult things first', 'MO'),
(29, 'Other individuals are not difficult, just different', 'E'),
(30, 'I need a variety of work colleagues to make my job interesting', 'SS'),
(31, 'Awareness of my own emotions is very important to me at all times', 'SA'),
(32, 'I do not let stressful situations affect me once I have left work', 'ME'),
(33, 'Delayed gratification is a virtue that I hold to', 'MO'),
(34, 'I can understand if I am being unreasonable', 'E'),
(35, 'I like to ask questions to find out what is important to people', 'SS'),
(36, 'I can tell if someone has upset or annoyed me', 'SA'),
(37, 'I rarely worry about work or life in general', 'ME'),
(38, 'I believe in action this day', 'MO'),
(39, 'I can understand why my actions sometimes offend others', 'E'),
(40, 'I see working with difficult people as a challenge to win them over', 'SS'),
(41, 'I can let anger go quickly so that it no longer affects me', 'SA'),
(42, 'I can suppress my emotions when I need to', 'ME'),
(43, 'I can always motivate myself even when I feel low', 'MO'),
(44, 'I can sometimes see things from others'' point of view', 'E'),
(45, 'I am good at reconciling differences with other people', 'SS'),
(46, 'I know what makes me happy', 'SA'),
(47, 'Others often do not know how I am feeling about things', 'ME'),
(48, 'Motivation has been the key to my success', 'MO'),
(49, 'Reasons for disagreements are always clear to me', 'E'),
(50, 'I generally build solid relationships with those I work with', 'SS')
on conflict (id) do update set
  text = excluded.text,
  competency = excluded.competency,
  is_active = true;
