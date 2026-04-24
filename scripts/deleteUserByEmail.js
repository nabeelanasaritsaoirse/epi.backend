require('dotenv').config();
const axios = require('axios');

/**
 * Script to delete a user from production by email
 * Usage: node scripts/deleteUserByEmail.js <email>
 */

const BASE_URL = process.env.DELETE_SERVER_URL || 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function loginAsAdmin() {
  try {
    console.log('🔐 Logging in as admin...');

    const response = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    console.log('✅ Admin login successful');
    return response.data.data.accessToken;
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function deleteUserByEmail(email) {
  try {
    // Step 1: Login as admin
    const adminToken = await loginAsAdmin();

    console.log(`\n🔍 Searching for user with email/phone: ${email}`);

    // Step 2: Get all users to find the one with matching email
    const getUsersResponse = await axios.get(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });

    const users = getUsersResponse.data;

    // Search by email or phone number (check if phone contains the search term)
    const targetUser = users.find(user =>
      user.email?.toLowerCase() === email.toLowerCase() ||
      user.phoneNumber === email ||
      user.phoneNumber?.includes(email)
    );

    if (!targetUser) {
      console.log(`❌ User not found with email/phone: ${email}`);
      return;
    }

    console.log(`✅ Found user:`);
    console.log(`   - ID: ${targetUser._id}`);
    console.log(`   - Name: ${targetUser.name}`);
    console.log(`   - Email: ${targetUser.email}`);
    console.log(`   - Phone: ${targetUser.phoneNumber || 'N/A'}`);
    console.log(`   - Role: ${targetUser.role}`);
    console.log(`   - Created: ${targetUser.createdAt}`);

    // Step 3: Delete the user
    console.log(`\n🗑️  Deleting user...`);

    const deleteResponse = await axios.delete(
      `${BASE_URL}/api/users/admin/${targetUser._id}`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ User deleted successfully!`);
    console.log(`Response:`, deleteResponse.data);

  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n⚠️  Authentication failed. Please check your admin credentials.');
    } else if (error.response?.status === 403) {
      console.log('\n⚠️  Unauthorized. Make sure you are using an admin account.');
    }
  }
}

// Get command line arguments
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/deleteUserByEmail.js <email>');
  console.log('Example: node scripts/deleteUserByEmail.js Shubhap130487@gmail.com');
  process.exit(1);
}

// Run the deletion
deleteUserByEmail(email);
