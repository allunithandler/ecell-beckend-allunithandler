# Test Authentication Flow

## Manual Testing Guide

### Prerequisites
- ✅ Edge function `send-email` is deployed and active
- ✅ Database triggers are created
- ✅ Frontend auth client is configured
- ✅ Resend API key is valid

### Test 1: Complete Signup Flow

#### Step 1: Start Signup
```
1. Navigate to: http://localhost:5173/auth (or your app URL)
2. Click "Create New Account"
3. Expected: Signup form appears
```

#### Step 2: Fill Signup Form
```
Email: test-user-${Date.now()}@example.com (use unique email)
Password: TestPass123! (min 6 chars)
Confirm Password: TestPass123!

Click "Sign Up"
```

#### Step 3: Verify Success
```
Expected:
- Toast message: "Signup successful! Check your email to verify your account."
- Page changes to "Verify Email" mode
- Form fields are cleared

Check browser console:
- No errors should appear
- Should see Supabase auth request succeed
```

#### Step 4: Check Database
```sql
-- Run in Supabase SQL Editor
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmation_token IS NOT NULL as has_token,
  created_at
FROM auth.users 
WHERE email LIKE '%test-user%'
ORDER BY created_at DESC 
LIMIT 1;

Expected:
- User exists
- email_confirmed_at is NULL (not confirmed yet)
- has_token is true
- created_at is recent
```

#### Step 5: Check Profile Created
```sql
-- Run in Supabase SQL Editor
SELECT 
  p.id,
  p.user_id,
  p.role,
  p.ecell_id,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email LIKE '%test-user%'
ORDER BY p.created_at DESC 
LIMIT 1;

Expected:
- Profile exists
- role is 'MEMBER'
- ecell_id is auto-generated (e.g., ECELL25-001)
- Linked to correct user
```

#### Step 6: Check Email Sent
```
Method 1 - Check Supabase Logs:
1. Go to Supabase Dashboard
2. Navigate to Database → Postgres Logs
3. Filter for: "Confirmation email sent"
4. Should see log entry with email address

Method 2 - Check Resend Dashboard:
1. Login to resend.com
2. Navigate to Emails → Logs
3. Should see recent email to test user
4. Status should be "sent" or "delivered"

Method 3 - Check Email Inbox:
1. If using real email, check inbox
2. Look for email from "E-Cell GLA <noreply@ecell-gla.com>"
3. Subject: "Verify Your E-Cell GLA Account"
```

#### Step 7: Click Email Confirmation Link
```
1. Open confirmation email
2. Click "Verify Email Address" button (or copy link)
3. Expected: Browser opens and redirects to /auth
4. Should see toast: "Successfully signed in!"
5. Should redirect to dashboard
```

#### Step 8: Verify Confirmed Status
```sql
-- Run in Supabase SQL Editor
SELECT 
  email,
  email_confirmed_at,
  confirmed_at,
  last_sign_in_at
FROM auth.users 
WHERE email LIKE '%test-user%'
ORDER BY created_at DESC 
LIMIT 1;

Expected:
- email_confirmed_at is NOT NULL (timestamp of confirmation)
- confirmed_at is NOT NULL
- last_sign_in_at is recent
```

---

### Test 2: Login Flow

#### Step 1: Logout (if logged in)
```
1. Click profile/logout button
2. Or clear localStorage: Application → Local Storage → Clear All
3. Refresh page
4. Should redirect to /auth
```

#### Step 2: Login
```
1. Enter email from Test 1
2. Enter password from Test 1
3. Click "Sign In"
4. Expected:
   - Toast: "Logged in successfully!"
   - Redirect to dashboard based on role
   - Session persists in localStorage
```

#### Step 3: Verify Session
```
1. Open DevTools → Application → Local Storage
2. Look for key starting with "supabase.auth.token"
3. Should contain access_token, refresh_token, etc.
4. Refresh page - should stay logged in
```

#### Step 4: Test Auto-Refresh
```
1. Stay logged in for a few minutes
2. Perform an action (navigate, click something)
3. Check network tab for auth refresh requests
4. Should NOT see "Refresh Token Not Found" errors
5. Session should remain active
```

---

### Test 3: Password Reset Flow

#### Step 1: Request Reset
```
1. Logout if logged in
2. Go to /auth
3. Click "Forgot Password?"
4. Enter email from Test 1
5. Click "Send Reset Link"
6. Expected:
   - Toast: "Password reset email sent! Check your inbox."
   - Returns to login screen
```

#### Step 2: Check Email Sent
```
Method 1 - Check Database Logs:
SELECT * FROM postgres_logs 
WHERE message LIKE '%Recovery email sent%'
ORDER BY timestamp DESC 
LIMIT 5;

Method 2 - Check Resend Dashboard:
Look for email with subject "Reset Your E-Cell GLA Password"

Method 3 - Check Inbox:
Look for password reset email
```

