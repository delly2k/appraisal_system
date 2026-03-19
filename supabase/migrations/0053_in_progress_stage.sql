-- --------------------------------------------------
-- IN_PROGRESS STAGE
-- After workplan approval, appraisal moves to IN_PROGRESS (check-ins stage).
-- Employee explicitly starts self-assessment to move to SELF_ASSESSMENT.
-- --------------------------------------------------

-- 1. Allow IN_PROGRESS in appraisals.status
ALTER TABLE appraisals DROP CONSTRAINT IF EXISTS appraisals_status_check;
ALTER TABLE appraisals ADD CONSTRAINT appraisals_status_check CHECK (status IN (
  'DRAFT', 'PENDING_APPROVAL', 'IN_PROGRESS', 'SELF_ASSESSMENT', 'SUBMITTED',
  'MANAGER_REVIEW', 'PENDING_SIGNOFF', 'HOD_REVIEW', 'HR_REVIEW', 'COMPLETE', 'CANCELLED'
));

-- 2. approve_workplan: set appraisal status to IN_PROGRESS (not SELF_ASSESSMENT)
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

  -- Move to IN_PROGRESS (check-ins stage); employee starts self-assessment explicitly later
  UPDATE appraisals
  SET status = 'IN_PROGRESS', updated_at = now()
  WHERE id = v_workplan.appraisal_id;

  RETURN json_build_object('success', true, 'message', 'Workplan approved and locked');
END;
$$;

COMMENT ON TABLE appraisal_cycles IS
  'Annual appraisal cycles. status is draft/open/closed. Workplan approval moves appraisal to IN_PROGRESS; employee starts self-assessment to move to SELF_ASSESSMENT.';
