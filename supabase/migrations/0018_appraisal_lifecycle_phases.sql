-- --------------------------------------------------
-- APPRAISAL LIFECYCLE PHASES
-- Separates Planning Phase from Assessment Phase
-- --------------------------------------------------

-- 1. Add phase column to appraisal_cycles
-- Phases: planning (workplan setup), assessment (evaluation), closed
ALTER TABLE appraisal_cycles 
ADD COLUMN IF NOT EXISTS phase text DEFAULT 'planning'
CHECK (phase IN ('planning', 'assessment', 'closed'));

-- Set existing open cycles to assessment (they were already allowing ratings)
UPDATE appraisal_cycles 
SET phase = 'assessment' 
WHERE status = 'open';

UPDATE appraisal_cycles 
SET phase = 'closed' 
WHERE status = 'closed';

-- 2. Add workplan locking fields
ALTER TABLE workplans
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by text REFERENCES employees(employee_id),
ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS submitted_by text REFERENCES employees(employee_id),
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by text REFERENCES employees(employee_id);

-- 3. Create new appraisal status type with expanded statuses
-- We'll use a text column approach for flexibility instead of replacing the enum
-- Add a comment explaining the status flow

COMMENT ON COLUMN appraisals.status IS 'Status flow:
PLANNING PHASE:
  - workplan_draft: Employee defining objectives (default when cycle opens in planning)
  - workplan_submitted: Workplan sent to manager for approval
  - workplan_approved: Manager approved, locked until assessment phase

ASSESSMENT PHASE:
  - self_assessment: Employee entering actual results and self-ratings
  - manager_review: Manager reviewing and adding ratings
  - manager_completed: Manager finished review

FINALIZATION:
  - employee_acknowledged: Employee signed acknowledgement
  - hr_review: HR final review
  - closed: Appraisal complete

LEGACY (for backward compatibility):
  - draft: Maps to workplan_draft
  - self_submitted: Maps to manager_review (assessment submitted)
  - manager_in_review: Maps to manager_review
';

-- 4. Add new status values to the enum
-- First check if we need to add them
DO $$
BEGIN
  -- Add workplan_draft if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'workplan_draft' AND enumtypid = 'appraisal_status'::regtype) THEN
    ALTER TYPE appraisal_status ADD VALUE 'workplan_draft';
  END IF;
  
  -- Add workplan_submitted if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'workplan_submitted' AND enumtypid = 'appraisal_status'::regtype) THEN
    ALTER TYPE appraisal_status ADD VALUE 'workplan_submitted';
  END IF;
  
  -- Add workplan_approved if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'workplan_approved' AND enumtypid = 'appraisal_status'::regtype) THEN
    ALTER TYPE appraisal_status ADD VALUE 'workplan_approved';
  END IF;
  
  -- Add self_assessment if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'self_assessment' AND enumtypid = 'appraisal_status'::regtype) THEN
    ALTER TYPE appraisal_status ADD VALUE 'self_assessment';
  END IF;
  
  -- Add manager_review if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager_review' AND enumtypid = 'appraisal_status'::regtype) THEN
    ALTER TYPE appraisal_status ADD VALUE 'manager_review';
  END IF;
END $$;

-- 5. Create workplan status enum if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workplan_status') THEN
    CREATE TYPE workplan_status AS ENUM (
      'draft',
      'submitted',
      'approved',
      'rejected',
      'locked'
    );
  END IF;
END $$;

