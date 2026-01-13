## Email Verification Setup Guide (Supabase - FREE)

### ✅ What's Already Implemented

Your Auth.tsx now includes:
- **Email verification** via Supabase Auth (built-in, FREE)
- **Password reset** via Supabase Auth (built-in, FREE)
- **Email validation** (@gla.ac.in domain only)
- **Password validation** (minimum 6 characters)
- **Auto-profile creation** (new users get MEMBER role)

### 🔧 Supabase Configuration (One-time setup)

#### Step 1: Enable Email Verification in Supabase Dashboard

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Click **Email**
3. Enable **Confirm email**
4. Set **Confirmation email template** (optional - Supabase has default)

#### Step 2: Configure Email Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your redirect URLs:
   ```
   http://localhost:5173/auth
   https://yourdomain.com/auth
   ```

#### Step 3: Set Email Templates (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Customize:
   - **Confirm signup** - Verification email
   - **Reset password** - Password reset email
   - **Magic link** - (not used, but available)

### 📧 How It Works (Automatic)

**Signup Flow:**
1. User signs up with @gla.ac.in email
2. Supabase sends verification email (FREE)
3. User clicks link in email
4. Account is verified
5. User can login

**Password Reset Flow:**
1. User clicks "Forgot Password?"
2. Enters email
3. Supabase sends reset link (FREE)
4. User clicks link
5. Sets new password

### 🎯 Key Features

✅ **Completely FREE** - No third-party email service needed
✅ **Built-in** - No additional setup required
✅ **Secure** - Supabase handles all security
✅ **Automatic** - Emails sent automatically
✅ **Customizable** - Email templates can be modified

### 🚀 Testing Locally

For local testing without real emails:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Manually confirm users by clicking the user and setting email_confirmed_at
3. Or use Supabase CLI for testing

### 📝 Environment Variables (Already Set)

Your `.env.local` should have:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### ✨ What Happens After Signup

1. User creates account with @gla.ac.in email
2. Profile automatically created with:
   - `app_role: "MEMBER"`
   - `year: current_year`
   - Other fields: null
3. Verification email sent
4. After verification, user can login
5. Redirected to /events (MEMBER default)

### 🔒 Security Notes

- Passwords are hashed by Supabase (bcrypt)
- Email verification prevents fake emails
- Password reset tokens expire after 1 hour
- All handled server-side (secure)

### 📞 Support

If emails aren't sending:
1. Check Supabase Dashboard → **Logs** → **Auth**
2. Verify email templates are configured
3. Check redirect URLs are correct
4. Ensure SMTP is enabled (it is by default)

### 🎨 Customization

To customize email templates:
1. Dashboard → **Authentication** → **Email Templates**
2. Edit HTML/text
3. Use variables like `{{ .ConfirmationURL }}`
4. Save changes

That's it! Email verification is now fully functional and FREE.