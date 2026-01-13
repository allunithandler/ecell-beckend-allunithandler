# Email Testing Utilities

## Overview

This document describes the testing utilities created to verify the email system is working correctly.

---

## Testing Methods

### Method 1: EmailTest Component (Frontend)

A React component that provides a user-friendly interface for testing email sending.

#### Location
- **Component**: `src/components/EmailTest.tsx`
- **Page**: `src/pages/EmailTestPage.tsx`

#### Usage

1. **Add to Router** (if not already added):
   ```typescript
   // In your App.tsx or router configuration
   import EmailTestPage from "@/pages/EmailTestPage";
   
   // Add route
   <Route path="/email-test" element={<EmailTestPage />} />
   ```

2. **Access the page**:
   ```
   http://localhost:5173/email-test
   ```

3. **Send a test email**:
   - Enter your email address
   - Click "Send Test Email"
   - Check your inbox (and spam folder)

#### Features

- ✅ User-friendly form interface
- ✅ Real-time feedback and error handling
- ✅ System status display
- ✅ Email flow visualization
- ✅ Links to documentation
- ✅ Toast notifications for success/error

---

### Method 2: Database Test Function

A SQL function that can be called directly to test email sending.

#### Function Signature

```sql
public.test_send_email(test_email TEXT) RETURNS JSONB
```

#### Usage

**Via SQL Editor** (Supabase Dashboard):

```sql
-- Send a test email
SELECT public.test_send_email('your-email@example.com');
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "recipient": "your-email@example.com",
  "result": {
    "success": true,
    "request_id": 123456
  }
}
```

**Via JavaScript/TypeScript**:

```typescript
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.rpc('test_send_email', {
  test_email: 'your-email@example.com'
});

if (error) {
  console.error("Test failed:", error);
} else {
  console.log("Test result:", data);
}
```

---

### Method 3: Direct Edge Function Test

Test the edge function directly via HTTP request.

#### Using cURL

```bash
curl -X POST https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "to": "test@example.com",
    "subject": "Direct Edge Function Test",
    "html": "<html><body><h1>Test Email</h1><p>This is a test.</p></body></html>"
  }'
```

#### Using Postman/Insomnia

1. **Method**: POST
2. **URL**: `https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email`
3. **Headers**:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_ANON_KEY
   ```
4. **Body** (JSON):
   ```json
   {
     "to": "test@example.com",
     "subject": "Edge Function Test",
     "html": "<html><body><h1>Test</h1></body></html>"
   }
   ```

#### Using JavaScript

```javascript
const response = await fetch(
  'https://hcaowhapblcxrpwymyes.supabase.co/functions/v1/send-email',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_ANON_KEY',
    },
    body: JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<h1>Test</h1>',
    }),
  }
);

const result = await response.json();
console.log(result);
```

---

## Test Email Template

The test function sends an email with the following template:

### Subject
```
E-Cell GLA Email System Test
```

### Content
- ✅ E-Cell GLA branding (orange gradient header)
- ✅ Success confirmation message
- ✅ Test details (recipient, timestamp, system info)
- ✅ Professional styling

### Preview

```
┌─────────────────────────────────┐
│     🚀 E-Cell GLA Email Test    │
│  Entrepreneurship Cell - GLA    │
└─────────────────────────────────┘

✅ Email system is working correctly!

This is a test email sent from the 
E-Cell GLA application.

Test Details:
• Sent to: your-email@example.com
• Timestamp: 2025-01-13 15:30:00
• System: Supabase + Resend

If you received this email, your email
configuration is working properly.
```

---

## Verification Checklist

After sending a test email, verify the following:

### ✅ Email Received
- [ ] Email arrived in inbox
- [ ] Subject line is correct
- [ ] Sender shows "E-Cell GLA <noreply@ecell-gla.com>"
- [ ] HTML renders correctly
- [ ] No images broken
- [ ] Links work (if any)

### ✅ Email Headers
Check email headers for:
- [ ] SPF: PASS
- [ ] DKIM: PASS
- [ ] DMARC: PASS

### ✅ Delivery Time
- [ ] Email received within 30 seconds
- [ ] No delay notifications

### ✅ Spam Check
- [ ] Email NOT in spam folder
- [ ] No spam warnings
- [ ] Sender reputation good

---

## Troubleshooting Test Failures

### Test Email Not Received

**1. Check Spam Folder**
- Look in spam/junk folder
- Mark as "Not Spam" if found

**2. Check Resend Dashboard**
- Go to: https://resend.com/emails
- Look for recent sends
- Check delivery status

**3. Check Edge Function Logs**
```bash
# Via Supabase CLI
supabase functions logs send-email

# Or in Supabase Dashboard:
# Edge Functions → send-email → Logs
```

**4. Verify Domain**
```bash
# Check DNS records
dig TXT ecell-gla.com
dig TXT resend._domainkey.ecell-gla.com
```

### Database Function Returns Error

**Check Permissions**:
```sql
-- Verify permissions
SELECT grantee, privilege_type 
FROM information_schema.routine_privileges
WHERE routine_name = 'test_send_email';
```

**Check Function Exists**:
```sql
-- List all custom functions
SELECT 
  n.nspname as schema,
  p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%email%';
