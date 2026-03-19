-- --------------------------------------------------
-- PROCESS-DRIVEN WORKFLOW
-- Phase progression is per-appraisal; no HR "Start Assessment" gate.
-- Cycle has OPEN/CLOSED only; phase is derived from appraisal statuses for display.
-- --------------------------------------------------

-- 1. approve_workplan: set appraisal status to SELF_ASSESSMENT (not workplan_approved)
CREATE OR REPLACE FUNCTION approve_workplan(
  p_workplan_id uuid,
  p_manager_id text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_workplan RECORD;
  v_appraisal RECORD;
BEGIN
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Workplan not found');
  END IF;

  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  IF v_appraisal.manager_employee_id != p_manager_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the assigned manager can approve this workplan');
  END IF;

  IF v_workplan.status != 'submitted' THEN
    RETURN json_build_object('success', false, 'error', 'Workplan must be submitted before approval');
  END IF;

  UPDATE workplans
  SET
    status = 'approved',
    approved_by_employee_id = p_manager_id,
    approved_at = now(),
    locked_at = now(),
    locked_by = p_manager_id
  WHERE id = p_workplan_id;

  -- Process-driven: move to SELF_ASSESSMENT immediately (no HR gate)
  UPDATE appraisals
  SET status = 'SELF_ASSESSMENT', updated_at = now()
  WHERE id = v_workplan.appraisal_id;

  RETURN json_build_object('success', true, 'message', 'Workplan approved and locked');
END;
$$;

-- 2. can_edit_workplan: allow when cycle is open (no phase column)
CREATE OR REPLACE FUNCTION can_edit_workplan(p_workplan_id uuid, p_employee_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_workplan RECORD;
  v_appraisal RECORD;
  v_cycle RECORD;
BEGIN
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_workplan.locked_at IS NOT NULL THEN RETURN false; END IF;

  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_cycle FROM appraisal_cycles WHERE id = v_appraisal.cycle_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_cycle.status != 'open' THEN RETURN false; END IF;

  IF v_appraisal.employee_id = p_employee_id THEN RETURN true; END IF;
  IF v_appraisal.manager_employee_id = p_employee_id THEN RETURN true; END IF;
  RETURN false;
END;
$$;

-- 3. can_edit_assessment: allow when cycle is open (no phase column); use 9-phase status values
CREATE OR REPLACE FUNCTION can_edit_assessment(p_appraisal_id uuid, p_employee_id text)
RETURNS TABLE(can_edit_self boolean, can_edit_manager boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_appraisal RECORD;
  v_cycle RECORD;
BEGIN
  SELECT * INTO v_appraisal FROM appraisals WHERE id = p_appraisal_id;
  IF NOT FOUND THEN
    can_edit_self := false;
    can_edit_manager := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_cycle FROM appraisal_cycles WHERE id = v_appraisal.cycle_id;
  IF NOT FOUND OR v_cycle.status != 'open' THEN
    can_edit_self := false;
    can_edit_manager := false;
    RETURN NEXT;
    RETURN;
  END IF;

  can_edit_self := (
    v_appraisal.employee_id = p_employee_id AND
    v_appraisal.status IN ('SELF_ASSESSMENT', 'DRAFT', 'PENDING_APPROVAL')
  );

  can_edit_manager := (
    v_appraisal.manager_employee_id = p_employee_id AND
    v_appraisal.status IN ('MANAGER_REVIEW', 'SUBMITTED')
  );

  RETURN NEXT;
END;
$$;

-- 4. Drop bulk open-assessment phase function (no longer used)
DROP FUNCTION IF EXISTS open_assessment_phase(uuid);

-- 5. Remove cycle phase column; phase is derived from appraisal statuses for display only
ALTER TABLE appraisal_cycles DROP COLUMN IF EXISTS phase;

COMMENT ON TABLE appraisal_cycles IS
  'Annual appraisal cycles. status is draft/open/closed. Phase progression is per-appraisal, driven automatically by the workflow (e.g. workplan approval moves to SELF_ASSESSMENT).';
