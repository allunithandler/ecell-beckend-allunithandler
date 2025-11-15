-- Create custom types
CREATE TYPE user_role AS ENUM ('MENTOR', 'COMMITTEE', 'MEMBER');
CREATE TYPE task_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
CREATE TYPE session_type AS ENUM ('MEETING', 'WORKSHOP', 'EVENT', 'GENERAL');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'MEMBER',
  year INTEGER NOT NULL,
  title TEXT,
  ecell_id TEXT UNIQUE,
  photo_url TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status task_status NOT NULL DEFAULT 'PENDING',
  priority TEXT DEFAULT 'MEDIUM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task assignments
CREATE TABLE task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  assignee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, assignee_id)
);

-- Attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'PRESENT',
  session_type session_type NOT NULL DEFAULT 'GENERAL',
  note TEXT,
  marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, session_type)
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  cover_url TEXT,
  location TEXT,
  participants_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hierarchy table
CREATE TABLE hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES hierarchy(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hierarchy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for tasks
CREATE POLICY "Users can view all tasks"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "Mentors and Committee can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

CREATE POLICY "Task creators can update their tasks"
  ON tasks FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for task_assignments
CREATE POLICY "Users can view their assignments"
  ON task_assignments FOR SELECT
  USING (
    assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR assigned_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Mentors and Committee can assign tasks"
  ON task_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

CREATE POLICY "Assignees can update their task status"
  ON task_assignments FOR UPDATE
  USING (
    assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for attendance
CREATE POLICY "Users can view all attendance"
  ON attendance FOR SELECT
  USING (true);

CREATE POLICY "Mentors and Committee can mark attendance"
  ON attendance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('MENTOR', 'COMMITTEE')
    )
  );

CREATE POLICY "Attendance markers can update records"
  ON attendance FOR UPDATE
  USING (
    marked_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- RLS Policies for events
CREATE POLICY "Users can view active events"
  ON events FOR SELECT
  USING (is_active = true OR created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Mentors can manage events"
  ON events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'MENTOR'
    )
  );

-- RLS Policies for hierarchy
CREATE POLICY "Users can view hierarchy"
  ON hierarchy FOR SELECT
  USING (true);

CREATE POLICY "Mentors can manage hierarchy"
  ON hierarchy FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'MENTOR'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_assignments_assignee ON task_assignments(assignee_id);
CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_hierarchy_parent ON hierarchy(parent_id);
CREATE INDEX idx_hierarchy_user ON hierarchy(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_assignments_updated_at BEFORE UPDATE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique E-Cell ID
CREATE OR REPLACE FUNCTION generate_ecell_id()
RETURNS TRIGGER AS $$
DECLARE
  year_suffix TEXT;
  counter INTEGER;
  new_id TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COUNT(*) + 1 INTO counter
  FROM profiles
  WHERE ecell_id LIKE 'ECELL' || year_suffix || '%';
  
  new_id := 'ECELL' || year_suffix || '-' || LPAD(counter::TEXT, 3, '0');
  NEW.ecell_id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ecell_id
CREATE TRIGGER generate_ecell_id_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN (NEW.ecell_id IS NULL)
EXECUTE FUNCTION generate_ecell_id();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, role, year, title)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'MEMBER'),
    COALESCE((NEW.raw_user_meta_data->>'year')::INTEGER, 1),
    NEW.raw_user_meta_data->>'title'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();