require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function loginAsAdmin() {
  try {
    console.log('🔐 Logging in as admin...');

    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('✅ Admin login successful\n');
    return response.data.data.accessToken;
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function findUserByPhone(phoneSearch) {
  try {
    const adminToken = await loginAsAdmin();

    console.log(`🔍 Searching for users with phone containing: ${phoneSearch}\n`);

    const getUsersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const users = getUsersResponse.data;

    // Find all users whose phone number contains the search term
    const matchingUsers = users.filter(user =>
      user.phoneNumber && user.phoneNumber.includes(phoneSearch)
    );

    if (matchingUsers.length === 0) {
      console.log(`❌ No users found with phone containing: ${phoneSearch}`);
      console.log(`\nShowing 5 random users with phone numbers for reference:`);

      const usersWithPhone = users.filter(u => u.phoneNumber);
      const randomUsers = usersWithPhone.slice(0, 5);

      randomUsers.forEach(user => {
        console.log(`   - ${user.name} | ${user.email} | Phone: ${user.phoneNumber}`);
      });
    } else {
      console.log(`✅ Found ${matchingUsers.length} matching user(s):\n`);

      matchingUsers.forEach(user => {
        console.log(`User Details:`);
        console.log(`   - ID: ${user._id}`);
        console.log(`   - Name: ${user.name}`);
        console.log(`   - Email: ${user.email}`);
        console.log(`   - Phone: ${user.phoneNumber}`);
        console.log(`   - Role: ${user.role}`);
        console.log(`   - Created: ${user.createdAt}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
  }
}

const phoneSearch = process.argv[2] || '8147264193';

findUserByPhone(phoneSearch);
