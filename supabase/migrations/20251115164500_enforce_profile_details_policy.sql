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

CREATE OR REPLACE FUNCTION public.enforce_profile_details_update_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    IF OLD.name IS NOT NULL AND NOT public.is_technical_admin_uid(auth.uid()) THEN
      RAISE EXCEPTION 'Name change not allowed. Contact Technical Admin.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF OLD.phone IS NOT NULL AND NOT public.is_technical_admin_uid(auth.uid()) THEN
      RAISE EXCEPTION 'Phone change not allowed. Contact Technical Admin.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    IF OLD.photo_url IS NOT NULL AND NOT public.is_technical_admin_uid(auth.uid()) THEN
      RAISE EXCEPTION 'Photo change not allowed. Contact Technical Admin.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_name_update_policy ON profiles;
DROP TRIGGER IF EXISTS enforce_profile_details_update_policy ON profiles;
CREATE TRIGGER enforce_profile_details_update_policy
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_details_update_policy();