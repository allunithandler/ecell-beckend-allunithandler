const RESEND_API_KEY = "re_JXtNeT9k_FQCxZEMtxRDGA4XnURU3vrpc";
const RESEND_API_URL = "https://api.resend.com/emails";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams) {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@ecell-gla.com",
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
}

const emailStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg, #f57c00 0%, #ff9800 100%); padding: 40px 20px; text-align: center; }
  .logo { font-size: 32px; font-weight: 800; color: white; margin-bottom: 10px; letter-spacing: -1px; }
  .tagline { color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; }
  .content { padding: 40px; }
  .greeting { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; }
  .message { color: #555; line-height: 1.8; font-size: 15px; margin-bottom: 30px; }
  .highlight { color: #f57c00; font-weight: 600; }
  .button-wrapper { text-align: center; margin: 35px 0; }
  .button { display: inline-block; background: linear-gradient(135deg, #f57c00 0%, #ff9800 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(245, 124, 0, 0.3); }
  .button:hover { transform: translateY(-2px); }
  .link-text { color: #f57c00; text-decoration: none; font-weight: 600; }
  .divider { height: 1px; background: #eee; margin: 30px 0; }
  .info-box { background: #f8f9fa; border-left: 4px solid #f57c00; padding: 15px; border-radius: 4px; margin: 20px 0; }
  .info-box-title { font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
  .info-box-text { color: #666; font-size: 14px; line-height: 1.6; }
  .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
  .warning-box-title { font-weight: 700; color: #856404; margin-bottom: 8px; }
  .warning-box-text { color: #856404; font-size: 14px; line-height: 1.6; }
  .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0; }
  .success-box-title { font-weight: 700; color: #155724; margin-bottom: 8px; }
  .success-box-text { color: #155724; font-size: 14px; line-height: 1.6; }
  .footer { background: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; }
  .footer-text { color: #999; font-size: 13px; line-height: 1.6; }
  .social-links { margin: 15px 0; }
  .social-links a { display: inline-block; margin: 0 10px; color: #f57c00; text-decoration: none; font-weight: 600; }
  .features { margin: 25px 0; }
  .feature-item { display: flex; margin-bottom: 15px; }
  .feature-icon { color: #f57c00; font-weight: 700; margin-right: 12px; font-size: 18px; }
  .feature-text { color: #555; font-size: 14px; }
  .code-block { background: #f5f5f5; border: 1px solid #ddd; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #333; word-break: break-all; }
`;

export function getSignupWelcomeEmailHTML(confirmationUrl: string, userEmail: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">🚀 E-Cell GLA</div>
              <div class="tagline">Entrepreneurship Cell - Gla University</div>
            </div>
            <div class="content">
              <div class="greeting">Welcome to E-Cell GLA! 🎉</div>
              <div class="message">
                Thank you for signing up! We're excited to have you join our entrepreneurship community. 
                To get started, please verify your email address by clicking the button below.
              </div>
              <div class="info-box">
                <div class="info-box-title">📧 Email Verification</div>
                <div class="info-box-text">
                  Your account has been created with: <strong>${userEmail}</strong>
                </div>
              </div>
              <div class="button-wrapper">
                <a href="${confirmationUrl}" class="button">Verify Email Address</a>
              </div>
              <div class="message" style="font-size: 13px; color: #999;">
                Or copy this link: <br>
                <div class="code-block">${confirmationUrl}</div>
              </div>
              <div class="divider"></div>
              <div class="message">
                <strong>What's Next?</strong><br>
                Once you verify your email, you'll have access to:
              </div>
              <div class="features">
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Join events and workshops organized by E-Cell</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Connect with fellow entrepreneurs and mentors</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Access exclusive resources and opportunities</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Track your attendance and participation</div>
                </div>
              </div>
              <div class="warning-box">
                <div class="warning-box-title">⏰ Link Expires In</div>
                <div class="warning-box-text">This verification link will expire in 24 hours. Please verify your email soon.</div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - Gla University<br>
                <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
              </div>
              <div class="social-links">
                <a href="#">Facebook</a> • <a href="#">Instagram</a> • <a href="#">LinkedIn</a>
              </div>
              <div class="footer-text" style="margin-top: 20px; font-size: 12px;">
                © 2024 E-Cell GLA. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function getVerificationSuccessEmailHTML(userName: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">✅ E-Cell GLA</div>
              <div class="tagline">Email Verified Successfully</div>
            </div>
            <div class="content">
              <div class="greeting">Email Verified! 🎊</div>
              <div class="success-box">
                <div class="success-box-title">✓ Your account is now active</div>
                <div class="success-box-text">
                  Your email has been successfully verified. You can now log in and start exploring E-Cell GLA.
                </div>
              </div>
              <div class="message">
                <strong>You're all set!</strong><br>
                Your account is ready to use. Log in to your dashboard to:
              </div>
              <div class="features">
                <div class="feature-item">
                  <div class="feature-icon">📅</div>
                  <div class="feature-text">View upcoming events and workshops</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">👥</div>
                  <div class="feature-text">Connect with the entrepreneurship community</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">📊</div>
                  <div class="feature-text">Track your attendance and achievements</div>
                </div>
              </div>
              <div class="button-wrapper">
                <a href="${window.location.origin}/auth" class="button">Go to Login</a>
              </div>
              <div class="divider"></div>
              <div class="message" style="font-size: 14px;">
                <strong>Need Help?</strong><br>
                If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - Gla University<br>
                <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
              </div>
              <div class="footer-text" style="margin-top: 20px; font-size: 12px;">
                © 2024 E-Cell GLA. All rights reserved.
              </div>
            </div>
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${emailStyles}</style>
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
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <div class="message" style="font-size: 13px; color: #999;">
                Or copy this link: <br>
                <div class="code-block">${resetUrl}</div>
              </div>
              <div class="warning-box">
                <div class="warning-box-title">⚠️ Security Notice</div>
                <div class="warning-box-text">
                  This link will expire in <strong>1 hour</strong>. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                </div>
              </div>
              <div class="divider"></div>
              <div class="message" style="font-size: 14px;">
                <strong>Tips for a Strong Password:</strong>
              </div>
              <div class="features">
                <div class="feature-item">
                  <div class="feature-icon">•</div>
                  <div class="feature-text">Use at least 6 characters</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">•</div>
                  <div class="feature-text">Mix uppercase and lowercase letters</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">•</div>
                  <div class="feature-text">Include numbers and special characters</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">•</div>
                  <div class="feature-text">Avoid using personal information</div>
                </div>
              </div>
              <div class="info-box">
                <div class="info-box-title">🔒 Account Security</div>
                <div class="info-box-text">
                  Never share your password with anyone. E-Cell GLA staff will never ask for your password via email.
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - Gla University<br>
                <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
              </div>
              <div class="social-links">
                <a href="#">Facebook</a> • <a href="#">Instagram</a> • <a href="#">LinkedIn</a>
              </div>
              <div class="footer-text" style="margin-top: 20px; font-size: 12px;">
                © 2024 E-Cell GLA. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function getPasswordChangedEmailHTML(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${emailStyles}</style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <div class="logo">✅ E-Cell GLA</div>
              <div class="tagline">Password Changed Successfully</div>
            </div>
            <div class="content">
              <div class="greeting">Password Updated! 🔐</div>
              <div class="success-box">
                <div class="success-box-title">✓ Your password has been changed</div>
                <div class="success-box-text">
                  Your account password was successfully updated. You can now log in with your new password.
                </div>
              </div>
              <div class="message">
                <strong>What to do next:</strong><br>
                Log in to your account with your new password to continue using E-Cell GLA.
              </div>
              <div class="button-wrapper">
                <a href="${window.location.origin}/auth" class="button">Go to Login</a>
              </div>
              <div class="divider"></div>
              <div class="warning-box">
                <div class="warning-box-title">🔒 Security Alert</div>
                <div class="warning-box-text">
                  If you didn't make this change or don't recognize this activity, please contact us immediately at <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
                </div>
              </div>
              <div class="message" style="font-size: 14px;">
                <strong>Account Security Tips:</strong>
              </div>
              <div class="features">
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Keep your password confidential</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Log out from shared devices</div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">Update your password regularly</div>
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="footer-text">
                <strong>E-Cell GLA</strong><br>
                Entrepreneurship Cell - Gla University<br>
                <a href="mailto:ecell@gla.ac.in" class="link-text">ecell@gla.ac.in</a>
              </div>
              <div class="footer-text" style="margin-top: 20px; font-size: 12px;">
                © 2024 E-Cell GLA. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}