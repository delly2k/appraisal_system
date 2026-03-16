-- 360 Questionnaire: rating scale and questions by reviewer type (Manager, Direct Report, Peer, Self).
-- Questions are customizable in the database; each uses 1-5 scale and allows optional comment on response.

-- Question audience: who is answering (Manager top-down, Direct Report bottom-up, Peer horizontal, Self).
create type feedback_question_reviewer_type as enum (
  'MANAGER',
  'DIRECT_REPORT',
  'PEER',
  'SELF'
);

-- Competency groups for grouping questions.
create type feedback_competency_group as enum (
  'Communication',
  'Leadership',
  'Collaboration'
);

-- Global 5-point scale for 360 questions (customizable labels).
create table feedback_rating_scale (
  id uuid primary key default gen_random_uuid(),
  value int not null unique check (value >= 1 and value <= 5),
  label text not null,
  sort_order int not null default 0
);

-- Questions by reviewer type and competency; sort_order orders within (type, competency).
create table feedback_question (
  id uuid primary key default gen_random_uuid(),
  reviewer_type feedback_question_reviewer_type not null,
  competency_group feedback_competency_group not null,
  question_text text not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index idx_feedback_question_reviewer_type on feedback_question(reviewer_type);
create index idx_feedback_question_competency on feedback_question(competency_group);
create index idx_feedback_question_sort on feedback_question(reviewer_type, competency_group, sort_order);

comment on table feedback_rating_scale is '5-point scale for 360: 1=Strongly Disagree .. 5=Strongly Agree.';
comment on table feedback_question is '360 questionnaire questions by reviewer type (Manager, Direct Report, Peer, Self) and competency. Responses store rating + optional comment.';

-- Seed rating scale
insert into feedback_rating_scale (value, label, sort_order) values
  (1, 'Strongly Disagree', 1),
  (2, 'Disagree', 2),
  (3, 'Neutral', 3),
  (4, 'Agree', 4),
  (5, 'Strongly Agree', 5);

-- 1. Manager (Top-Down) – Performance, accountability, alignment
insert into feedback_question (reviewer_type, competency_group, question_text, sort_order) values
  ('MANAGER', 'Communication', 'Does this employee provide you with timely and accurate updates on project status?', 1),
  ('MANAGER', 'Communication', 'How effectively does this employee communicate high-level strategy to their team?', 2),
  ('MANAGER', 'Communication', 'Does this employee represent the department professionally when speaking to upper management?', 3),
  ('MANAGER', 'Leadership', 'Does this employee take full responsibility for their team''s deliverables and mistakes?', 1),
  ('MANAGER', 'Leadership', 'How well does this employee align their team''s daily work with the company''s broader mission?', 2),
  ('MANAGER', 'Leadership', 'Does this employee show the potential to take on more significant leadership responsibilities?', 3),
  ('MANAGER', 'Collaboration', 'Does this employee prioritize organizational goals over their own department''s interests?', 1),
  ('MANAGER', 'Collaboration', 'How effectively does this employee navigate and resolve cross-departmental friction?', 2),
  ('MANAGER', 'Collaboration', 'Does this employee seek your input before making high-impact decisions?', 3);

-- 2. Direct Reports (Bottom-Up) – Guidance, support, psychological safety
insert into feedback_question (reviewer_type, competency_group, question_text, sort_order) values
  ('DIRECT_REPORT', 'Communication', 'Does your manager provide clear, actionable instructions for your tasks?', 1),
  ('DIRECT_REPORT', 'Communication', 'Do you feel your manager listens to and validates your ideas or concerns?', 2),
  ('DIRECT_REPORT', 'Communication', 'How well does your manager keep you informed about changes that affect your work?', 3),
  ('DIRECT_REPORT', 'Leadership', 'Does your manager provide the support and resources you need to succeed?', 1),
  ('DIRECT_REPORT', 'Leadership', 'Does this person provide constructive feedback that helps you improve your skills?', 2),
  ('DIRECT_REPORT', 'Leadership', 'Does your manager lead by example and maintain professionalism under pressure?', 3),
  ('DIRECT_REPORT', 'Collaboration', 'Does your manager encourage a team environment where everyone feels included?', 1),
  ('DIRECT_REPORT', 'Collaboration', 'How effectively does your manager handle conflicts within the team?', 2),
  ('DIRECT_REPORT', 'Collaboration', 'Does your manager advocate for the team when resources or recognition are needed?', 3);

-- 3. Peers (Horizontal) – Reliability, teamwork, influence without authority
insert into feedback_question (reviewer_type, competency_group, question_text, sort_order) values
  ('PEER', 'Communication', 'Does this person proactively share information that is helpful for your own team''s success?', 1),
  ('PEER', 'Communication', 'How effectively does this person communicate their needs and deadlines to you?', 2),
  ('PEER', 'Communication', 'Is this person''s communication style respectful and easy to understand?', 3),
  ('PEER', 'Leadership', 'Does this person take initiative to solve problems that affect multiple teams?', 1),
  ('PEER', 'Leadership', 'How well does this person influence others to reach a consensus on shared projects?', 2),
  ('PEER', 'Leadership', 'Do you trust this person to follow through on the commitments they make to you?', 3),
  ('PEER', 'Collaboration', 'Does this person work as a "partner" rather than just a "service provider"?', 1),
  ('PEER', 'Collaboration', 'How constructively does this person handle disagreements or differing opinions?', 2),
  ('PEER', 'Collaboration', 'Is this person willing to offer help or expertise when they see a colleague is struggling?', 3);

-- 4. Self-Assessment – Reflection, intentionality, perceived impact
insert into feedback_question (reviewer_type, competency_group, question_text, sort_order) values
  ('SELF', 'Communication', 'How clearly do I communicate my expectations and deadlines to those I work with?', 1),
  ('SELF', 'Communication', 'Do I make a conscious effort to listen to others'' perspectives before sharing my own?', 2),
  ('SELF', 'Communication', 'Am I proactive in keeping my manager and stakeholders updated on my progress and challenges?', 3),
  ('SELF', 'Communication', 'How would I rate my ability to remain professional and calm during difficult conversations?', 4),
  ('SELF', 'Leadership', 'Do I provide my team with a clear sense of direction and purpose?', 1),
  ('SELF', 'Leadership', 'How much time do I realistically dedicate to mentoring or supporting the professional growth of others?', 2),
  ('SELF', 'Leadership', 'Do I take full accountability for the outcomes of my projects, including the failures?', 3),
  ('SELF', 'Leadership', 'How effectively do I delegate tasks versus trying to handle everything myself?', 4),
  ('SELF', 'Collaboration', 'Do I actively seek out the opinions of colleagues from other departments to improve my work?', 1),
  ('SELF', 'Collaboration', 'How do I typically respond when a teammate''s idea or approach conflicts with my own?', 2),
  ('SELF', 'Collaboration', 'Am I reliable in meeting the commitments and deadlines I set with my peers?', 3);
