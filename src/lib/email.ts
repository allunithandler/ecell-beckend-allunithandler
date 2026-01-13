// Email sending is now handled by Supabase Edge Function
// This file is kept for backward compatibility but emails are sent via database triggers

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams) {
  console.warn("Direct email sending is deprecated. Emails are now handled by Supabase triggers.");
  // For now, this is a no-op. All email sending happens via database triggers
  return { success: true, message: "Email handled by server" };
}

export function getVerificationEmailHTML(confirmationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #f57c00; }
          .content { color: #333; line-height: 1.6; }
          .button { display: inline-block; background-color: #f57c00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">E-Cell GLA</div>
          </div>
          <div class="content">
            <h2>Verify Your Email</h2>
            <p>Welcome to E-Cell GLA! Click the button below to verify your email address and activate your account.</p>
            <a href="${confirmationUrl}" class="button">Verify Email</a>
            <p>Or copy this link: <a href="${confirmationUrl}">${confirmationUrl}</a></p>
            <p>This link expires in 24 hours.</p>
          </div>
          <div class="footer">
            <p>© 2024 E-Cell GLA. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function getPasswordResetEmailHTML(resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #f57c00; }
          .content { color: #333; line-height: 1.6; }
          .button { display: inline-block; background-color: #f57c00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">E-Cell GLA</div>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to set a new password.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
            <div class="warning">
              <strong>Security Note:</strong> This link expires in 1 hour. If you didn't request this, please ignore this email.
            </div>
          </div>
          <div class="footer">
            <p>© 2024 E-Cell GLA. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}