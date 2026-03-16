-- Link workplan items to operational plan objectives (optional FKs).
-- Keeps corporate_objective / division_objective text for backward compatibility and display.
alter table workplan_items
  add column if not exists corporate_objective_id uuid references corporate_objectives(id) on delete set null,
  add column if not exists divisional_objective_id uuid references department_objectives(id) on delete set null;

create index if not exists idx_workplan_items_corporate_objective
  on workplan_items(corporate_objective_id);
create index if not exists idx_workplan_items_divisional_objective
  on workplan_items(divisional_objective_id);
