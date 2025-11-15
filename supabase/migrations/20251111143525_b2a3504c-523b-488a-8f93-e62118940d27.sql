-- Create storage bucket for event cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true);

-- Allow Mentors to upload event cover images
CREATE POLICY "Mentors can upload event covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-covers' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'MENTOR'
  )
);

-- Allow Mentors to update event covers
CREATE POLICY "Mentors can update event covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-covers' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'MENTOR'
  )
);

-- Allow Mentors to delete event covers
CREATE POLICY "Mentors can delete event covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-covers' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'MENTOR'
  )
);

-- Allow everyone to view event covers (public bucket)
CREATE POLICY "Anyone can view event covers"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-covers');

-- Create event_participants table for RSVP tracking
CREATE TABLE IF NOT EXISTS event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'GOING' CHECK (status IN ('GOING', 'MAYBE', 'NOT_GOING')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS on event_participants
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Users can view all participants
CREATE POLICY "Users can view event participants"
ON event_participants
FOR SELECT
TO authenticated
USING (true);

-- Users can manage their own RSVP
CREATE POLICY "Users can manage their own RSVP"
ON event_participants
FOR ALL
TO authenticated
USING (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);