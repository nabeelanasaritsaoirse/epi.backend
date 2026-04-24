/**
 * Cancel Deletion Request for deep.it.saoirse@gmail.com on DEV server
 */

const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';

async function loginAsAdmin() {
  console.log('🔐 Logging in as admin to dev server...');

  const response = await fetch(`${BASE_URL}/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Admin login failed: ${data.message}`);
  }

  console.log('✅ Admin login successful\n');
  return data.data.accessToken;
}

async function findUserByEmail(token, email) {
  console.log(`🔍 Searching for user: ${email}`);

  const response = await fetch(
    `${BASE_URL}/admin/referrals/all-users?search=${encodeURIComponent(email)}&limit=10`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();

  if (!data.success || !data.data?.users?.length) {
    return null;
  }

  // Find exact email match
  const user = data.data.users.find(u => u.email === email);
  return user;
}

async function cancelDeletion(token, userId) {
  console.log(`🔧 Cancelling deletion request for user ID: ${userId}`);

  const response = await fetch(
    `${BASE_URL}/users/admin/${userId}/cancel-deletion`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.json();
}

async function main() {
  const targetEmail = 'deep.it.saoirse@gmail.com';

  try {
    console.log('\n🚀 Starting deletion cancellation process...\n');

    // Step 1: Login as admin
    const token = await loginAsAdmin();

    // Step 2: Find user by email
    const user = await findUserByEmail(token, targetEmail);

    if (!user) {
      console.log('❌ User NOT FOUND with email:', targetEmail);
      console.log('   The user might not exist in the database.');
      process.exit(1);
    }

    const userId = user.userId || user._id;
    console.log(`✅ Found user:`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${userId}`);
    console.log(`   Deletion Status: ${user.deletionRequest?.status || 'none'}\n`);

    // Step 3: Cancel deletion request
    const result = await cancelDeletion(token, userId);

    if (result.success) {
      console.log('✅ SUCCESS! Deletion request CANCELLED');
      console.log('   User can now login normally.\n');
    } else {
      console.log(`❌ FAILED: ${result.message}`);
      console.log('   Error:', result);
    }

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error('   ', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

main();
