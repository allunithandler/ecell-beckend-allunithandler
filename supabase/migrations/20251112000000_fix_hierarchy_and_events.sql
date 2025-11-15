-- Fix Event Participants Status Type
CREATE TYPE event_rsvp_status AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

-- Drop and recreate event_participants with proper enum
DROP TABLE IF EXISTS event_participants CASCADE;

CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status event_rsvp_status NOT NULL DEFAULT 'GOING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view event participants"
ON event_participants FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own RSVP"
ON event_participants FOR ALL
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Trigger for event_participants updated_at
CREATE TRIGGER update_event_participants_updated_at 
BEFORE UPDATE ON event_participants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-update event participants count
CREATE OR REPLACE FUNCTION update_event_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'GOING' THEN
    UPDATE events 
    SET participants_count = participants_count + 1 
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'GOING' AND NEW.status = 'GOING' THEN
      UPDATE events 
      SET participants_count = participants_count + 1 
      WHERE id = NEW.event_id;
    ELSIF OLD.status = 'GOING' AND NEW.status != 'GOING' THEN
      UPDATE events 
      SET participants_count = GREATEST(0, participants_count - 1) 
      WHERE id = NEW.event_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'GOING' THEN
    UPDATE events 
    SET participants_count = GREATEST(0, participants_count - 1) 
    WHERE id = OLD.event_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-updating participants count
CREATE TRIGGER event_participants_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON event_participants
FOR EACH ROW EXECUTE FUNCTION update_event_participants_count();

-- Add constraint to hierarchy to prevent circular references
CREATE OR REPLACE FUNCTION check_hierarchy_cycle()
RETURNS TRIGGER AS $$
DECLARE
  current_parent UUID;
  depth INTEGER := 0;
  max_depth INTEGER := 10;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A node cannot be its own parent';
  END IF;
  
  current_parent := NEW.parent_id;
  
  WHILE current_parent IS NOT NULL AND depth < max_depth LOOP
    IF current_parent = NEW.id THEN
      RAISE EXCEPTION 'Circular reference detected in hierarchy';
    END IF;
    
    SELECT parent_id INTO current_parent
    FROM hierarchy
    WHERE id = current_parent;
    
    depth := depth + 1;
  END LOOP;
  
  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Hierarchy depth exceeds maximum allowed depth of %', max_depth;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to check hierarchy cycles
DROP TRIGGER IF EXISTS check_hierarchy_cycle_trigger ON hierarchy;
CREATE TRIGGER check_hierarchy_cycle_trigger
BEFORE INSERT OR UPDATE ON hierarchy
FOR EACH ROW EXECUTE FUNCTION check_hierarchy_cycle();

-- Add unique constraint to prevent duplicate user in hierarchy
CREATE UNIQUE INDEX IF NOT EXISTS idx_hierarchy_user_unique ON hierarchy(user_id);

-- Index for event_participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_status ON event_participants(status);
