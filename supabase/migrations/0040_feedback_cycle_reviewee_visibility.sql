-- Reviewee visibility: HR can control whether peer and direct report feedback
-- are visible to the person being reviewed in their 360 report.

alter table feedback_cycle
  add column if not exists peer_feedback_visible_to_reviewee boolean not null default true,
  add column if not exists direct_report_feedback_visible_to_reviewee boolean not null default true;

comment on column feedback_cycle.peer_feedback_visible_to_reviewee is 'When true, the participant (reviewee) can see peer aggregate scores and comments in their 360 report.';
comment on column feedback_cycle.direct_report_feedback_visible_to_reviewee is 'When true, the participant (reviewee) can see direct report aggregate scores and comments in their 360 report.';
