-- Create security definer functions for hierarchy checks

-- Function to check if a user can assign to another user based on hierarchy
CREATE OR REPLACE FUNCTION public.can_assign_to(assigner_id uuid, assignee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_role text;
  assigner_title text;
  assigner_dept text;
  assignee_dept text;
BEGIN
  -- Get assigner details
  SELECT role, title, department INTO assigner_role, assigner_title, assigner_dept
  FROM profiles
  WHERE id = assigner_id;
  
  -- Get assignee department
  SELECT department INTO assignee_dept
  FROM profiles
  WHERE id = assignee_id;
  
  -- Mentors can assign to anyone
  IF assigner_role = 'MENTOR' THEN
    RETURN true;
  END IF;
  
  -- Presidents can assign to anyone
  IF assigner_title IS NOT NULL AND 
     LOWER(assigner_title) LIKE '%president%' AND 
     LOWER(assigner_title) NOT LIKE '%vice%' THEN
    RETURN true;
  END IF;
  
  -- Committee can assign within same department
  IF assigner_role IN ('COMMITTEE', 'DEPT_HEAD') THEN
    IF assigner_dept IS NOT NULL AND assignee_dept IS NOT NULL AND 
       LOWER(assigner_dept) = LOWER(assignee_dept) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to check if a user can mark attendance for another user
CREATE OR REPLACE FUNCTION public.can_mark_attendance_for(marker_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker_role text;
  marker_title text;
  marker_dept text;
  user_dept text;
BEGIN
  -- Get marker details
  SELECT role, title, department INTO marker_role, marker_title, marker_dept
  FROM profiles
  WHERE id = marker_id;
  
  -- Get user department
  SELECT department INTO user_dept
  FROM profiles
  WHERE id = user_id;
  
  -- Mentors can mark for anyone
  IF marker_role = 'MENTOR' THEN
    RETURN true;
  END IF;
  
  -- Presidents can mark for anyone
  IF marker_title IS NOT NULL AND 
     LOWER(marker_title) LIKE '%president%' AND 
     LOWER(marker_title) NOT LIKE '%vice%' THEN
    RETURN true;
  END IF;
  
  -- Committee can mark within same department
  IF marker_role IN ('COMMITTEE', 'DEPT_HEAD') THEN
    IF marker_dept IS NOT NULL AND user_dept IS NOT NULL AND 
       LOWER(marker_dept) = LOWER(user_dept) THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to check if a user can manage events
CREATE OR REPLACE FUNCTION public.can_manage_events(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_title text;
BEGIN
  -- Get user details
  SELECT role, title INTO user_role, user_title
  FROM profiles
  WHERE id = user_id;
  
  -- Mentors can manage events
  IF user_role = 'MENTOR' THEN
    RETURN true;
  END IF;
  
  -- Presidents can manage events
  IF user_title IS NOT NULL AND 
     LOWER(user_title) LIKE '%president%' AND 
     LOWER(user_title) NOT LIKE '%vice%' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Update RLS policy for task_assignments to enforce hierarchy
DROP POLICY IF EXISTS "Mentors and Committee can assign tasks" ON task_assignments;

CREATE POLICY "Users can assign tasks based on hierarchy"
ON task_assignments
FOR INSERT
WITH CHECK (
  assigned_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) AND
  public.can_assign_to(
    assigned_by,
    assignee_id
  )
);

-- Update RLS policy for attendance to enforce hierarchy
DROP POLICY IF EXISTS "Mentors and Committee can mark attendance" ON attendance;

CREATE POLICY "Users can mark attendance based on hierarchy"
ON attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND public.can_mark_attendance_for(id, attendance.user_id)
  )
);

-- Update attendance update policy
DROP POLICY IF EXISTS "Attendance markers can update records" ON attendance;

CREATE POLICY "Attendance markers can update their marked records"
ON attendance
FOR UPDATE
USING (
  marked_by IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid()
    AND public.can_mark_attendance_for(id, attendance.user_id)
  )
);

-- Update events policies to enforce hierarchy
DROP POLICY IF EXISTS "Mentors can manage events" ON events;

CREATE POLICY "Authorized users can manage events"
ON events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND public.can_manage_events(id)
  )
);