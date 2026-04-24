const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_CREDENTIALS = {
  email: 'admin@epi.com',
  password: '@Saoirse123'
};

async function checkUserAutopay() {
  try {
    console.log('Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/admin-login`, ADMIN_CREDENTIALS);

    const adminToken = loginResponse.data.data?.accessToken;
    console.log('✅ Admin login successful\n');

    // Search for the user
    const searchEmail = 'deep.it.saoirse@gmail.com';
    console.log(`Step 2: Searching for user: ${searchEmail}`);

    // Get all users via sales API
    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || usersResponse.data.users || [];
    console.log(`Total users in system: ${users.length}\n`);

    // Search for the specific user
    const user = users.find(u =>
      u.email?.toLowerCase() === searchEmail.toLowerCase()
    );

    if (user) {
      console.log('✅ User found!\n');
      console.log('=== User Details ===');
      console.log('User ID:', user._id);
      console.log('Name:', user.name);
      console.log('Email:', user.email);
      console.log('Phone:', user.phoneNumber || 'Not provided');

      console.log('\n=== Autopay Status ===');
      if (user.autopay) {
        console.log('✅ Autopay is ENABLED');
        console.log('\nAutopay Configuration:');
        console.log(JSON.stringify(user.autopay, null, 2));
      } else {
        console.log('❌ Autopay is NOT ENABLED');
      }

      console.log('\n=== Additional Info ===');
      console.log('Wallet Balance:', user.wallet?.balance || 0);
      console.log('KYC Status:', user.kycStatus || 'Not verified');
      console.log('Referral Code:', user.referralCode || 'N/A');
      console.log('Level 1 Referrals:', user.level1Count || 0);
      console.log('Account Created:', user.createdAt);
    } else {
      console.log('\n❌ User not found with email:', searchEmail);

      // Search for similar users
      console.log('\n=== Searching for similar users (containing "deep") ===');
      const similarUsers = users.filter(u =>
        u.email?.toLowerCase().includes('deep') ||
        u.name?.toLowerCase().includes('deep')
      );

      if (similarUsers && similarUsers.length > 0) {
        console.log(`Found ${similarUsers.length} similar user(s):\n`);
        similarUsers.forEach((u, idx) => {
          console.log(`${idx + 1}. ${u.name}`);
          console.log(`   Email: ${u.email}`);
          console.log(`   Autopay: ${u.autopay?.enabled ? '✅ ENABLED' : '❌ NOT ENABLED'}`);
          console.log(`   Wallet: ${u.wallet?.balance || 0}`);
          console.log('');
        });
      } else {
        console.log('No similar users found.');
      }
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkUserAutopay();
