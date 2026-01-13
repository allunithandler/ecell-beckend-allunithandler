-- Fix RLS policy for self-attendance to correctly map auth.uid() to profile id
DROP POLICY IF EXISTS "Users can mark their own attendance" ON public.attendance;

CREATE POLICY "Users can mark their own attendance" ON public.attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND id = attendance.user_id
    )
  );

-- Ensure hierarchy policy is active and correct
DROP POLICY IF EXISTS "Users can mark attendance based on hierarchy" ON public.attendance;

CREATE POLICY "Users can mark attendance based on hierarchy"
ON public.attendance
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND public.can_mark_attendance_for(p.id, attendance.user_id)
  )
);
