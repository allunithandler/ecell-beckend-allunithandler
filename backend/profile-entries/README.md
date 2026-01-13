# Bulk Account Registration System

## Overview

This backend-only system creates multiple user accounts in Supabase Auth and minimal profile entries in the database. It is designed for one-time bulk onboarding of 40+ users.

## ⚠️ SECURITY WARNINGS

- **NEVER** expose the service role key to frontend code
- **NEVER** commit the service role key to version control
- **NEVER** log passwords in console output
- This script has admin privileges - use with extreme caution
- Run only in secure, controlled environments

## Folder Structure

```
backend/profile-entries/
├── data/
│   └── users.js          # User data input file
├── bulkRegister.js       # Main registration script
└── README.md            # This file
```

## How to Add Users

1. Edit `data/users.js`
2. Add user objects following this format:

```javascript
{
  email: "user.name_dept25@gla.ac.in",
  password: "temp123pass",
  app_role: "MEMBER", // MEMBER | COMMITTEE | MENTOR
}
```

### Password Rules
- Length ≤ 10 characters
- Must include letters + numbers
- Easy to remember
- Treated as temporary (users should change after first login)

## How to Run

### Prerequisites
1. Install Node.js dependencies:
```bash
npm install @supabase/supabase-js
```

2. Set environment variables:
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Execute Script
```bash
node backend/profile-entries/bulkRegister.js
```

## What the Script Does

For each user in `users.js`:

1. **Creates Auth User**:
   - Email and password
   - Auto-confirms email (`email_confirm: true`)
   - Uses Supabase Admin API

2. **Creates Profile Entry**:
   - Links to auth user via `user_id`
   - Sets `app_role`
   - Leaves `ecell_id` as null (assigned later)
   - Leaves optional fields empty (completed by user later)

3. **Error Handling**:
   - Skips existing emails
   - Continues on individual failures
   - Logs detailed results

## Verification

After running the script, verify in Supabase:

```sql
-- Check auth users
SELECT email FROM auth.users;

-- Check profiles
SELECT email, app_role FROM profiles;
```

## What This System Does NOT Handle

- ❌ E-Cell ID assignment (reserved ECELL25-001 → ECELL25-050)
- ❌ Profile completion (name, phone, etc.)
- ❌ Photo uploads
- ❌ Department assignments
- ❌ Password strength enforcement beyond basic rules
- ❌ Email validation beyond format
- ❌ Cleanup of failed partial registrations

## One-Time Usage Warning

This script is designed for initial bulk onboarding. For ongoing user management:
- Use the frontend registration flow
- Use Supabase Dashboard for individual users
- Consider implementing proper user management APIs

## Immediate Login Capability

✅ Users can log in immediately after script completion
✅ Minimal profiles allow basic app functionality
✅ Users can complete their profiles after first login

## Security Notes

- Service role key grants full database access
- Script bypasses RLS policies
- Passwords are transmitted securely via Supabase Auth API
- No passwords are stored in the database
- Email confirmation is handled automatically