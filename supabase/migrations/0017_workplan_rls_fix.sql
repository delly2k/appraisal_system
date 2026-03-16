-- --------------------------------------------------
-- Fix RLS policies for workplans and workplan_items
-- Allow employees to create/update workplans for their own appraisals
-- --------------------------------------------------

-- Drop existing restrictive policies
DROP POLICY IF EXISTS workplans_select ON workplans;
DROP POLICY IF EXISTS workplans_all_hr_admin ON workplans;
DROP POLICY IF EXISTS workplan_items_select ON workplan_items;
DROP POLICY IF EXISTS workplan_items_all_hr_admin ON workplan_items;

-- WORKPLANS: SELECT - users can see workplans for appraisals they can access
CREATE POLICY workplans_select ON workplans
FOR SELECT USING (
  appraisal_id IN (SELECT appraisals.id FROM appraisals)
);

-- WORKPLANS: INSERT - users can create workplans for their own appraisals
CREATE POLICY workplans_insert ON workplans
FOR INSERT WITH CHECK (
  appraisal_id IN (
    SELECT a.id FROM appraisals a
    JOIN app_users u ON u.id = auth.uid()
    WHERE a.employee_id = u.employee_id
       OR a.manager_employee_id = u.employee_id
       OR u.role IN ('hr', 'admin')
  )
);

-- WORKPLANS: UPDATE - users can update workplans for their own appraisals
CREATE POLICY workplans_update ON workplans
FOR UPDATE USING (
  appraisal_id IN (
    SELECT a.id FROM appraisals a
    JOIN app_users u ON u.id = auth.uid()
    WHERE a.employee_id = u.employee_id
       OR a.manager_employee_id = u.employee_id
       OR u.role IN ('hr', 'admin')
  )
);

-- WORKPLANS: DELETE - only HR/Admin can delete
CREATE POLICY workplans_delete ON workplans
FOR DELETE USING (
  EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.role IN ('hr', 'admin'))
);

-- WORKPLAN_ITEMS: SELECT - users can see items for workplans they can access
CREATE POLICY workplan_items_select ON workplan_items
FOR SELECT USING (
  workplan_id IN (SELECT workplans.id FROM workplans)
);

-- WORKPLAN_ITEMS: INSERT - users can add items to their own workplans
CREATE POLICY workplan_items_insert ON workplan_items
FOR INSERT WITH CHECK (
  workplan_id IN (
    SELECT w.id FROM workplans w
    JOIN appraisals a ON a.id = w.appraisal_id
    JOIN app_users u ON u.id = auth.uid()
    WHERE a.employee_id = u.employee_id
       OR a.manager_employee_id = u.employee_id
       OR u.role IN ('hr', 'admin')
  )
);

-- WORKPLAN_ITEMS: UPDATE - users can update items in their own workplans
CREATE POLICY workplan_items_update ON workplan_items
FOR UPDATE USING (
  workplan_id IN (
    SELECT w.id FROM workplans w
    JOIN appraisals a ON a.id = w.appraisal_id
    JOIN app_users u ON u.id = auth.uid()
    WHERE a.employee_id = u.employee_id
       OR a.manager_employee_id = u.employee_id
       OR u.role IN ('hr', 'admin')
  )
);

-- WORKPLAN_ITEMS: DELETE - users can delete items from their own workplans
CREATE POLICY workplan_items_delete ON workplan_items
FOR DELETE USING (
  workplan_id IN (
    SELECT w.id FROM workplans w
    JOIN appraisals a ON a.id = w.appraisal_id
    JOIN app_users u ON u.id = auth.uid()
    WHERE a.employee_id = u.employee_id
       OR a.manager_employee_id = u.employee_id
       OR u.role IN ('hr', 'admin')
  )
);
