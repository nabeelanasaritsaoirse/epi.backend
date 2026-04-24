/**
 * Check all users and their deletion request status
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
  if (!data.success) throw new Error(`Failed to fetch users: ${data.message}`);
  return data.data.users || [];
}

async function main() {
  try {
    console.log('\n🔍 Checking ALL Users Login Status\n');
    console.log('='.repeat(80));

    const token = await loginAsAdmin();
    console.log('✅ Admin logged in\n');

    const users = await getAllUsers(token);
    console.log(`📊 Total Users: ${users.length}\n`);

    let pendingCount = 0;
    let cancelledCount = 0;
    let noRequestCount = 0;
    let completedCount = 0;

    const pendingUsers = [];
    const cancelledUsers = [];

    console.log('🔍 Checking each user...\n');

    for (const user of users) {
      const userId = user.userId || user._id;

      // Get detailed user info
      const userDetails = await getUserDetails(token, userId);

      if (userDetails && userDetails.deletionRequest) {
        const status = userDetails.deletionRequest.status;

        if (status === 'pending') {
          pendingCount++;
          pendingUsers.push({
            name: user.name,
            email: user.email,
            phone: user.phoneNumber,
            userId: userId
          });
        } else if (status === 'cancelled') {
          cancelledCount++;
          cancelledUsers.push({
            name: user.name,
            email: user.email,
            userId: userId
          });
        } else if (status === 'completed') {
          completedCount++;
        }
      } else {
        noRequestCount++;
      }

      // Progress indicator
      if (users.indexOf(user) % 10 === 0) {
        process.stdout.write('.');
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   ✅ No Deletion Request: ${noRequestCount}`);
    console.log(`   🟡 Cancelled Deletion: ${cancelledCount}`);
    console.log(`   ✅ Completed Deletion: ${completedCount}`);
    console.log(`   ❌ PENDING Deletion: ${pendingCount}\n`);

    if (pendingUsers.length > 0) {
      console.log('❌ USERS WITH PENDING DELETION (cannot login):\n');
      pendingUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'N/A'}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Phone: ${user.phone || 'N/A'}`);
        console.log(`   User ID: ${user.userId}`);
        console.log('');
      });

      console.log('\n🔧 To fix, run:');
      console.log('   node scripts/revokeAllDeletionRequests.js\n');
    } else {
      console.log('✅ All users can login! No pending deletions found.\n');
    }

    if (cancelledUsers.length > 0) {
      console.log(`\n🟡 Users with CANCELLED deletion (${cancelledUsers.length}):`);
      console.log('   These users can login normally.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

main();
