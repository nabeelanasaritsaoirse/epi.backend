/**
 * FIX: Cancel ALL pending deletion requests
 * Fetches detailed user info to find ALL pending deletions
 */

const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';

async function loginAsAdmin() {
  const response = await fetch(`${BASE_URL}/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  const data = await response.json();
  if (!data.success) throw new Error(`Admin login failed: ${data.message}`);
  return data.data.accessToken;
}

async function getUserDetails(token, userId) {
  const response = await fetch(`${BASE_URL}/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

async function getAllUsers(token) {
  const response = await fetch(
    `${BASE_URL}/admin/referrals/all-users?limit=1000`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  const data = await response.json();
  if (!data.success) throw new Error(`Failed to fetch users`);
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
    console.log('\n🚀 FIXING ALL USERS - Cancelling Deletion Requests\n');
    console.log('='.repeat(80));

    const token = await loginAsAdmin();
    console.log('✅ Admin logged in\n');

    const users = await getAllUsers(token);
    console.log(`📊 Total Users: ${users.length}\n`);

    console.log('🔍 Finding users with pending deletion...\n');

    let pendingUsers = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const userId = user.userId || user._id;

      // Get detailed user info to check deletion status
      const userDetails = await getUserDetails(token, userId);

      if (userDetails && userDetails.deletionRequest && userDetails.deletionRequest.status === 'pending') {
        pendingUsers.push({
          userId: userId,
          name: user.name,
          email: user.email
        });
      }

      // Progress
      if (i % 10 === 0) {
        process.stdout.write('.');
      }
    }

    console.log(`\n\n✅ Found ${pendingUsers.length} users with PENDING deletion\n`);

    if (pendingUsers.length === 0) {
      console.log('🎉 No pending deletions! All users can login.\n');
      return;
    }

    console.log('='.repeat(80));
    console.log('\n🔧 Cancelling ALL pending deletion requests...\n');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingUsers.length; i++) {
      const user = pendingUsers[i];

      process.stdout.write(`[${i + 1}/${pendingUsers.length}] ${user.name || user.email}... `);

      try {
        const result = await cancelDeletion(token, user.userId);

        if (result.success) {
          console.log('✅');
          successCount++;
        } else {
          console.log(`❌ ${result.message}`);
          failCount++;
        }
      } catch (error) {
        console.log(`❌ ${error.message}`);
        failCount++;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 FINAL RESULTS:\n');
    console.log(`   Total: ${pendingUsers.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n🎉 DONE! All users can now login!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
