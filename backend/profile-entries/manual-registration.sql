-- BULK USER REGISTRATION SQL SCRIPT
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- NOTE: This only creates profiles, not auth users
-- Auth users must be created via Dashboard or API

-- Insert sample users into profiles table
-- Replace with your actual user data
INSERT INTO profiles (user_id, app_role, ecell_id) VALUES
-- You need to get user_id from auth.users after creating them in Dashboard
-- ('user-id-1', 'MEMBER', null),
-- ('user-id-2', 'MEMBER', null);

-- Example for reference (DO NOT RUN - these are fake IDs):
-- ('550e8400-e29b-41d4-a716-446655440001', 'MEMBER', null),
-- ('550e8400-e29b-41d4-a716-446655440002', 'MEMBER', null);

-- To get user IDs after creating auth users:
SELECT id, email FROM auth.users ORDER BY created_at DESC;