/**
 * Revoke ALL pending deletion requests on Dev Server
 * This will allow all users to login again
 */

const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';

async function loginAsAdmin() {
  console.log('🔐 Logging in as admin...\n');

  const response = await fetch(`${BASE_URL}/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Admin login failed: ${data.message}`);
  }

  console.log('✅ Admin logged in\n');
  return data.data.accessToken;
}

async function getAllUsers(token) {
  console.log('📋 Fetching all users...\n');

  // Fetch a large number of users (adjust limit as needed)
  const response = await fetch(
    `${BASE_URL}/admin/referrals/all-users?limit=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to fetch users: ${data.message}`);
  }

  return data.data.users || [];
}

async function cancelDeletion(token, userId) {
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
  try {
    console.log('\n🚀 Starting Mass Deletion Request Revocation\n');
    console.log('=' .repeat(70));

    // Step 1: Login as admin
    const token = await loginAsAdmin();

    // Step 2: Get all users
    const users = await getAllUsers(token);
    console.log(`✅ Found ${users.length} total users\n`);

    // Step 3: Filter users with pending deletion requests
    const usersWithPendingDeletion = users.filter(user =>
      user.deletionRequest && user.deletionRequest.status === 'pending'
    );

    if (usersWithPendingDeletion.length === 0) {
      console.log('✅ No users with pending deletion requests found!');
      console.log('   All users can login normally.\n');
      return;
    }

    console.log(`🔍 Found ${usersWithPendingDeletion.length} users with PENDING deletion requests:\n`);

    // Display the users
    usersWithPendingDeletion.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
      console.log(`   User ID: ${user.userId || user._id}`);
      console.log('');
    });

    console.log('=' .repeat(70));
    console.log('\n🔧 Cancelling all pending deletion requests...\n');

    // Step 4: Cancel each deletion request
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < usersWithPendingDeletion.length; i++) {
      const user = usersWithPendingDeletion[i];
      const userId = user.userId || user._id;

      process.stdout.write(`[${i + 1}/${usersWithPendingDeletion.length}] Cancelling for ${user.name || user.email}... `);

      try {
        const result = await cancelDeletion(token, userId);

        if (result.success) {
          console.log('✅ Success');
          successCount++;
        } else {
          console.log(`❌ Failed: ${result.message}`);
          failCount++;
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        failCount++;
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 FINAL RESULTS:\n');
    console.log(`   Total Users Processed: ${usersWithPendingDeletion.length}`);
    console.log(`   ✅ Successfully Cancelled: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n🎉 All pending deletion requests have been revoked!');
    console.log('   Users can now login normally.\n');

  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);
    process.exit(1);
  }
}

main();