-- 6. Create function to check if workplan can be edited
CREATE OR REPLACE FUNCTION can_edit_workplan(p_workplan_id uuid, p_employee_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_workplan RECORD;
  v_appraisal RECORD;
  v_cycle RECORD;
BEGIN
  -- Get workplan
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- If workplan is locked, no editing allowed
  IF v_workplan.locked_at IS NOT NULL THEN RETURN false; END IF;
  
  -- Get appraisal
  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Get cycle
  SELECT * INTO v_cycle FROM appraisal_cycles WHERE id = v_appraisal.cycle_id;
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Only allow editing during planning phase
  IF v_cycle.phase != 'planning' THEN RETURN false; END IF;
  
  -- Check if employee is the appraisal owner or manager
  IF v_appraisal.employee_id = p_employee_id THEN RETURN true; END IF;
  IF v_appraisal.manager_employee_id = p_employee_id THEN RETURN true; END IF;
  
  RETURN false;
END;
$$;

-- 7. Create function to check if assessment fields can be edited
CREATE OR REPLACE FUNCTION can_edit_assessment(p_appraisal_id uuid, p_employee_id text)
RETURNS TABLE(can_edit_self boolean, can_edit_manager boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_appraisal RECORD;
  v_cycle RECORD;
BEGIN
  -- Get appraisal
  SELECT * INTO v_appraisal FROM appraisals WHERE id = p_appraisal_id;
  IF NOT FOUND THEN 
    can_edit_self := false;
    can_edit_manager := false;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Get cycle
  SELECT * INTO v_cycle FROM appraisal_cycles WHERE id = v_appraisal.cycle_id;
  
  -- Only allow assessment editing during assessment phase
  IF v_cycle.phase != 'assessment' THEN
    can_edit_self := false;
    can_edit_manager := false;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- Employee can edit self ratings during self_assessment status
  can_edit_self := (
    v_appraisal.employee_id = p_employee_id AND 
    v_appraisal.status IN ('self_assessment', 'draft', 'workplan_approved')
  );
  
  -- Manager can edit during manager_review status
  can_edit_manager := (
    v_appraisal.manager_employee_id = p_employee_id AND 
    v_appraisal.status IN ('manager_review', 'self_submitted', 'manager_in_review')
  );
  
  RETURN NEXT;
END;
$$;

-- 8. Create view for workplan approval queue
CREATE OR REPLACE VIEW workplan_approval_queue AS
SELECT 
  w.id as workplan_id,
  w.appraisal_id,
  w.status as workplan_status,
  w.submitted_at,
  a.employee_id,
  e.full_name as employee_name,
  e.job_title,
  e.division_id,
  e.division_name,
  a.manager_employee_id,
  m.full_name as manager_name,
  a.cycle_id,
  c.fiscal_year,
  c.name as cycle_name,
  a.review_type,
  (SELECT COUNT(*) FROM workplan_items WHERE workplan_id = w.id) as item_count,
  (SELECT COALESCE(SUM(weight), 0) FROM workplan_items WHERE workplan_id = w.id) as total_weight
FROM workplans w
JOIN appraisals a ON a.id = w.appraisal_id
JOIN employees e ON e.employee_id = a.employee_id
LEFT JOIN employees m ON m.employee_id = a.manager_employee_id
JOIN appraisal_cycles c ON c.id = a.cycle_id
WHERE w.status = 'submitted'
  AND w.locked_at IS NULL
ORDER BY w.submitted_at ASC;

-- 9. Create function to submit workplan for approval
CREATE OR REPLACE FUNCTION submit_workplan_for_approval(
  p_workplan_id uuid,
  p_employee_id text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_workplan RECORD;
  v_appraisal RECORD;
  v_total_weight numeric;
  v_item_count int;
BEGIN
  -- Get workplan
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Workplan not found');
  END IF;
  
  -- Check if already submitted or locked
  IF v_workplan.status = 'submitted' THEN
    RETURN json_build_object('success', false, 'error', 'Workplan already submitted for approval');
  END IF;
  
  IF v_workplan.locked_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Workplan is locked and cannot be modified');
  END IF;
  
  -- Get appraisal
  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  
  -- Verify the submitter is the employee
  IF v_appraisal.employee_id != p_employee_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the employee can submit their workplan');
  END IF;
  
  -- Validate workplan has items
  SELECT COUNT(*), COALESCE(SUM(weight), 0) 
  INTO v_item_count, v_total_weight
  FROM workplan_items 
  WHERE workplan_id = p_workplan_id;
  
  IF v_item_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Workplan must have at least one objective');
  END IF;
  
  IF v_total_weight != 100 THEN
    RETURN json_build_object('success', false, 'error', 'Workplan weights must total 100%. Current total: ' || v_total_weight || '%');
  END IF;
  
  -- Update workplan status
  UPDATE workplans
  SET 
    status = 'submitted',
    submitted_at = now(),
    submitted_by = p_employee_id,
    rejection_reason = NULL,
    rejected_at = NULL,
    rejected_by = NULL
  WHERE id = p_workplan_id;
  
  -- Update appraisal status
  UPDATE appraisals
  SET 
    status = 'workplan_submitted',
    updated_at = now()
  WHERE id = v_workplan.appraisal_id;
  
  RETURN json_build_object('success', true, 'message', 'Workplan submitted for approval');
END;
$$;

-- 10. Create function to approve workplan
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
  -- Get workplan
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Workplan not found');
  END IF;
  
  -- Get appraisal
  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  
  -- Verify the approver is the manager
  IF v_appraisal.manager_employee_id != p_manager_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the assigned manager can approve this workplan');
  END IF;
  
  -- Check workplan is submitted
  IF v_workplan.status != 'submitted' THEN
    RETURN json_build_object('success', false, 'error', 'Workplan must be submitted before approval');
  END IF;
  
  -- Approve and lock the workplan
  UPDATE workplans
  SET 
    status = 'approved',
    approved_by_employee_id = p_manager_id,
    approved_at = now(),
    locked_at = now(),
    locked_by = p_manager_id
  WHERE id = p_workplan_id;
  
  -- Update appraisal status
  UPDATE appraisals
  SET 
    status = 'workplan_approved',
    updated_at = now()
  WHERE id = v_workplan.appraisal_id;
  
  RETURN json_build_object('success', true, 'message', 'Workplan approved and locked');
END;
$$;

-- 11. Create function to reject workplan
CREATE OR REPLACE FUNCTION reject_workplan(
  p_workplan_id uuid,
  p_manager_id text,
  p_reason text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_workplan RECORD;
  v_appraisal RECORD;
BEGIN
  -- Get workplan
  SELECT * INTO v_workplan FROM workplans WHERE id = p_workplan_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Workplan not found');
  END IF;
  
  -- Get appraisal
  SELECT * INTO v_appraisal FROM appraisals WHERE id = v_workplan.appraisal_id;
  
  -- Verify the approver is the manager
  IF v_appraisal.manager_employee_id != p_manager_id THEN
    RETURN json_build_object('success', false, 'error', 'Only the assigned manager can reject this workplan');
  END IF;
  
  -- Check workplan is submitted
  IF v_workplan.status != 'submitted' THEN
    RETURN json_build_object('success', false, 'error', 'Workplan must be submitted before rejection');
  END IF;
  
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;
  
  -- Reject the workplan - return to draft for editing
  UPDATE workplans
  SET 
    status = 'rejected',
    rejection_reason = p_reason,
    rejected_at = now(),
    rejected_by = p_manager_id
  WHERE id = p_workplan_id;
  
  -- Update appraisal status back to draft
  UPDATE appraisals
  SET 
    status = 'workplan_draft',
    updated_at = now()
  WHERE id = v_workplan.appraisal_id;
  
  RETURN json_build_object('success', true, 'message', 'Workplan returned to employee for revision');
END;
$$;

-- 12. Create function to open assessment phase for a cycle
CREATE OR REPLACE FUNCTION open_assessment_phase(p_cycle_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle RECORD;
  v_pending_count int;
  v_approved_count int;
  v_total_count int;
BEGIN
  -- Get cycle
  SELECT * INTO v_cycle FROM appraisal_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Cycle not found');
  END IF;
  
  -- Check cycle is open and in planning phase
  IF v_cycle.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Cycle must be open to start assessment phase');
  END IF;
  
  IF v_cycle.phase = 'assessment' THEN
    RETURN json_build_object('success', false, 'error', 'Assessment phase is already open');
  END IF;
  
  -- Count workplan statuses
  SELECT 
    COUNT(*) FILTER (WHERE w.status IN ('draft', 'submitted', 'rejected')),
    COUNT(*) FILTER (WHERE w.status = 'approved'),
    COUNT(*)
  INTO v_pending_count, v_approved_count, v_total_count
  FROM appraisals a
  LEFT JOIN workplans w ON w.appraisal_id = a.id
  WHERE a.cycle_id = p_cycle_id;
  
  -- Warn if there are unapproved workplans but allow proceeding
  -- (HR may want to proceed with partial approval)
  
  -- Update cycle phase
  UPDATE appraisal_cycles
  SET phase = 'assessment', updated_at = now()
  WHERE id = p_cycle_id;
  
  -- Move all approved workplans to self_assessment status
  UPDATE appraisals
  SET status = 'self_assessment', updated_at = now()
  WHERE cycle_id = p_cycle_id
    AND status = 'workplan_approved';
  
  -- Also handle legacy statuses - move draft to self_assessment
  -- (for backward compatibility with existing data)
  UPDATE appraisals
  SET status = 'self_assessment', updated_at = now()
  WHERE cycle_id = p_cycle_id
    AND status = 'draft';
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Assessment phase opened',
    'stats', json_build_object(
      'total_appraisals', v_total_count,
      'approved_workplans', v_approved_count,
      'pending_workplans', v_pending_count
    )
  );
END;
$$;

-- 13. Update the appraisal generation to use new status
CREATE OR REPLACE FUNCTION set_initial_appraisal_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle_phase text;
BEGIN
  -- Get the cycle phase
  SELECT phase INTO v_cycle_phase 
  FROM appraisal_cycles 
  WHERE id = NEW.cycle_id;
  
  -- Set appropriate initial status based on cycle phase
  IF v_cycle_phase = 'planning' THEN
    NEW.status := 'workplan_draft';
  ELSIF v_cycle_phase = 'assessment' THEN
    NEW.status := 'self_assessment';
  ELSE
    NEW.status := 'draft';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_set_initial_appraisal_status ON appraisals;
CREATE TRIGGER trg_set_initial_appraisal_status
BEFORE INSERT ON appraisals
FOR EACH ROW
WHEN (NEW.status IS NULL OR NEW.status = 'draft')
EXECUTE FUNCTION set_initial_appraisal_status();

-- 14. Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION submit_workplan_for_approval(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_workplan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_workplan(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION open_assessment_phase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_workplan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_assessment(uuid, text) TO authenticated;

-- 15. Grant access to the approval queue view
GRANT SELECT ON workplan_approval_queue TO authenticated;
