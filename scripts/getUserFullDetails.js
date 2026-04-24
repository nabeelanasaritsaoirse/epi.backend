/**
 * Get Full User Details including deletionRequest field
 */

const BASE_URL = 'https://api.epielio.com/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function main() {
  const phone = process.argv[2] || '7994374844';

  try {
    // Login as admin
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;

    // Search for user first
    const searchRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=${phone}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const searchData = await searchRes.json();
    const user = searchData.data?.users?.find(u => u.phoneNumber === phone);

    if (!user) {
      console.log('User not found');
      return;
    }

    const userId = user.userId || user._id;
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`ID: ${userId}\n`);

    // Try different admin endpoints to get full user details
    console.log('=== Checking user via different endpoints ===\n');

    // Try referral details endpoint (might have more fields)
    console.log('1. Referral details endpoint:');
    const refRes = await fetch(`${BASE_URL}/admin/referrals/user/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (refRes.status === 200) {
      const refData = await refRes.json();
      if (refData.data?.user?.deletionRequest) {
        console.log('   ⚠️  DELETION REQUEST FOUND:');
        console.log('   ', JSON.stringify(refData.data.user.deletionRequest, null, 2));
      } else {
        console.log('   ✅ No deletion request');
      }

      console.log('   Full user object keys:', Object.keys(refData.data?.user || {}));
    } else {
      console.log('   Status:', refRes.status);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
