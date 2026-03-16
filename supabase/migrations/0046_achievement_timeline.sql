-- Timeline of accepted/edited achievements.
CREATE TABLE IF NOT EXISTS achievement_timeline (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      TEXT NOT NULL REFERENCES employees(employee_id),
  achievement_id   UUID REFERENCES achievement_suggestions(id),
  date_detected    DATE NOT NULL,
  summary          TEXT NOT NULL,
  source_cluster   UUID,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievement_timeline_employee_date ON achievement_timeline(employee_id, date_detected);
