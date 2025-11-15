-- Migration: Add name column to profiles table
-- Created at: 2025-11-15

-- Add name column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS name TEXT CHECK (char_length(name) >= 2 AND char_length(name) <= 50);

-- Create index on name for better performance
CREATE INDEX IF NOT EXISTS profiles_name_idx ON profiles(name);

-- Update RLS policies to allow users to update their own name
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);