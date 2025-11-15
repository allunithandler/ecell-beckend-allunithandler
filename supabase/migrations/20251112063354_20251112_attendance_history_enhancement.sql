/*
  # Attendance History Enhancement

  1. Updates to attendance table
    - Add session_name field for event/meeting name
    - Add location field for session location
    - Add created_by field to track who created the attendance session
  
  2. New attendance_sessions table
    - Track attendance sessions for better organization
    - Stores session metadata and attendance taker info
  
  3. Security
    - Enable RLS on attendance_sessions table
    - Add policies for attendance marking (Committee Head and Mentor only)
    - Ensure users can only view attendance records they have access to
*/

-- Add new columns to attendance table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'session_name'
  ) THEN
    ALTER TABLE attendance ADD COLUMN session_name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'location'
  ) THEN
    ALTER TABLE attendance ADD COLUMN location TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE attendance ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Create attendance_sessions table for tracking sessions
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name TEXT NOT NULL,
  session_type session_type NOT NULL DEFAULT 'GENERAL',
  session_date DATE NOT NULL,
  location TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on attendance_sessions
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Create function to check if user can mark attendance
CREATE OR REPLACE FUNCTION can_mark_attendance(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id LIMIT 1;
  RETURN user_role IN ('MENTOR', 'COMMITTEE');
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS policies for attendance table
DROP POLICY IF EXISTS "Users can mark attendance based on hierarchy" ON attendance;
DROP POLICY IF EXISTS "Attendance markers can update their marked records" ON attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Markers can view attendance they marked" ON attendance;

-- Policy for mentors and committee to insert attendance
CREATE POLICY "Committee and Mentors can mark attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_mark_attendance(auth.uid())
  );

-- Policy for mentors and committee to update attendance
CREATE POLICY "Committee and Mentors can update attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (
    can_mark_attendance(auth.uid())
  )
  WITH CHECK (
    can_mark_attendance(auth.uid())
  );

-- Policy for viewing attendance
CREATE POLICY "Users can view own attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = attendance.user_id)
    OR can_mark_attendance(auth.uid())
  );

-- RLS policies for attendance_sessions table
DROP POLICY IF EXISTS "Committee and Mentors can create sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Committee and Mentors can update sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Committee and Mentors can delete sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Users can view attendance sessions" ON attendance_sessions;

CREATE POLICY "Committee and Mentors can create sessions"
  ON attendance_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_mark_attendance(auth.uid())
  );

CREATE POLICY "Committee and Mentors can update sessions"
  ON attendance_sessions
  FOR UPDATE
  TO authenticated
  USING (
    can_mark_attendance(auth.uid())
  )
  WITH CHECK (
    can_mark_attendance(auth.uid())
  );

CREATE POLICY "Committee and Mentors can delete sessions"
  ON attendance_sessions
  FOR DELETE
  TO authenticated
  USING (
    can_mark_attendance(auth.uid())
  );

CREATE POLICY "Users can view attendance sessions"
  ON attendance_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS attendance_user_id_date_idx ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS attendance_marked_by_idx ON attendance(marked_by);
CREATE INDEX IF NOT EXISTS attendance_session_date_idx ON attendance(date);
CREATE INDEX IF NOT EXISTS attendance_sessions_date_idx ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS attendance_sessions_created_by_idx ON attendance_sessions(created_by);
