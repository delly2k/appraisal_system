-- 360 feedback responses: one row per (reviewer assignment, question). Score 1-5, optional comment.
-- Rules: reviewers submit once per participant; responses locked after submission; reviewers cannot see others' responses (enforce in API/RLS).

create table feedback_response (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references feedback_reviewer(id) on delete cascade,
  question_id uuid not null references feedback_question(id) on delete restrict,
  score int check (score >= 1 and score <= 5),
  comment text,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reviewer_id, question_id)
);

create index idx_feedback_response_reviewer on feedback_response(reviewer_id);
create index idx_feedback_response_question on feedback_response(question_id);
create index idx_feedback_response_submitted on feedback_response(submitted_at);

comment on table feedback_response is '360 question responses. One per (reviewer assignment, question). submitted_at set on submit; once set, row is locked. Application must enforce: reviewers see only their own responses.';

-- Lock responses after submission: no update of score/comment/submitted_at when submitted_at is already set.
create or replace function feedback_response_lock_after_submit()
returns trigger
language plpgsql
as $$
begin
  if old.submitted_at is not null then
    if new.score is distinct from old.score or new.comment is distinct from old.comment or (new.submitted_at is distinct from old.submitted_at) then
      raise exception 'Response is locked after submission. reviewer_id=%', old.reviewer_id;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_feedback_response_lock_after_submit
  before update on feedback_response
  for each row
  execute function feedback_response_lock_after_submit();

-- RLS: reviewers can only see and modify their own responses (where reviewer_id points to their feedback_reviewer row).
-- Application uses getCurrentUser().employee_id; when using Supabase client as reviewer, auth.uid() may not be set.
-- Policy below uses app_users.id = auth.uid() and reviewer.reviewer_employee_id = app_users.employee_id for when Supabase Auth is used.
alter table feedback_response enable row level security;

create policy feedback_response_reviewer_own
  on feedback_response for all
  using (
    exists (
      select 1 from feedback_reviewer fr
      join app_users u on u.employee_id = fr.reviewer_employee_id and u.id = auth.uid()::uuid
      where fr.id = feedback_response.reviewer_id
    )
  )
  with check (
    exists (
      select 1 from feedback_reviewer fr
      join app_users u on u.employee_id = fr.reviewer_employee_id and u.id = auth.uid()::uuid
      where fr.id = feedback_response.reviewer_id
    )
  );

comment on policy feedback_response_reviewer_own on feedback_response is 'Reviewers can only see and modify responses for their own reviewer assignment. When using service role, application must enforce visibility.';
