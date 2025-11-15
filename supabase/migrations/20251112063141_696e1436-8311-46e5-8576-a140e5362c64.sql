-- Fix ambiguous column reference in attendance RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can mark attendance based on hierarchy" ON attendance;
DROP POLICY IF EXISTS "Attendance markers can update their marked records" ON attendance;

-- Recreate policies with proper table qualification
CREATE POLICY "Users can mark attendance based on hierarchy"
ON attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND public.can_mark_attendance_for(p.id, attendance.user_id)
  )
);

CREATE POLICY "Attendance markers can update their marked records"
ON attendance
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND marked_by = p.id
    AND public.can_mark_attendance_for(p.id, attendance.user_id)
  )
);