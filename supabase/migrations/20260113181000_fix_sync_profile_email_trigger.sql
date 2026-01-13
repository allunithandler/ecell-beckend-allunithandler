-- Fix signup 500 caused by trg_sync_profile_email lacking privileges.
-- The trigger runs on auth.users insert/update and syncs auth.users.email -> profiles.email.
-- It must be SECURITY DEFINER to bypass RLS and privilege restrictions.

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE user_id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'sync_profile_email failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
