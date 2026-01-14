-- Fix redirect URLs for email confirmation and password reset
-- This migration updates the hardcoded placeholder URLs to the actual Netlify app URL

-- Update the confirmation email function
CREATE OR REPLACE FUNCTION public.send_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_url TEXT;
  email_html TEXT;
  result JSONB;
BEGIN
  -- Only send email if email is not confirmed
  IF NEW.email_confirmed_at IS NULL AND NEW.confirmation_token IS NOT NULL THEN
    -- Build the confirmation URL with correct redirect
    confirmation_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' || NEW.confirmation_token || '&type=signup&redirect_to=' || encode(uri_encode('https://dashboard-glauecell.netlify.app/auth'), 'escape');
    
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

-- Update the password reset email function
CREATE OR REPLACE FUNCTION public.send_recovery_email()
RETURNS TRIGGER AS $$
DECLARE
  reset_url TEXT;
  email_html TEXT;
  result JSONB;
BEGIN
  -- Only send email if recovery token was just set
  IF NEW.recovery_token IS NOT NULL AND (OLD.recovery_token IS NULL OR OLD.recovery_token != NEW.recovery_token) THEN
    -- Build the reset URL with correct redirect
    reset_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' || NEW.recovery_token || '&type=recovery&redirect_to=' || encode(uri_encode('https://dashboard-glauecell.netlify.app/auth'), 'escape');
    
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
