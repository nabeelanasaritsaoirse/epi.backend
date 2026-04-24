require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = 'Admin@123456';

async function loginAsAdmin() {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    return response.data.data.accessToken;
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function searchUsers(searchTerm) {
  try {
    console.log('🔐 Logging in as admin...\n');
    const adminToken = await loginAsAdmin();

    const getUsersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const users = getUsersResponse.data;

    if (searchTerm) {
      console.log(`🔍 Searching for users matching: ${searchTerm}\n`);

      const matchingUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phoneNumber?.includes(searchTerm)
      );

      if (matchingUsers.length === 0) {
        console.log(`❌ No users found matching: ${searchTerm}`);
      } else {
        console.log(`✅ Found ${matchingUsers.length} matching user(s):\n`);

        matchingUsers.forEach((user, index) => {
          console.log(`${index + 1}. ${user.name}`);
          console.log(`   ID: ${user._id}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
          console.log(`   Referral Code: ${user.referralCode}`);
          console.log(`   Created: ${user.createdAt}`);
          console.log('');
        });
      }
    } else {
      // Show most recent 20 users
      console.log('📋 Showing 20 most recent users:\n');

      const sortedUsers = users.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      sortedUsers.slice(0, 20).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
  }
}

const searchTerm = process.argv[2];
searchUsers(searchTerm);
