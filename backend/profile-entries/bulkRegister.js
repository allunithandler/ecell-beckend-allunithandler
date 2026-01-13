import { createClient } from '@supabase/supabase-js';
import { users } from './data/users.js';

// Environment variables - NEVER expose service role key to frontend
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function bulkRegisterUsers() {
  console.log('🚀 Starting bulk user registration...');
  console.log(`📊 Total users to process: ${users.length}`);
  
  let totalAttempted = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const user of users) {
    totalAttempted++;
    
    try {
      console.log(`\n📧 Processing: ${user.email}`);
      
      // Validate required fields
      if (!user.email || !user.password || !user.app_role) {
        console.log(`❌ Skipping - Missing required fields`);
        totalSkipped++;
        continue;
      }

      // Validate app_role
      if (!['MEMBER', 'COMMITTEE', 'MENTOR'].includes(user.app_role)) {
        console.log(`❌ Skipping - Invalid app_role: ${user.app_role}`);
        totalSkipped++;
        continue;
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`⚠️  Skipping - Email already exists`);
          totalSkipped++;
          continue;
        } else {
          console.log(`❌ Auth creation failed: ${authError.message}`);
          totalFailed++;
          continue;
        }
      }

      if (!authData.user) {
        console.log(`❌ No user data returned from auth creation`);
        totalFailed++;
        continue;
      }

      // Create profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          app_role: user.app_role,
          ecell_id: null, // Will be assigned later if needed
        });

      if (profileError) {
        console.log(`❌ Profile creation failed: ${profileError.message}`);
        // Note: Auth user was created but profile failed
        // This should be handled manually or with cleanup script
        totalFailed++;
        continue;
      }

      console.log(`✅ Successfully created user`);
      totalCreated++;

    } catch (error) {
      console.log(`❌ Unexpected error: ${error.message}`);
      totalFailed++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 BULK REGISTRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total attempted: ${totalAttempted}`);
  console.log(`Total created:   ${totalCreated}`);
  console.log(`Total skipped:   ${totalSkipped}`);
  console.log(`Total failed:    ${totalFailed}`);
  console.log('='.repeat(50));

  if (totalCreated > 0) {
    console.log('\n✅ Registration completed successfully!');
    console.log('📝 Users can now log in immediately with their credentials.');
    console.log('📝 Profiles are minimal - users can complete them after login.');
  }

  if (totalFailed > 0) {
    console.log('\n⚠️  Some registrations failed. Check logs above for details.');
  }
}

// Run the bulk registration
bulkRegisterUsers()
  .then(() => {
    console.log('\n🏁 Script execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script execution failed:', error.message);
    process.exit(1);
  });