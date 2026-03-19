-- --------------------------------------------------
-- Check-in events: one per appraisal, manager-initiated or system-triggered
-- Progress tracking linked to annual appraisals (mid-year, quarterly, ad-hoc).
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS check_ins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id          UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  check_in_type         TEXT NOT NULL CHECK (check_in_type IN ('MIDYEAR','QUARTERLY','ADHOC')),
  initiated_by          UUID REFERENCES employees(id),
  due_date              DATE,
  status                TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN','EMPLOYEE_SUBMITTED','MANAGER_REVIEWED','COMPLETE','CANCELLED')),
  employee_submitted_at TIMESTAMPTZ,
  manager_reviewed_at   TIMESTAMPTZ,
  manager_overall_notes TEXT,
  note_to_employee      TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Per-objective response within a check-in
CREATE TABLE IF NOT EXISTS check_in_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id           UUID NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
  workplan_item_id      UUID NOT NULL REFERENCES workplan_items(id) ON DELETE CASCADE,

  -- Employee fills in
  employee_status       TEXT CHECK (employee_status IN ('ON_TRACK','AT_RISK','BEHIND','COMPLETE')),
  progress_pct          INTEGER CHECK (progress_pct BETWEEN 0 AND 100),
  employee_comment      TEXT,
  employee_updated_at   TIMESTAMPTZ,

  -- Manager fills in (after employee submits)
  mgr_status_override   TEXT CHECK (mgr_status_override IN ('ON_TRACK','AT_RISK','BEHIND','COMPLETE')),
  mgr_comment           TEXT,
  mgr_acknowledged_at   TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE (check_in_id, workplan_item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_appraisal_id ON check_ins(appraisal_id);
CREATE INDEX IF NOT EXISTS idx_check_in_responses_check_in_id ON check_in_responses(check_in_id);

-- RLS: employees can see check-ins for their own appraisal
-- Managers can see check-ins for appraisals they manage
-- HR can see all
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_responses ENABLE ROW LEVEL SECURITY;

-- Permissive policy for now (tighten later)
CREATE POLICY "check_ins_access" ON check_ins FOR ALL USING (true);
CREATE POLICY "check_in_responses_access" ON check_in_responses FOR ALL USING (true);

COMMENT ON TABLE check_ins IS
  'Progress tracking check-ins linked to annual appraisals. Not scored — used for mid-year and quarterly progress conversations.';
