-- Create a function to send confirmation email after user signup
CREATE OR REPLACE FUNCTION public.send_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_url TEXT;
  email_html TEXT;
  result JSONB;
BEGIN
  -- Only send email if email is not confirmed
  IF NEW.email_confirmed_at IS NULL AND NEW.confirmation_token IS NOT NULL THEN
    -- Build the confirmation URL
    -- The token is used by Supabase to verify the email
    confirmation_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' || NEW.confirmation_token || '&type=signup&redirect_to=' || encode(uri_encode('https://your-app-url.com/auth'), 'escape');
    
    -- Generate HTML email
    email_html := public.get_confirmation_email_html(confirmation_url, NEW.email);
    
    -- Send the email via our edge function
    result := public.send_auth_email(
      NEW.email,
      'Verify Your E-Cell GLA Account',
      email_html,
      'confirmation'
    );
    
    RAISE LOG 'Confirmation email sent to %: %', NEW.email, result;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to send password reset email
CREATE OR REPLACE FUNCTION public.send_recovery_email()
RETURNS TRIGGER AS $$
DECLARE
  reset_url TEXT;
  email_html TEXT;
  result JSONB;
BEGIN
  -- Only send email if recovery token was just set
  IF NEW.recovery_token IS NOT NULL AND (OLD.recovery_token IS NULL OR OLD.recovery_token != NEW.recovery_token) THEN
    -- Build the reset URL
    reset_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' || NEW.recovery_token || '&type=recovery&redirect_to=' || encode(uri_encode('https://your-app-url.com/auth'), 'escape');
    
    -- Generate HTML email
    email_html := public.get_password_reset_email_html(reset_url);
    
    -- Send the email via our edge function
    result := public.send_auth_email(
      NEW.email,
      'Reset Your E-Cell GLA Password',
      email_html,
      'recovery'
    );
    
    RAISE LOG 'Recovery email sent to %: %', NEW.email, result;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_recovery_send_email ON auth.users;

-- Create trigger for confirmation emails
CREATE TRIGGER on_auth_user_created_send_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.confirmation_token IS NOT NULL)
  EXECUTE FUNCTION public.send_confirmation_email();

-- Create trigger for password reset emails
CREATE TRIGGER on_auth_user_recovery_send_email
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.recovery_token IS NOT NULL AND (OLD.recovery_token IS NULL OR OLD.recovery_token != NEW.recovery_token))
  EXECUTE FUNCTION public.send_recovery_email();

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.send_confirmation_email() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.send_recovery_email() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.send_auth_email(TEXT, TEXT, TEXT, TEXT) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_confirmation_email_html(TEXT, TEXT) TO postgres, service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_password_reset_email_html(TEXT) TO postgres, service_role, authenticated;
