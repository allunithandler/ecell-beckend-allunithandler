-- Fix Attendance Sessions Table
-- Add missing columns required for the new features
ALTER TABLE public.attendance_sessions 
ADD COLUMN IF NOT EXISTS mom_url text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Rename title/description in our mental model to match existing schema if needed, 
-- or just use existing columns.
-- Existing: session_name, notes
-- We will use session_name as title, and notes as description.

-- Ensure Enums exist (if not already)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_type') THEN
        CREATE TYPE session_type AS ENUM ('GENERAL', 'MEETING', 'WORKSHOP', 'EVENT');
    END IF;
END$$;

-- Update RLS policies to be sure they don't conflict
DROP POLICY IF EXISTS "Admins/Mentors can create sessions" ON public.attendance_sessions;
CREATE POLICY "Admins/Mentors can create sessions" ON public.attendance_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

DROP POLICY IF EXISTS "Admins/Mentors can update sessions" ON public.attendance_sessions;
CREATE POLICY "Admins/Mentors can update sessions" ON public.attendance_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

-- Fix Faculty View Tokens if needed (User schema showed it, but let's ensure policies)
ALTER TABLE public.faculty_view_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage tokens" ON public.faculty_view_tokens;
CREATE POLICY "Admins can manage tokens" ON public.faculty_view_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

-- Update RPC function to use correct column names (session_name vs title)
CREATE OR REPLACE FUNCTION public.get_faculty_dashboard(token_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record record;
  result json;
BEGIN
  -- Check token validity
  SELECT * INTO token_record FROM public.faculty_view_tokens
  WHERE token = token_input AND expires_at > now();

  IF token_record IS NULL THEN
    RETURN json_build_object('error', 'Invalid or expired token');
  END IF;

  -- Fetch sessions using correct column names
  SELECT json_build_object(
    'faculty_name', token_record.faculty_name,
    'sessions', (
      SELECT json_agg(s) FROM (
        SELECT 
          id, 
          session_name as title, -- Map to title for frontend consistency
          notes as description,  -- Map to description
          mom_url, 
          created_at,
          (SELECT count(*) FROM public.attendance WHERE session_id = id) as attendee_count
        FROM public.attendance_sessions
        ORDER BY created_at DESC
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faculty_dashboard(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_faculty_dashboard(text) TO authenticated;
