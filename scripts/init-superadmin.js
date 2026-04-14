/**
 * Kaizora - Super Admin Initialization Script
 *
 * Creates the protected Super Admin account in Supabase.
 * Run once: node scripts/init-superadmin.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPERADMIN = {
  email: 'chanuka.main@gmail.com',
  password: 'jaramaintern123$',
  username: 'J.IT.Intern',
  full_name: 'J.IT.Intern',
};

async function initSuperAdmin() {
  console.log('🚀 Initializing Kaizora Super Admin...\n');

  // ── Step 1: Create user in Supabase Auth ──────────────────────────────────
  console.log(`📧 Creating auth user: ${SUPERADMIN.email}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: SUPERADMIN.email,
    password: SUPERADMIN.password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: SUPERADMIN.full_name,
      username: SUPERADMIN.username,
    },
  });

  if (authError) {
    // If user already exists, try to find them instead
    if (authError.message.includes('already been registered')) {
      console.log('⚠️  Auth user already exists. Skipping creation, will update profile.\n');

      // Fetch existing user by email
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find(u => u.email === SUPERADMIN.email);

      if (!existingUser) {
        console.error('❌ Could not find existing user. Aborting.');
        process.exit(1);
      }

      await promoteSuperAdmin(existingUser.id);
    } else {
      console.error('❌ Failed to create auth user:', authError.message);
      process.exit(1);
    }
    return;
  }

  console.log(`✅ Auth user created: ${authData.user.id}\n`);
  await promoteSuperAdmin(authData.user.id);
}

async function promoteSuperAdmin(userId) {
  console.log(`👑 Promoting user ${userId} to superadmin...`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'superadmin',
      full_name: SUPERADMIN.full_name,
    })
    .eq('id', userId)
    .select()
    .single();

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError.message);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ SUCCESS — Super Admin account is ready!');
  console.log('═══════════════════════════════════════════════');
  console.log(`   ID       : ${profile.id}`);
  console.log(`   Username : ${profile.username}`);
  console.log(`   Email    : ${profile.email}`);
  console.log(`   Role     : ${profile.role}`);
  console.log('═══════════════════════════════════════════════\n');
  console.log('⚠️  IMPORTANT: This account is now UNTOUCHABLE.');
  console.log('   No other user can modify, ban, or delete it.\n');
}

initSuperAdmin();
