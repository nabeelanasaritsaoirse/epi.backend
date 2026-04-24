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

async function getUserDetails(email) {
  try {
    console.log('🔐 Logging in as admin...\n');
    const adminToken = await loginAsAdmin();

    console.log(`🔍 Searching for user: ${email}\n`);

    // Get all users
    const getUsersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const users = getUsersResponse.data;
    const targetUser = users.find(user =>
      user.email?.toLowerCase() === email.toLowerCase()
    );

    if (!targetUser) {
      console.log(`❌ User not found with email: ${email}`);
      return;
    }

    console.log('✅ User found! Full details:\n');
    console.log(JSON.stringify(targetUser, null, 2));

    // Also get detailed profile
    console.log('\n\n📋 Getting detailed profile...\n');

    try {
      const profileResponse = await axios.get(
        `${BASE_URL}/api/users/${targetUser._id}`,
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Detailed Profile:\n');
      console.log(JSON.stringify(profileResponse.data, null, 2));
    } catch (profileError) {
      console.log('⚠️ Could not fetch detailed profile:', profileError.response?.data || profileError.message);
    }

  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
  }
}

const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/getUserDetails.js <email>');
  console.log('Example: node scripts/getUserDetails.js user@example.com');
  process.exit(1);
}

getUserDetails(email);
