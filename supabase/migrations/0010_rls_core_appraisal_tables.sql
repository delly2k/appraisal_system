-- --------------------------------------------------
-- ROW LEVEL SECURITY: Core appraisal tables
-- Individual: view own appraisals, edit own self assessments
-- Manager: view appraisals of direct reports
-- GM: view appraisals for their division
-- HR/Admin: full access
-- --------------------------------------------------

-- APPRAISALS
alter table appraisals enable row level security;

create policy employee_view_own_appraisals
on appraisals
for select
using (
  employee_id = (
    select employee_id
    from app_users
    where id = auth.uid()
  )
);

create policy manager_view_team
on appraisals
for select
using (
  manager_employee_id = (
    select employee_id
    from app_users
    where id = auth.uid()
  )
);

create policy gm_view_division
on appraisals
for select
using (
  division_id = (
    select division_id
    from app_users
    where id = auth.uid()
    and role = 'gm'
  )
);

create policy hr_admin_full_access
on appraisals
for all
using (
  exists (
    select 1
    from app_users
    where id = auth.uid()
    and role in ('hr','admin')
  )
);

-- Child tables: visibility follows appraisals (appraisal_id in visible appraisals)
-- SELECT delegated to appraisals RLS; write restricted to hr/admin for now (app can add employee/manager write policies later).

-- APPRAISAL FACTOR RATINGS
alter table appraisal_factor_ratings enable row level security;

create policy factor_ratings_select
on appraisal_factor_ratings
for select
using (
  appraisal_id in (select id from appraisals)
);

create policy factor_ratings_all_hr_admin
on appraisal_factor_ratings
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- APPRAISAL SECTION SCORES
alter table appraisal_section_scores enable row level security;

create policy section_scores_select
on appraisal_section_scores
for select
using (
  appraisal_id in (select id from appraisals)
);

create policy section_scores_all_hr_admin
on appraisal_section_scores
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- APPRAISAL RECOMMENDATIONS
alter table appraisal_recommendations enable row level security;

create policy recommendations_select
on appraisal_recommendations
for select
using (
  appraisal_id in (select id from appraisals)
);

create policy recommendations_all_hr_admin
on appraisal_recommendations
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- APPRAISAL SIGNOFFS
alter table appraisal_signoffs enable row level security;

create policy signoffs_select
on appraisal_signoffs
for select
using (
  appraisal_id in (select id from appraisals)
);

create policy signoffs_all_hr_admin
on appraisal_signoffs
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- WORKPLANS (1:1 with appraisal)
alter table workplans enable row level security;

create policy workplans_select
on workplans
for select
using (
  appraisal_id in (select id from appraisals)
);

create policy workplans_all_hr_admin
on workplans
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- WORKPLAN ITEMS (via workplan -> appraisal)
alter table workplan_items enable row level security;

create policy workplan_items_select
on workplan_items
for select
using (
  workplan_id in (select id from workplans)
);

create policy workplan_items_all_hr_admin
on workplan_items
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- WORKPLAN CHANGE REQUESTS
alter table workplan_change_requests enable row level security;

create policy change_requests_select
on workplan_change_requests
for select
using (
  workplan_id in (select id from workplans)
);

create policy change_requests_all_hr_admin
on workplan_change_requests
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- WORKPLAN ITEM CHANGE PROPOSALS
alter table workplan_item_change_proposals enable row level security;

create policy item_change_proposals_select
on workplan_item_change_proposals
for select
using (
  change_request_id in (select id from workplan_change_requests)
);

create policy item_change_proposals_all_hr_admin
on workplan_item_change_proposals
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

-- APPRAISAL CYCLES (read: anyone who can see an appraisal in that cycle; write: hr/admin)
alter table appraisal_cycles enable row level security;

create policy cycles_select
on appraisal_cycles
for select
using (
  exists (select 1 from appraisals a where a.cycle_id = appraisal_cycles.id)
  or exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);

create policy cycles_all_hr_admin
on appraisal_cycles
for all
using (
  exists (select 1 from app_users where id = auth.uid() and role in ('hr','admin'))
);
