-- Function to send email via edge function
CREATE OR REPLACE FUNCTION public.send_auth_email(
  email_to TEXT,
  email_subject TEXT,
  email_html TEXT,
  email_type TEXT DEFAULT 'confirmation'
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  edge_function_url TEXT;
  api_key TEXT;
BEGIN
  -- Get project URL from environment or construct it
  edge_function_url := 'https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email';
  
  -- Get the service role key (this should be set in the environment)
  -- For now, we'll use the anon key which should be sufficient for this edge function
  api_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYW93aGFwYmxjeHJwd3lteWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODczMzgsImV4cCI6MjA3Nzg2MzMzOH0.oICKiUSdib07RXPeTjAIOi9RxM40WsCVL9NrsBJ_GU0';

  -- Call the edge function
  SELECT
    content::JSONB INTO result
  FROM
    http((
      'POST',
      edge_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || api_key)
      ],
      'application/json',
      jsonb_build_object(
        'to', email_to,
        'subject', email_subject,
        'html', email_html,
        'type', email_type
      )::TEXT
    )::http_request);

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send email: %', SQLERRM;
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate email confirmation HTML
CREATE OR REPLACE FUNCTION public.get_confirmation_email_html(confirmation_url TEXT, user_email TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN format('
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 20px; }
          .wrapper { max-width: 600px; margin: 0 auto; }
          .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f57c00 0%%, #ff9800 100%%); padding: 40px 20px; text-align: center; }
          .logo { font-size: 32px; font-weight: 800; color: white; margin-bottom: 10px; letter-spacing: -1px; }
          .tagline { color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; }
          .message { color: #555; line-height: 1.8; font-size: 15px; margin-bottom: 30px; }
          .button-wrapper { text-align: center; margin: 35px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #f57c00 0%%, #ff9800 100%%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(245, 124, 0, 0.3); }
          .info-box { background: #f8f9fa; border-left: 4px solid #f57c00; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .info-box-title { font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
          .info-box-text { color: #666; font-size: 14px; line-height: 1.6; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .warning-box-title { font-weight: 700; color: #856404; margin-bottom: 8px; }
          .warning-box-text { color: #856404; font-size: 14px; line-height: 1.6; }
          .footer { background: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; }
          .footer-text { color: #999; font-size: 13px; line-height: 1.6; }
          .code-block { background: #f5f5f5; border: 1px solid #ddd; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #333; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">🚀 E-Cell GLA</div>
              <div class="tagline">Entrepreneurship Cell - GLA University</div>
            </div>
            <div class="content">
              <div class="greeting">Welcome to E-Cell GLA! 🎉</div>
              <div class="message">
                Thank you for signing up! We''re excited to have you join our entrepreneurship community. 
                To get started, please verify your email address by clicking the button below.
              </div>
              <div class="info-box">
                <div class="info-box-title">📧 Email Verification</div>
                <div class="info-box-text">
                  Your account has been created with: <strong>%s</strong>
                </div>
              </div>
              <div class="button-wrapper">
                <a href="%s" class="button">Verify Email Address</a>
              </div>
              <div class="message" style="font-size: 13px; color: #999;">
                Or copy this link: <br>
                <div class="code-block">%s</div>
              </div>
              <div class="warning-box">
                <div class="warning-box-title">⏰ Link Expires In</div>
                <div class="warning-box-text">This verification link will expire in 24 hours. Please verify your email soon.</div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - GLA University<br>
                © 2024 E-Cell GLA. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  ', user_email, confirmation_url, confirmation_url);
END;
$$ LANGUAGE plpgsql;

-- Function to generate password reset email HTML
CREATE OR REPLACE FUNCTION public.get_password_reset_email_html(reset_url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN format('
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 20px; }
          .wrapper { max-width: 600px; margin: 0 auto; }
          .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f57c00 0%%, #ff9800 100%%); padding: 40px 20px; text-align: center; }
          .logo { font-size: 32px; font-weight: 800; color: white; margin-bottom: 10px; letter-spacing: -1px; }
          .tagline { color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; }
          .content { padding: 40px; }
          .greeting { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; }
          .message { color: #555; line-height: 1.8; font-size: 15px; margin-bottom: 30px; }
          .button-wrapper { text-align: center; margin: 35px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #f57c00 0%%, #ff9800 100%%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(245, 124, 0, 0.3); }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .warning-box-title { font-weight: 700; color: #856404; margin-bottom: 8px; }
          .warning-box-text { color: #856404; font-size: 14px; line-height: 1.6; }
          .footer { background: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; }
          .footer-text { color: #999; font-size: 13px; line-height: 1.6; }
          .code-block { background: #f5f5f5; border: 1px solid #ddd; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #333; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">🔐 E-Cell GLA</div>
              <div class="tagline">Password Reset Request</div>
            </div>
            <div class="content">
              <div class="greeting">Reset Your Password</div>
              <div class="message">
                We received a request to reset your password. Click the button below to create a new password for your account.
              </div>
              <div class="button-wrapper">
                <a href="%s" class="button">Reset Password</a>
              </div>
              <div class="message" style="font-size: 13px; color: #999;">
                Or copy this link: <br>
                <div class="code-block">%s</div>
              </div>
              <div class="warning-box">
                <div class="warning-box-title">⚠️ Security Notice</div>
                <div class="warning-box-text">
                  This link will expire in <strong>1 hour</strong>. If you didn''t request this password reset, please ignore this email and your password will remain unchanged.
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - GLA University<br>
                © 2024 E-Cell GLA. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  ', reset_url, reset_url);
END;
$$ LANGUAGE plpgsql;

-- Enable the pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;
