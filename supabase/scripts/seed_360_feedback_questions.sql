-- 360 feedback seed script aligned to current schema.
-- feedback_question columns: reviewer_type, competency_group, question_text, sort_order
-- feedback_rating_scale columns: value, label, sort_order

-- Optional: add PEER reviewer assignment type if your environment still lacks it
ALTER TYPE feedback_reviewer_type ADD VALUE IF NOT EXISTS 'PEER';

-- Seed rating scale if empty
INSERT INTO feedback_rating_scale (value, label, sort_order)
VALUES
  (1, 'Strongly Disagree', 1),
  (2, 'Disagree', 2),
  (3, 'Neutral', 3),
  (4, 'Agree', 4),
  (5, 'Strongly Agree', 5)
ON CONFLICT (value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

-- Replace question bank for all reviewer types (global, not per cycle)
DELETE FROM feedback_question
WHERE reviewer_type IN ('SELF', 'MANAGER', 'PEER', 'DIRECT_REPORT');

INSERT INTO feedback_question (reviewer_type, competency_group, question_text, sort_order)
VALUES
  -- SELF
  ('SELF', 'Communication', 'I communicate expectations clearly to others.', 1),
  ('SELF', 'Communication', 'I actively listen to feedback and different viewpoints.', 2),
  ('SELF', 'Communication', 'I keep stakeholders informed on progress and issues.', 3),
  ('SELF', 'Leadership', 'I provide clear direction when leading tasks or initiatives.', 4),
  ('SELF', 'Leadership', 'I take responsibility for outcomes, both successes and failures.', 5),
  ('SELF', 'Leadership', 'I make decisions in a timely and effective manner.', 6),
  ('SELF', 'Collaboration', 'I work effectively with colleagues across teams.', 7),
  ('SELF', 'Collaboration', 'I contribute positively to team discussions and outcomes.', 8),
  ('SELF', 'Collaboration', 'I resolve conflicts constructively.', 9),
  ('SELF', 'Communication', 'I actively seek opportunities to improve my skills.', 10),
  ('SELF', 'Communication', 'I am open to feedback and act on it.', 11),

  -- MANAGER
  ('MANAGER', 'Communication', 'This employee communicates expectations clearly.', 1),
  ('MANAGER', 'Communication', 'This employee keeps stakeholders informed on progress and risks.', 2),
  ('MANAGER', 'Communication', 'This employee communicates effectively under pressure.', 3),
  ('MANAGER', 'Leadership', 'This employee provides clear direction to their team.', 4),
  ('MANAGER', 'Leadership', 'This employee supports the development of team members.', 5),
  ('MANAGER', 'Leadership', 'This employee demonstrates sound decision-making.', 6),
  ('MANAGER', 'Collaboration', 'This employee consistently delivers on agreed objectives.', 7),
  ('MANAGER', 'Collaboration', 'This employee takes ownership of outcomes.', 8),
  ('MANAGER', 'Collaboration', 'This employee manages priorities effectively.', 9),
  ('MANAGER', 'Collaboration', 'This employee works effectively across teams and departments.', 10),
  ('MANAGER', 'Collaboration', 'This employee builds strong working relationships.', 11),

  -- PEER
  ('PEER', 'Communication', 'This employee communicates clearly and effectively.', 1),
  ('PEER', 'Communication', 'This employee listens to others'' ideas and feedback.', 2),
  ('PEER', 'Collaboration', 'This employee works well with others in a team environment.', 3),
  ('PEER', 'Collaboration', 'This employee is cooperative and supportive of colleagues.', 4),
  ('PEER', 'Collaboration', 'This employee contributes positively to team outcomes.', 5),
  ('PEER', 'Leadership', 'This employee follows through on commitments.', 6),
  ('PEER', 'Leadership', 'This employee can be relied upon to complete assigned tasks.', 7),
  ('PEER', 'Collaboration', 'This employee treats others with respect.', 8),
  ('PEER', 'Collaboration', 'This employee handles disagreements professionally.', 9),

  -- DIRECT_REPORT
  ('DIRECT_REPORT', 'Communication', 'My manager communicates expectations clearly.', 1),
  ('DIRECT_REPORT', 'Communication', 'My manager keeps me informed about important matters.', 2),
  ('DIRECT_REPORT', 'Leadership', 'My manager provides clear direction and guidance.', 3),
  ('DIRECT_REPORT', 'Leadership', 'My manager makes decisions effectively.', 4),
  ('DIRECT_REPORT', 'Leadership', 'My manager supports my professional development.', 5),
  ('DIRECT_REPORT', 'Leadership', 'My manager provides useful feedback on my performance.', 6),
  ('DIRECT_REPORT', 'Collaboration', 'My manager promotes teamwork and collaboration.', 7),
  ('DIRECT_REPORT', 'Collaboration', 'My manager creates a positive work environment.', 8),
  ('DIRECT_REPORT', 'Collaboration', 'My manager treats team members fairly.', 9),
  ('DIRECT_REPORT', 'Collaboration', 'I feel comfortable raising concerns with my manager.', 10);
