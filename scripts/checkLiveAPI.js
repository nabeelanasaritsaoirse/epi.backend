/**
 * Check Live API - Simple Script
 * Just tests the live API endpoint
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function main() {
  console.log('🚀 Checking Live API\n');

  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginRes.data.success) {
      console.log('❌ Login failed:', loginRes.data.message);
      return;
    }

    console.log('✅ Login successful');
    const token = loginRes.data.data.accessToken;
    console.log('   Token:', token.substring(0, 50) + '...\n');

    // Step 2: Check my-opportunities API
    console.log('2️⃣ Calling /api/sales/my-opportunities...');
    const opportunitiesRes = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
      params: { page: 1, limit: 20 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ API Response:');
    console.log(JSON.stringify(opportunitiesRes.data, null, 2));

    // Check if data is empty
    if (opportunitiesRes.data.success) {
      const total = opportunitiesRes.data.data.pagination.total;
      if (total === 0) {
        console.log('\n⚠️  API returns 0 opportunities');
        console.log('   Reason: Admin has no linkedUserId or referral chain');
        console.log('   Solution: Need to link admin to a user with referrals');
      } else {
        console.log(`\n✅ Found ${total} opportunities!`);
      }
    }

    // Step 3: Check other sales APIs
    console.log('\n3️⃣ Checking other sales APIs...\n');

    const apis = [
      { name: 'My Team', endpoint: '/api/sales/my-team' },
      { name: 'My Stats', endpoint: '/api/sales/my-stats' },
      { name: 'Dashboard Stats', endpoint: '/api/sales/dashboard-stats' }
    ];

    for (const api of apis) {
      try {
        const res = await axios.get(`${BASE_URL}${api.endpoint}`, {
          params: { page: 1, limit: 10 },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`✅ ${api.name}: SUCCESS`);
        console.log(`   Response:`, JSON.stringify(res.data, null, 2).substring(0, 200) + '...\n');
      } catch (err) {
        console.log(`❌ ${api.name}: FAILED - ${err.message}\n`);
      }
    }

    console.log('✅ All checks completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
