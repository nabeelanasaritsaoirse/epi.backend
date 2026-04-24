/**
 * Debug Cancel Deletion - See full API response
 */

const BASE_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function main() {
  const phone = '7994374844';

  try {
    // Login as admin
    console.log('Step 1: Logging in as admin...');
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    const loginData = await loginRes.json();
    console.log('Login response:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      console.log('❌ Login failed');
      return;
    }

    const token = loginData.data.accessToken;
    console.log('\n✅ Admin token obtained\n');

    // Search for user
    console.log('Step 2: Searching for user...');
    const searchRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=${phone}&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const searchData = await searchRes.json();
    const user = searchData.data?.users?.find(u => u.phoneNumber === phone);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const userId = user.userId || user._id;
    console.log(`Found user: ${user.name} (ID: ${userId})\n`);

    // Try to cancel deletion
    console.log('Step 3: Calling cancel-deletion endpoint...');
    console.log(`URL: ${BASE_URL}/users/admin/${userId}/cancel-deletion\n`);

    const cancelRes = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', cancelRes.status);
    console.log('Response statusText:', cancelRes.statusText);

    const cancelData = await cancelRes.json();
    console.log('Response body:', JSON.stringify(cancelData, null, 2));

    // Try login as that user to see if it works
    console.log('\n\nStep 4: Testing user login with Firebase token...');
    console.log('(This would require a valid Firebase token for this user)');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
