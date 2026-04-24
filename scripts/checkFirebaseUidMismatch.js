const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function check() {
  try {
    // Login as admin
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data.accessToken;

    console.log('=== CHECKING USER FROM REFERRALS API ===');
    const refRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=deep.it.saoirse@gmail.com&limit=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const refData = await refRes.json();

    console.log('API Response:', JSON.stringify(refData, null, 2));

    const users = refData.data?.users || [];
    console.log(`\nFound ${users.length} user(s)`);

    users.forEach((user, idx) => {
      console.log(`\n--- User #${idx + 1} ---`);
      console.log('User ID:', user.userId || user._id);
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('FirebaseUid:', user.firebaseUid || 'NOT IN API RESPONSE');
      console.log('Phone:', user.phoneNumber || 'empty');
      console.log('\nAll fields returned:');
      console.log(Object.keys(user));
    });

    // Expected Firebase UID from token
    console.log('\n=== EXPECTED FIREBASE UID ===');
    console.log('From token: 110704842393150561373');

    // Try to query user by the ID we found before
    const userId = '6953ba1dad6010200641a51a';
    console.log(`\n=== CHECKING IF WE NEED TO USE A DIFFERENT ENDPOINT ===`);
    console.log(`User ID we cancelled deletion for: ${userId}`);
    console.log('This user exists and deletion was cancelled.');
    console.log('But login still fails - this means either:');
    console.log('  1. User has wrong/different firebaseUid in database');
    console.log('  2. There are TWO users with same email but different firebaseUids');
    console.log('  3. The login flow is finding a different user');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
