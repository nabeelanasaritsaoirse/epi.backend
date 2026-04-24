const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function checkUser() {
  try {
    // Login as admin
    console.log('Logging in as admin...');
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.log('Admin login failed:', loginData.message);
      return;
    }

    const token = loginData.data.accessToken;
    console.log('Admin login successful.\n');

    // Search for user
    console.log('Searching for user...');
    const searchRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=deep.it.saoirse@gmail.com&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const searchData = await searchRes.json();
    const user = searchData.data?.users?.find(u => u.email === 'deep.it.saoirse@gmail.com');

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('=== USER STATUS ===');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Phone:', user.phoneNumber);
    console.log('User ID:', user.userId || user._id);
    console.log('');
    console.log('ACCOUNT STATUS:');
    console.log('  deletionRequestedAt:', user.deletionRequestedAt || 'null (NOT PENDING DELETION)');
    console.log('  accountStatus:', user.accountStatus || 'active');
    console.log('  isDeleted:', user.isDeleted || false);
    console.log('  isActive:', user.isActive !== false);
    console.log('');

    // Try to get more detailed info
    console.log('\nFull user object:');
    console.log(JSON.stringify(user, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkUser();
