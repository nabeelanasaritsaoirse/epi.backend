/**
 * Check User Deletion Status
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
    if (!loginData.success) throw new Error('Admin login failed');

    const token = loginData.data.accessToken;

    // Search for user
    const searchRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=${phone}&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const searchData = await searchRes.json();
    const user = searchData.data?.users?.find(u => u.phoneNumber === phone);

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User Details:');
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Phone:', user.phoneNumber);
    console.log('  ID:', user.userId || user._id);
    console.log('\nFull user object:');
    console.log(JSON.stringify(user, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
