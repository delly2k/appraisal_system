-- 360: Add MANAGER reviewer type and audit trail (bank/public body compliance).
-- Requirements: MANAGER = 1 per participant; audit log for assignment created/removed, review submitted/updated/removed.

-- 1) Add MANAGER to feedback_reviewer_type enum
ALTER TYPE feedback_reviewer_type ADD VALUE 'MANAGER';

-- 2) Audit log for 360 events (append-only, immutable)
CREATE TABLE IF NOT EXISTS feedback_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES feedback_cycle(id) ON DELETE CASCADE,
  participant_employee_id text NOT NULL REFERENCES employees(employee_id),
  reviewer_id uuid REFERENCES feedback_reviewer(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'assignment_created', 'assignment_removed',
    'review_submitted', 'review_updated', 'review_removed'
  )),
  actor_employee_id text REFERENCES employees(employee_id),
  actor_system boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_audit_log_cycle ON feedback_audit_log(cycle_id);
CREATE INDEX idx_feedback_audit_log_participant ON feedback_audit_log(participant_employee_id);
CREATE INDEX idx_feedback_audit_log_created ON feedback_audit_log(created_at);
CREATE INDEX idx_feedback_audit_log_event ON feedback_audit_log(event_type);

COMMENT ON TABLE feedback_audit_log IS '360 audit trail: assignment created/removed, review submitted/updated/removed. Actor = HR employee or system.';

-- 3) Update participant trigger: insert MANAGER (participant''s manager) and log assignment_created for all generated reviewers
CREATE OR REPLACE FUNCTION feedback_participant_generate_reviewers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_manager_id text;
  v_department_id text;
BEGIN
  SELECT e.department_id INTO v_department_id
  FROM employees e
  WHERE e.employee_id = new.employee_id AND e.is_active = true;

  SELECT r.manager_employee_id INTO v_manager_id
  FROM reporting_lines r
  WHERE r.employee_id = new.employee_id AND r.is_primary = true
  LIMIT 1;

  -- SELF: participant as their own reviewer
  INSERT INTO feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  VALUES (new.cycle_id, new.employee_id, new.employee_id, 'SELF', 'Pending')
  ON CONFLICT (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) DO NOTHING;

  -- MANAGER: participant''s manager (one)
  IF v_manager_id IS NOT NULL THEN
    INSERT INTO feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
    VALUES (new.cycle_id, new.employee_id, v_manager_id, 'MANAGER', 'Pending')
    ON CONFLICT (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) DO NOTHING;
  END IF;

  -- DIRECT_REPORT: all employees where manager_employee_id = participant
  INSERT INTO feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  SELECT new.cycle_id, new.employee_id, r.employee_id, 'DIRECT_REPORT', 'Pending'
  FROM reporting_lines r
  JOIN employees e ON e.employee_id = r.employee_id AND e.is_active = true
  WHERE r.manager_employee_id = new.employee_id AND r.is_primary = true
  ON CONFLICT (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) DO NOTHING;

  -- PEER: same manager, same department; max 4
  INSERT INTO feedback_reviewer (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type, status)
  SELECT new.cycle_id, new.employee_id, peer.employee_id, 'PEER', 'Pending'
  FROM (
    SELECT DISTINCT e.employee_id
    FROM reporting_lines r
    JOIN employees e ON e.employee_id = r.employee_id AND e.is_active = true
    WHERE r.manager_employee_id = v_manager_id
      AND r.is_primary = true
      AND v_department_id IS NOT NULL AND e.department_id = v_department_id
      AND e.employee_id <> new.employee_id
      AND (v_manager_id IS NULL OR e.employee_id <> v_manager_id)
      AND NOT EXISTS (
        SELECT 1 FROM reporting_lines dr
        WHERE dr.employee_id = e.employee_id AND dr.manager_employee_id = new.employee_id AND dr.is_primary = true
      )
    LIMIT 4
  ) peer
  ON CONFLICT (cycle_id, participant_employee_id, reviewer_employee_id, reviewer_type) DO NOTHING;

  -- Audit: log assignment_created for all reviewers generated for this participant (system-generated)
  INSERT INTO feedback_audit_log (cycle_id, participant_employee_id, reviewer_id, event_type, actor_system, metadata)
  SELECT new.cycle_id, new.employee_id, fr.id, 'assignment_created', true,
         jsonb_build_object('reviewer_type', fr.reviewer_type)
  FROM feedback_reviewer fr
  WHERE fr.cycle_id = new.cycle_id AND fr.participant_employee_id = new.employee_id;

  RETURN new;
END;
$$;
