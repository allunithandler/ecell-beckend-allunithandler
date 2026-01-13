-- Fix signup 500 caused by invalid encode() usage in auth email trigger functions.
--
-- Root cause: send_confirmation_email / send_recovery_email were building redirect_to with
-- encode(<text>, 'escape') which expects bytea and throws, aborting the auth.users insert.

-- Ensure pg_net exists for send_auth_email()
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Make profile creation resilient (never fail auth signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, year)
  VALUES (
    NEW.id,
    'MEMBER',
    EXTRACT(YEAR FROM NOW())::INTEGER
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix confirmation email trigger: remove invalid encode() call.
CREATE OR REPLACE FUNCTION public.send_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confirmation_url TEXT;
  email_html TEXT;
  result JSONB;
  app_url TEXT;
  redirect_to TEXT;
BEGIN
  IF NEW.email_confirmed_at IS NULL AND NEW.confirmation_token IS NOT NULL THEN
    app_url := COALESCE(current_setting('app.base_url', true), 'http://localhost:8080');
    app_url := rtrim(app_url, '/');
    redirect_to := app_url || '/auth';

    confirmation_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' ||
      NEW.confirmation_token ||
      '&type=signup&redirect_to=' ||
      redirect_to;

    email_html := public.get_confirmation_email_html(confirmation_url, NEW.email);

    result := public.send_auth_email(
      NEW.email,
      'Verify Your E-Cell GLA Account',
      email_html,
      'confirmation'
    );

    RAISE LOG 'Confirmation email queued for %: %', NEW.email, result;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_confirmation_email failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix recovery email trigger: remove invalid encode() call.
CREATE OR REPLACE FUNCTION public.send_recovery_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_url TEXT;
  email_html TEXT;
  result JSONB;
  app_url TEXT;
  redirect_to TEXT;
BEGIN
  IF NEW.recovery_token IS NOT NULL AND (OLD.recovery_token IS NULL OR OLD.recovery_token <> NEW.recovery_token) THEN
    app_url := COALESCE(current_setting('app.base_url', true), 'http://localhost:8080');
    app_url := rtrim(app_url, '/');
    redirect_to := app_url || '/auth';

    reset_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' ||
      NEW.recovery_token ||
      '&type=recovery&redirect_to=' ||
      redirect_to;

    email_html := public.get_password_reset_email_html(reset_url);

    result := public.send_auth_email(
      NEW.email,
      'Reset Your E-Cell GLA Password',
      email_html,
      'recovery'
    );

    RAISE LOG 'Recovery email queued for %: %', NEW.email, result;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_recovery_email failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;