#### Step 3: Click Reset Link
```
1. Open password reset email
2. Click "Reset Password" button
3. Expected:
   - Redirects to /auth
   - Toast: "Please enter your new password"
   - Shows password reset form (or triggers PASSWORD_RECOVERY event)
```

#### Step 4: Set New Password
```
1. Enter new password (e.g., NewPass456!)
2. Confirm new password
3. Submit form
4. Expected:
   - Password updated successfully
   - Can log in with new password
```

#### Step 5: Login with New Password
```
1. Enter email
2. Enter new password (NewPass456!)
3. Click "Sign In"
4. Expected: Successful login
```

---

### Test 4: Error Handling

#### Test Invalid Email
```
1. Go to signup
2. Enter invalid email: "notanemail"
3. Try to submit
4. Expected: Validation error
```

#### Test Password Mismatch
```
1. Go to signup
2. Enter password: "Pass123"
3. Enter confirm: "DifferentPass"
4. Try to submit
5. Expected: "Passwords do not match" error
```

#### Test Existing Email
```
1. Go to signup
2. Enter email from Test 1 (already exists)
3. Try to submit
4. Expected: Error from Supabase about duplicate user
```

#### Test Wrong Password
```
1. Go to login
2. Enter correct email
3. Enter wrong password
4. Try to login
5. Expected: "Invalid login credentials" error
```

---

## Automated Test Scenarios

### Test Email Trigger Directly
```sql
-- Test confirmation email function
DO $$
DECLARE
  result JSONB;
BEGIN
  result := public.send_auth_email(
    'test@example.com',
    'Test Email',
    '<html><body><h1>Test</h1></body></html>',
    'confirmation'
  );
  
  RAISE NOTICE 'Email result: %', result;
END $$;

-- Check result in logs
-- Expected: Should see request_id in result
```

### Test Edge Function Directly
```bash
# Using curl
curl -X POST https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYW93aGFwYmxjeHJwd3lteWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODczMzgsImV4cCI6MjA3Nzg2MzMzOH0.oICKiUSdib07RXPeTjAIOi9RxM40WsCVL9NrsBJ_GU0" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email",
    "html": "<html><body><h1>Test from Edge Function</h1></body></html>"
  }'

# Expected response:
# {"success": true, "id": "...resend-email-id..."}
```

---

## Troubleshooting

### Issue: Signup returns 500 error
**Debug Steps:**
1. Check edge function logs:
   ```bash
   supabase functions logs send-email
   ```
2. Check database trigger logs in Supabase Dashboard
3. Verify edge function is active
4. Test edge function directly (see automated test above)

**Common Causes:**
- Edge function not deployed
- Resend API key invalid
- Network issues

---

### Issue: Email not received
**Debug Steps:**
1. Check Resend dashboard for delivery status
2. Check spam folder
3. Verify domain `ecell-gla.com` is configured in Resend
4. Check database logs for trigger execution
5. Test edge function directly

**Common Causes:**
- Email in spam
- Domain not verified in Resend
- Trigger didn't fire
- pg_net request failed

---

### Issue: Refresh token not found
**Debug Steps:**
1. Check browser localStorage for supabase.auth.token
2. Verify client config has:
   - `persistSession: true`
   - `autoRefreshToken: true`
   - `storage: localStorage`
3. Check for any errors in browser console
4. Clear localStorage and re-login

**Common Causes:**
- localStorage disabled
- Client config incorrect
- Token expired and refresh failed

---

### Issue: Confirmation link doesn't work
**Debug Steps:**
1. Copy full URL from email
2. Check query parameters: ?token=...&type=signup
3. Verify redirect_to URL is correct
4. Check if token has expired (24 hours)
5. Verify detectSessionInUrl is true in client config

**Common Causes:**
- Token expired
- Wrong redirect URL
- detectSessionInUrl not enabled
- Token malformed

---

## Success Criteria

All tests should pass with these results:

✅ Signup creates user in auth.users  
✅ Profile automatically created in profiles table  
✅ Confirmation email sent via Resend  
✅ Email link confirms user and logs them in  
✅ Login works with confirmed credentials  
✅ Session persists after page refresh  
✅ Password reset email sent  
✅ Password reset link works  
✅ Can login with new password  
✅ No "Refresh Token Not Found" errors  
✅ Auto token refresh works  

---

## Monitoring

### Check Health
```sql
-- Count recent signups
SELECT COUNT(*) as signups_today
FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 day';

-- Count confirmed users
SELECT COUNT(*) as confirmed_users
FROM auth.users 
WHERE email_confirmed_at IS NOT NULL;

-- Check recent email triggers
SELECT 
  COUNT(*) as email_triggers_today
FROM postgres_logs 
WHERE message LIKE '%email sent%' 
  AND timestamp > NOW() - INTERVAL '1 day';
```

### Performance
```sql
-- Check slow auth operations
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements 
WHERE query LIKE '%auth.users%'
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

---

**Last Updated:** January 13, 2025  
**Status:** Ready for testing
