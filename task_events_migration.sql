-- Task Events Table for Structured Activity Logging
-- This table replaces the cluttered activity feed with proper normalized task events

CREATE TABLE IF NOT EXISTS task_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_assignment_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMPLETED', 'NOTE_ADDED')),
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_events_assignment_id ON task_events(task_assignment_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);

-- RLS Policies
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;

-- Users can view events for tasks they're involved with
CREATE POLICY "Users can view task events for their assignments" ON task_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_assignments ta
            WHERE ta.id = task_assignment_id
            AND (ta.assignee_id = auth.uid() OR ta.assigned_by = auth.uid())
        )
        OR
        EXISTS (
            SELECT 1 FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE ta.id = task_assignment_id
            AND t.created_by = auth.uid()
        )
    );

-- Users can create events for tasks they're involved with
CREATE POLICY "Users can create task events" ON task_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.id = created_by
        )
        AND
        (
            EXISTS (
                SELECT 1 FROM task_assignments ta
                WHERE ta.id = task_assignment_id
                AND (ta.assignee_id = created_by OR ta.assigned_by = created_by)
            )
            OR
            EXISTS (
                SELECT 1 FROM task_assignments ta
                JOIN tasks t ON ta.task_id = t.id
                WHERE ta.id = task_assignment_id
                AND t.created_by = created_by
            )
        )
    );

-- Function to automatically create events for task lifecycle
CREATE OR REPLACE FUNCTION create_task_assignment_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Create ASSIGNED event when task is assigned
    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_events (task_assignment_id, event_type, created_by)
        VALUES (NEW.id, 'ASSIGNED', COALESCE(NEW.assigned_by, NEW.assignee_id));
        RETURN NEW;
    END IF;
    
    -- Create STATUS_CHANGED event when status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO task_events (task_assignment_id, event_type, old_value, new_value, created_by)
        VALUES (NEW.id, 'STATUS_CHANGED', OLD.status, NEW.status, NEW.assignee_id);
        
        -- Create COMPLETED event when task is completed
        IF NEW.status = 'COMPLETED' THEN
            INSERT INTO task_events (task_assignment_id, event_type, created_by)
            VALUES (NEW.id, 'COMPLETED', NEW.assignee_id);
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for automatic event creation
DROP TRIGGER IF EXISTS task_assignment_events_trigger ON task_assignments;
CREATE TRIGGER task_assignment_events_trigger
    AFTER INSERT OR UPDATE ON task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION create_task_assignment_event();

-- Grant necessary permissions
GRANT SELECT, INSERT ON task_events TO authenticated;