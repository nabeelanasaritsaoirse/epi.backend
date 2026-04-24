/**
 * Verify Deep user status via Admin API
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
  if (!data.success) throw new Error(`Admin login failed: ${data.message}`);

  console.log('✅ Admin logged in\n');
  return data.data.accessToken;
}

async function getUserDetails(token, userId) {
  console.log(`🔍 Fetching user details for ID: ${userId}\n`);

  const response = await fetch(`${BASE_URL}/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return response.json();
}

async function cancelDeletionAgain(token, userId) {
  console.log(`🔧 Attempting to cancel deletion for user: ${userId}\n`);

  const response = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();
  console.log('Cancel Deletion Response:', JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  try {
    const token = await loginAsAdmin();

    // The user ID we found earlier
    const userId = '6953ba1dad6010200641a51a';

    // Get user details
    const userResult = await getUserDetails(token, userId);
    console.log('📋 User Details from API:');
    console.log(JSON.stringify(userResult, null, 2));
    console.log('\n');

    // Check deletion request status
    if (userResult.success && userResult.data) {
      const user = userResult.data;
      console.log('🔍 Deletion Request Status:');

      if (user.deletionRequest) {
        console.log('   Status:', user.deletionRequest.status);
        console.log('   Requested At:', user.deletionRequest.requestedAt);
        console.log('   Scheduled For:', user.deletionRequest.scheduledDeletionDate);
        console.log('   Cancelled At:', user.deletionRequest.cancelledAt || 'N/A');

        if (user.deletionRequest.status === 'pending') {
          console.log('\n❌ PROBLEM: Deletion is still PENDING!\n');

          // Try to cancel it again
          const cancelResult = await cancelDeletionAgain(token, userId);

          if (cancelResult.success) {
            console.log('\n✅ Deletion cancelled successfully!');

            // Verify again
            console.log('\n🔍 Verifying...');
            const verifyResult = await getUserDetails(token, userId);
            if (verifyResult.data.deletionRequest) {
              console.log('❌ Still has deletion request:', verifyResult.data.deletionRequest);
            } else {
              console.log('✅ Deletion request removed!');
            }
          }
        } else {
          console.log('\n✅ Deletion status is:', user.deletionRequest.status);
        }
      } else {
        console.log('   ✅ No deletion request found!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
