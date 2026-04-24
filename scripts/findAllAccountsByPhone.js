/**
 * Find ALL accounts with a given phone number
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

    console.log(`Searching for ALL accounts with phone: ${phone}\n`);

    // Search with phone - get more results
    const searchRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=${phone}&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const searchData = await searchRes.json();
    const allUsers = searchData.data?.users || [];

    console.log(`Total results: ${allUsers.length}\n`);

    // Filter for EXACT phone match (not partial)
    const matchingUsers = allUsers.filter(u => u.phoneNumber === phone);

    if (matchingUsers.length === 0) {
      console.log('No users found with this exact phone number');
      return;
    }

    console.log(`Found ${matchingUsers.length} account(s) with phone ${phone}:\n`);

    for (let i = 0; i < matchingUsers.length; i++) {
      const user = matchingUsers[i];
      const userId = user.userId || user._id;

      console.log(`--- Account ${i + 1} ---`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phoneNumber}`);
      console.log(`  ID: ${userId}`);
      console.log(`  Referral Code: ${user.referralCode}`);
      console.log(`  Joined: ${user.joinedAt || user.createdAt || 'N/A'}`);

      // Check this user's deletion status via the referral endpoint
      const refRes = await fetch(`${BASE_URL}/admin/referrals/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (refRes.status === 200) {
        const refData = await refRes.json();
        if (refData.data?.user?.deletionRequest) {
          console.log(`  🚨 DELETION REQUEST: ${refData.data.user.deletionRequest.status}`);
          console.log(`     Requested at: ${refData.data.user.deletionRequest.requestedAt}`);
        } else {
          console.log(`  ✅ No deletion request`);
        }
      }

      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
