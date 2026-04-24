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

async function listReferralCodes() {
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

    console.log(`📋 Total Users: ${users.length}\n`);
    console.log('First 10 users with their referral codes:\n');

    users.slice(0, 10).forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Referral Code: ${user.referralCode}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });

  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
  }
}

listReferralCodes();