```

### Edge Function Returns 500

**Check Environment Variables**:
```bash
# List secrets
supabase secrets list
```

**Verify API Key**:
```bash
# Test Resend API directly
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@ecell-gla.com",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<p>Test</p>"
  }'
```

---

## Automated Testing Script

For CI/CD pipelines or automated testing:

```bash
#!/bin/bash
# test-email.sh

# Configuration
SUPABASE_URL="https://hcaowhapblcxrpwymyes.supabase.co"
ANON_KEY="your-anon-key"
TEST_EMAIL="test@example.com"

echo "Testing email system..."

# Test edge function
response=$(curl -s -X POST "$SUPABASE_URL/functions/v1/send-email" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Automated Test\",
    \"html\": \"<h1>Test</h1>\"
  }")

# Check response
if echo "$response" | grep -q "success"; then
  echo "✅ Email test passed"
  exit 0
else
  echo "❌ Email test failed"
  echo "$response"
  exit 1
fi
```

**Usage**:
```bash
chmod +x test-email.sh
./test-email.sh
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Email System

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  test-email:
    runs-on: ubuntu-latest
    steps:
      - name: Test Email Function
        run: |
          response=$(curl -s -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/send-email" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -d '{
              "to": "${{ secrets.TEST_EMAIL }}",
              "subject": "CI Test",
              "html": "<h1>CI Test</h1>"
            }')
          
          if echo "$response" | grep -q "success"; then
            echo "✅ Email test passed"
          else
            echo "❌ Email test failed"
            exit 1
          fi
```

---

## Performance Testing

### Load Test Script

Test how the system handles multiple emails:

```javascript
// load-test.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hcaowhapblcxrpwymyes.supabase.co',
  'YOUR_ANON_KEY'
);

async function sendTestEmail(index) {
  const { data, error } = await supabase.rpc('test_send_email', {
    test_email: `test${index}@example.com`
  });
  
  if (error) {
    console.error(`❌ Email ${index} failed:`, error);
  } else {
    console.log(`✅ Email ${index} sent`);
  }
}

async function runLoadTest(count) {
  console.log(`Starting load test with ${count} emails...`);
  const start = Date.now();
  
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(sendTestEmail(i));
  }
  
  await Promise.all(promises);
  
  const duration = Date.now() - start;
  console.log(`\nCompleted in ${duration}ms`);
  console.log(`Average: ${duration / count}ms per email`);
}

// Test with 10 emails
runLoadTest(10);
```

**Run**:
```bash
node load-test.js
```

---

## Monitoring Test Results

### Create Dashboard Query

```sql
-- Email test history
CREATE TABLE IF NOT EXISTS public.email_test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response JSONB,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to log test results
CREATE OR REPLACE FUNCTION public.test_send_email_with_logging(test_email TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  success BOOLEAN;
BEGIN
  result := public.test_send_email(test_email);
  success := (result->>'success')::BOOLEAN;
  
  INSERT INTO public.email_test_history (test_email, success, response)
  VALUES (test_email, success, result);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View test statistics
SELECT 
  DATE(tested_at) as date,
  COUNT(*) as total_tests,
  COUNT(*) FILTER (WHERE success) as successful,
  COUNT(*) FILTER (WHERE NOT success) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 2) as success_rate
FROM email_test_history
GROUP BY DATE(tested_at)
ORDER BY date DESC
LIMIT 30;
```

---

## Best Practices

### Development
- ✅ Use personal email addresses for testing
- ✅ Test before committing auth changes
- ✅ Check both inbox and spam folder
- ✅ Verify email formatting on mobile and desktop

### Staging
- ✅ Test with multiple email providers (Gmail, Outlook, etc.)
- ✅ Verify all email types (confirmation, reset, etc.)
- ✅ Test with different browsers
- ✅ Check email delivery times

### Production
- ✅ Monitor email delivery rates daily
- ✅ Set up alerts for failed sends
- ✅ Test email system weekly
- ✅ Keep Resend API key rotated (every 90 days)

---

## Quick Reference

| Method | Use Case | Speed | Access Level |
|--------|----------|-------|--------------|
| EmailTest Component | Manual testing, demos | Fast | Authenticated users |
| Database Function | Quick tests, debugging | Fast | Database access |
| Edge Function | Integration testing | Fast | Anyone with API key |
| Load Test Script | Performance testing | Slow | Developers only |

---

**Last Updated**: January 13, 2025  
**Status**: Ready for Use

For more information, see:
- `AUTH_EMAIL_SETUP.md` - Complete system documentation
- `TEST_AUTH_FLOW.md` - Manual testing procedures
- `PRODUCTION_SETUP.md` - Production deployment guide
