# Manual Bulk Registration Guide

Since automated execution is not possible, follow these steps:

## Step 1: Install Dependencies (On Your Machine)

```bash
cd backend/profile-entries
npm install
```

## Step 2: Set Environment Variables (Windows)

```cmd
set SUPABASE_URL=https://hcaowhapblcxrpwymyes.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your-regenerated-key-here
```

## Step 3: Run the Script

```bash
node bulkRegister.js
```

## Alternative: Manual Dashboard Method

For each user in `data/users.js`:

1. **Create Auth User:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add user"
   - Enter email: `ansh.varshney_bca25@gla.ac.in`
   - Enter password: `leaf42dash9`
   - Check "Auto Confirm User"
   - Click "Create user"

2. **Verify Profile Created:**
   - Go to Database → profiles table
   - Check if profile was auto-created by trigger
   - If not, manually insert with user_id and app_role

3. **Repeat for all users**

## Users to Register

From `data/users.js`:
- ansh.varshney_bca25@gla.ac.in (password: leaf42dash9, role: MEMBER)
- riya.tewatia_cs25@gla.ac.in (password: leaf13river, role: MEMBER)

## Security Reminder

⚠️ REGENERATE your service role key immediately after use
⚠️ Never share service role keys publicly again