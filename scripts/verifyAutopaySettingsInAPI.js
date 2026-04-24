const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

async function verifyAutopayInAPI() {
  try {
    console.log('=== Verifying autopaySettings in Sales API Response ===\n');

    // Login as admin
    console.log('Step 1: Logging in as admin...');
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const adminToken = adminLogin.data.data?.accessToken;
    console.log('✅ Admin logged in\n');

    // Get users list
    console.log('Step 2: Fetching users from sales API...');
    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || [];
    console.log(`✅ Found ${users.length} users\n`);

    // Check if autopaySettings is included
    console.log('Step 3: Checking if autopaySettings field is present...\n');

    const testUsers = [
      { email: 'shubhashri410@gmail.com', name: 'Shubhashri' },
      { email: 'deep.it.saoirse@gmail.com', name: 'Deep' }
    ];

    for (const testUser of testUsers) {
      const user = users.find(u => u.email === testUser.email);

      if (user) {
        console.log(`=== ${testUser.name} (${testUser.email}) ===`);
        console.log('User ID:', user._id);
        console.log('');

        if (user.autopaySettings !== undefined) {
          console.log('✅ autopaySettings field is PRESENT in response!');
          console.log('autopaySettings:', JSON.stringify(user.autopaySettings, null, 2));
        } else {
          console.log('❌ autopaySettings field is NOT present in response');
          console.log('Available fields:', Object.keys(user).join(', '));
        }
        console.log('');
      } else {
        console.log(`❌ ${testUser.name} not found in response\n`);
      }
    }

    // Summary
    console.log('=== SUMMARY ===');
    const firstUser = users[0];
    if (firstUser && firstUser.autopaySettings !== undefined) {
      console.log('✅ SUCCESS: autopaySettings is now included in sales API response!');
      console.log('✅ Admin panel can now see user autopay status');
      console.log('');
      console.log('Next steps:');
      console.log('1. Deploy this change to production server');
      console.log('2. Update admin panel to display autopaySettings.enabled field');
      console.log('3. Frontend team can now check autopay status via sales API');
    } else {
      console.log('❌ autopaySettings is still NOT included in response');
      console.log('⚠️  Server might need to be restarted for changes to take effect');
      console.log('');
      console.log('To fix:');
      console.log('1. Restart the dev server');
      console.log('2. Re-run this script to verify');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

verifyAutopayInAPI();
