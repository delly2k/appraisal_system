-- Allow insert/update on appraisal_factor_ratings for any user who can see the appraisal
-- (employee, manager, gm, hr, admin). SELECT already allowed via factor_ratings_select;
-- hr/admin retain full access via factor_ratings_all_hr_admin.

create policy factor_ratings_insert
on appraisal_factor_ratings
for insert
with check (
  appraisal_id in (select id from appraisals)
);

create policy factor_ratings_update
on appraisal_factor_ratings
for update
using (
  appraisal_id in (select id from appraisals)
);
