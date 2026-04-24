const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_CREDENTIALS = {
  email: 'admin@epi.com',
  password: '@Saoirse123'
};

async function checkUserAutopayViaAPI() {
  try {
    console.log('Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/admin-login`, ADMIN_CREDENTIALS);

    const adminToken = loginResponse.data.data?.accessToken;
    console.log('✅ Admin login successful');
    console.log('Admin Token:', adminToken ? 'Received ✅' : 'Not received ❌');
    console.log('');

    // Search for the user
    const searchEmail = 'shubhashri410@gmail.com';
    console.log(`Step 2: Searching for user: ${searchEmail}`);

    try {
      // Try to get all users and search via sales API
      const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      const users = usersResponse.data.data?.users || usersResponse.data.users || usersResponse.data.data || [];
      console.log(`Total users in system: ${Array.isArray(users) ? users.length : 0}`);

      // Search for the specific user
      const user = users.find(u =>
        u.email?.toLowerCase() === searchEmail.toLowerCase()
      );

      if (user) {
        console.log('\n✅ User found!');
        console.log('\n=== User Details ===');
        console.log('User ID:', user._id);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('Phone:', user.phone);

        console.log('\n=== Autopay Status ===');
        if (user.autopay) {
          console.log('✅ Autopay is ENABLED');
          console.log('Configuration:', JSON.stringify(user.autopay, null, 2));
        } else {
          console.log('❌ Autopay is NOT ENABLED');
        }

        console.log('\n=== Additional Info ===');
        console.log('Wallet Balance:', user.wallet?.balance || 0);
        console.log('KYC Status:', user.kycStatus || 'Not verified');
      } else {
        console.log('\n❌ User not found with email:', searchEmail);

        // Search for similar users
        console.log('\n=== Searching for similar users ===');
        const similarUsers = users.filter(u =>
          u.email?.toLowerCase().includes('shubha') ||
          u.name?.toLowerCase().includes('shubha')
        );

        if (similarUsers && similarUsers.length > 0) {
          console.log(`Found ${similarUsers.length} similar user(s):\n`);
          similarUsers.forEach((u, idx) => {
            console.log(`${idx + 1}. ${u.name} (${u.email}) - Autopay: ${u.autopay?.enabled ? '✅' : '❌'}`);
          });
        }
      }

    } catch (apiError) {
      console.error('Error fetching users:', apiError.response?.data || apiError.message);
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkUserAutopayViaAPI();
