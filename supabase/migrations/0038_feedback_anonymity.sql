-- Anonymity rules for 360 feedback reports:
-- - Peers and Direct Reports remain anonymous: reviewer identities never appear in reports.
-- - Only aggregated results are shown (e.g. Peer Average Score: 3.8, Direct Report Average Score: 3.6).
-- - Comments appear without names (e.g. Strengths / Development Areas with anonymous quotes).
-- - Results for a reviewer group are only shown if at least 2 responses exist (PEER and DIRECT_REPORT).

-- Anonymous aggregates: one row per (cycle, participant, reviewer_type). Use this view for reports;
-- never join to feedback_reviewer or expose reviewer_employee_id for PEER or DIRECT_REPORT.
create or replace view feedback_response_anonymous_aggregate as
select
  r.cycle_id,
  r.participant_employee_id,
  r.reviewer_type,
  count(*)::int as response_count,
  round(avg(fr.score)::numeric, 2) as average_score,
  array_remove(
    coalesce(array_agg(fr.comment) filter (where fr.comment is not null and trim(fr.comment) <> ''), array[]::text[]),
    null
  ) as comments
from feedback_response fr
join feedback_reviewer r on r.id = fr.reviewer_id
where fr.submitted_at is not null
  and fr.score is not null
group by r.cycle_id, r.participant_employee_id, r.reviewer_type
having (
  (r.reviewer_type in ('PEER', 'DIRECT_REPORT') and count(*) >= 2)
  or (r.reviewer_type = 'SELF' and count(*) >= 1)
);

comment on view feedback_response_anonymous_aggregate is 'Aggregated 360 results for reports. PEER and DIRECT_REPORT only appear when response_count >= 2. Reviewer identities are never exposed. Use for report output: Peer Average Score, Direct Report Average Score; comments without names.';

-- Optional: function to return report-safe aggregates for a participant in a cycle (same rules).
create or replace function get_360_anonymous_report(p_cycle_id uuid, p_participant_employee_id text)
returns table (
  reviewer_type feedback_reviewer_type,
  response_count bigint,
  average_score numeric,
  comments text[]
)
language sql
stable
as $$
  select
    a.reviewer_type,
    a.response_count::bigint,
    a.average_score,
    a.comments
  from feedback_response_anonymous_aggregate a
  where a.cycle_id = p_cycle_id
    and a.participant_employee_id = p_participant_employee_id;
$$;

comment on function get_360_anonymous_report(uuid, text) is 'Returns anonymous aggregates for one participant in one cycle. Use for report output; never expose reviewer_employee_id for PEER/DIRECT_REPORT. Results only when >= 2 responses for PEER/DIRECT_REPORT.';
