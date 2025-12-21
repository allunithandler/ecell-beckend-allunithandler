-- Task Events Table for Structured Activity Logging
-- CORRECTED SCHEMA: Uses task_id and actor_user_id

CREATE TABLE IF NOT EXISTS task_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMPLETED', 'NOTE_ADDED')),
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_created_at ON task_events(created_at);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);

-- RLS Policies
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;

-- Users can view events for tasks they're involved with
CREATE POLICY "Users can view task events" ON task_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM task_assignments ta
            WHERE ta.task_id = task_events.task_id
            AND (ta.assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
                 OR ta.assigned_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
        )
        OR
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_events.task_id
            AND t.created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    );

-- Users can create events for tasks they're involved with
CREATE POLICY "Users can create task events" ON task_events
    FOR INSERT WITH CHECK (
        actor_user_id = auth.uid()
        AND
        (
            EXISTS (
                SELECT 1 FROM task_assignments ta
                WHERE ta.task_id = task_events.task_id
                AND (ta.assignee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
                     OR ta.assigned_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
            )
            OR
            EXISTS (
                SELECT 1 FROM tasks t
                WHERE t.id = task_events.task_id
                AND t.created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
            )
        )
    );

-- Grant necessary permissions
GRANT SELECT, INSERT ON task_events TO authenticated;