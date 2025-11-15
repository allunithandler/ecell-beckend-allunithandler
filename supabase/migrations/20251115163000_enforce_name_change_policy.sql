-- Enforce one-time name change policy
-- Users can set their name once; subsequent changes require Technical Admin

-- Helper function: check if current user is technical admin
CREATE OR REPLACE FUNCTION public.is_technical_admin_uid(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_title text;
BEGIN
  SELECT title INTO user_title
  FROM profiles
  WHERE user_id = uid
  LIMIT 1;

  IF user_title IS NULL THEN
    RETURN false;
  END IF;

  RETURN LOWER(user_title) LIKE '%technical%' AND LOWER(user_title) LIKE '%admin%';
END;
$$;

-- Trigger function to enforce policy on profiles.name updates
CREATE OR REPLACE FUNCTION public.enforce_name_update_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when name is being changed
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    -- If name existed before and requester is not Technical Admin, block
    IF OLD.name IS NOT NULL AND NOT public.is_technical_admin_uid(auth.uid()) THEN
      RAISE EXCEPTION 'Name change not allowed. Contact Technical Admin.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Allow initial set by the owner; RLS already ensures only owner can update own row
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS enforce_name_update_policy ON profiles;
CREATE TRIGGER enforce_name_update_policy
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_name_update_policy();