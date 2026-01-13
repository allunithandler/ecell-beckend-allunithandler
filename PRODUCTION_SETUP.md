# Production Setup Guide

## Overview
This guide walks you through deploying the E-Cell GLA application to production with fully functional authentication and email services.

---

## Prerequisites

Before deploying to production, ensure you have:

- ✅ Domain name configured (e.g., `ecell-gla.com`)
- ✅ Resend account with verified domain
- ✅ Supabase project in production mode
- ✅ Deployment platform (Vercel, Netlify, etc.)

---

## Step 1: Configure Resend Domain

### 1.1 Verify Domain in Resend

1. Login to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain: `ecell-gla.com`
4. Add the provided DNS records to your domain registrar:
   - **SPF Record**: `v=spf1 include:amazonses.com ~all`
   - **DKIM Records**: (Provided by Resend)
   - **DMARC Record**: `v=DMARC1; p=none; rua=mailto:postmaster@ecell-gla.com`

### 1.2 Verify DNS Configuration

```bash
# Check SPF record
dig TXT ecell-gla.com

# Check DKIM record
dig TXT resend._domainkey.ecell-gla.com

# Check DMARC record
dig TXT _dmarc.ecell-gla.com
```

Wait for DNS propagation (can take up to 48 hours, usually 5-10 minutes).

### 1.3 Test Domain Verification

In Resend dashboard, click "Verify" next to your domain. Status should change to "Verified" ✅

---

## Step 2: Set Environment Variables

### 2.1 Supabase Edge Function Environment

Set the Resend API key as an environment variable:

```bash
# Via Supabase CLI
supabase secrets set RESEND_API_KEY=your_actual_api_key_here

# Or via Supabase Dashboard:
# 1. Go to Edge Functions
# 2. Click on "send-email" function
# 3. Go to Settings → Secrets
# 4. Add: RESEND_API_KEY = your_actual_api_key_here
```

### 2.2 Set App Base URL in Database

Connect to your production database and run:

```sql
-- Set your production URL
ALTER DATABASE postgres SET app.base_url = 'https://your-production-domain.com';

-- Verify it's set
SHOW app.base_url;
```

**Alternative method** (if ALTER DATABASE doesn't work):

Update the trigger functions to use your production URL directly:

```sql
-- Update confirmation email function
CREATE OR REPLACE FUNCTION public.send_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_url TEXT;
  email_html TEXT;
  result JSONB;
  app_url TEXT;
BEGIN
  IF NEW.email_confirmed_at IS NULL AND NEW.confirmation_token IS NOT NULL THEN
    -- Use production URL
    app_url := 'https://your-production-domain.com';
    
    confirmation_url := 'https://hcaowhapblcxrpwymyes.supabase.co/auth/v1/verify?token=' || 
                       NEW.confirmation_token || 
                       '&type=signup&redirect_to=' || 
                       encode(app_url || '/auth', 'escape');
    
    email_html := public.get_confirmation_email_html(confirmation_url, NEW.email);
    
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

-- Update recovery email function (same pattern)
-- ... (similar changes for send_recovery_email)
```

---

## Step 3: Update Frontend Configuration

### 3.1 Update Redirect URLs

In your frontend code (`src/pages/Auth.tsx`), update the redirect URLs:

```typescript
// Signup
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `https://your-production-domain.com/auth`,
  },
});

// Password Reset
const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
  redirectTo: `https://your-production-domain.com/auth`,
});
```

### 3.2 Configure Supabase Auth Settings

In Supabase Dashboard → Authentication → URL Configuration:

1. **Site URL**: `https://your-production-domain.com`
2. **Redirect URLs** (add these):
   - `https://your-production-domain.com/auth`
   - `https://your-production-domain.com/**` (for wildcard matching)
3. **Email Templates** → Confirm Signup:
   - Redirect URL: `https://your-production-domain.com/auth`

---

## Step 4: Test Email Sending

### 4.1 Test Edge Function Directly

```bash
curl -X POST https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "to": "test@example.com",
    "subject": "Production Test Email",
    "html": "<h1>Test from Production</h1>"
  }'
```

Expected response:
```json
{
  "success": true,
  "id": "resend-email-id-here"
}
```

### 4.2 Test Database Trigger

Use the test function:

```sql
-- Send a test email
SELECT public.test_send_email('your-email@example.com');
```

Expected result:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "recipient": "your-email@example.com"
}
```

### 4.3 Test Complete Signup Flow

1. Go to `https://your-production-domain.com/auth`
2. Sign up with a real email address
3. Check inbox for confirmation email
4. Click confirmation link
5. Verify redirect to dashboard

---

## Step 5: Configure CORS (if needed)

If you're calling the edge function from a custom domain:

```typescript
// supabase/functions/send-email/index.ts
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://your-production-domain.com",
  },
});
```

---

## Step 6: Set Up Monitoring

### 6.1 Resend Email Monitoring

1. Go to Resend Dashboard → Emails
2. Monitor delivery rates
3. Check for bounces/complaints
4. Set up webhooks for email events (optional)

### 6.2 Supabase Monitoring

1. Go to Supabase Dashboard → Logs
2. Check Edge Function logs
3. Monitor database logs for trigger execution
4. Set up alerts for errors

### 6.3 Create Alert Queries

```sql
-- Check failed emails in the last hour
SELECT 
  timestamp,
  message
FROM postgres_logs
WHERE message LIKE '%Failed to queue email%'
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Check email send rate
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as signups,
  COUNT(email_confirmed_at) as confirmed
FROM auth.users
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## Step 7: Security Hardening

### 7.1 Rotate API Keys

1. Generate new Resend API key
2. Update edge function secret
3. Test email sending
4. Revoke old API key

### 7.2 Enable Rate Limiting

In Supabase Dashboard → Authentication → Rate Limits:

- **Signup**: 10 per hour per IP
- **Password Reset**: 5 per hour per email
- **Email Verification**: 3 per hour per user

### 7.3 Configure Email Templates

In Supabase Dashboard → Authentication → Email Templates:

Customize templates if needed (though we're using custom ones via triggers).

---

## Step 8: Deployment Checklist

### Pre-Deployment
- [ ] Domain verified in Resend
- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] Resend API key set in edge function
- [ ] App base URL configured in database
- [ ] Frontend redirect URLs updated
- [ ] Supabase Auth URLs configured

### Deployment
- [ ] Deploy frontend to production
- [ ] Test edge function endpoint
- [ ] Test database triggers
- [ ] Verify email delivery

### Post-Deployment
- [ ] Complete test signup flow
- [ ] Test password reset flow
- [ ] Verify session persistence
- [ ] Check email deliverability
- [ ] Monitor logs for errors
- [ ] Set up alerting

---

## Troubleshooting Production Issues

### Emails Not Sending

**Check 1: Domain Verification**
```bash
dig TXT ecell-gla.com
```
Ensure DNS records are correct.

**Check 2: API Key**
```bash
supabase secrets list
```
Verify RESEND_API_KEY is set.

**Check 3: Edge Function Logs**
```bash
supabase functions logs send-email --project-ref hcaowhapblcxrpwymyes
```

**Check 4: Resend Dashboard**
- Go to Resend → Emails → Logs
- Check for rejected/bounced emails
- Verify API key is active

### Wrong Redirect URL

**Check 1: Database Configuration**
```sql
SHOW app.base_url;
```

**Check 2: Supabase Auth Settings**
Go to Authentication → URL Configuration and verify:
- Site URL matches production domain
- Redirect URLs include production domain

**Check 3: Frontend Code**
Check `src/pages/Auth.tsx` for hardcoded URLs.

### Session Not Persisting

**Check 1: HTTPS**
Ensure production site uses HTTPS (cookies won't work on HTTP).

**Check 2: Domain Configuration**
Verify Supabase project domain matches production domain.

**Check 3: Client Configuration**
Check `src/integrations/supabase/client.ts`:
```typescript
{
  storage: localStorage,
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
}
```

---

## Performance Optimization

### Email Delivery Performance

1. **Use Bulk Sending** (if sending multiple emails):
   ```typescript
   // Batch email sends for multiple users
   ```

2. **Monitor Delivery Times**:
   - Check Resend dashboard for average delivery times
   - Optimize email HTML (smaller is faster)

3. **Cache Email Templates**:
   - Templates are generated per email currently
   - Consider caching in the future if performance is an issue

### Database Performance

Monitor trigger execution time:

```sql
SELECT 
  schemaname,
  tablename,
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'users';
```

---

## Scaling Considerations

### Current Setup
- Edge function: Scales automatically with Supabase
- Database triggers: Execute synchronously (slight delay on signup)
- Email sending: Async via pg_net (non-blocking)

### For High Volume

If you expect >1000 signups/hour:

1. **Move to Queue System**:
   - Use Supabase Realtime or external queue (Redis)
   - Process emails in batches

2. **Optimize Triggers**:
   - Make email sending fully async
   - Add retry logic for failed sends

3. **Monitor Resend Limits**:
   - Free tier: 100 emails/day
   - Pro tier: 50,000 emails/month
   - Upgrade plan as needed

---

## Support Contacts

- **Resend Support**: support@resend.com
- **Supabase Support**: support@supabase.com
- **Internal Team**: Refer to `AUTH_EMAIL_SETUP.md`

---

## Rollback Plan

If issues occur in production:

1. **Disable Email Triggers**:
   ```sql
   DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;
   DROP TRIGGER IF EXISTS on_auth_user_recovery_send_email ON auth.users;
   ```

2. **Revert to Manual Email Confirmation**:
   - Enable auto-confirm in Supabase Dashboard
   - Authentication → Settings → Enable "Auto Confirm"

3. **Rollback Frontend**:
   - Revert to previous deployment
   - Git: `git revert HEAD`

---

## Next Steps After Production Deploy

1. **Monitor for 24 hours**:
   - Check email delivery rates
   - Monitor error logs
   - Verify user signups working

2. **Optimize Based on Data**:
   - Adjust email templates if needed
   - Tune rate limits based on traffic
   - Add additional monitoring if required

3. **Document Issues**:
   - Keep a log of any issues encountered
   - Update this guide with solutions

---

**Last Updated**: January 13, 2025  
**Status**: Ready for Production Deployment

For detailed technical information, see `AUTH_EMAIL_SETUP.md`
