/**
 * Test with Shubhashri Admin Account
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';

async function main() {
  console.log('🔍 Testing with Shubhashri Admin Account\n');

  try {
    // Login
    console.log('📧 Email:', ADMIN_EMAIL);
    console.log('🔐 Password:', ADMIN_PASSWORD);
    console.log('\n1️⃣ Logging in...');

    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginRes.data.success) {
      console.log('❌ Login failed:', loginRes.data.message);
      return;
    }

    console.log('✅ Login successful!');
    console.log('👤 User:', loginRes.data.data.name);
    console.log('📋 Role:', loginRes.data.data.role);
    console.log('🆔 User ID:', loginRes.data.data.userId);
    console.log('🔑 Token:', loginRes.data.data.accessToken.substring(0, 50) + '...');

    const token = loginRes.data.data.accessToken;

    // Test my-opportunities
    console.log('\n2️⃣ Testing /api/sales/my-opportunities...');
    const opportunitiesRes = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
      params: { page: 1, limit: 20 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ Response received!');
    console.log('\n📊 Opportunities Data:');
    console.log(JSON.stringify(opportunitiesRes.data, null, 2));

    const total = opportunitiesRes.data.data.pagination.total;
    if (total > 0) {
      console.log(`\n🎉 SUCCESS! Found ${total} opportunities!`);
      console.log('\n📋 Sample opportunities:');
      opportunitiesRes.data.data.opportunities.slice(0, 3).forEach((opp, i) => {
        console.log(`\n${i + 1}. ${opp.name || 'N/A'}`);
        console.log(`   Email: ${opp.email || 'N/A'}`);
        console.log(`   Type: ${opp.type}`);
        console.log(`   Level: L${opp.level}`);
      });
    } else {
      console.log('\n⚠️  Still returning 0 opportunities');
    }

    // Test my-team
    console.log('\n3️⃣ Testing /api/sales/my-team...');
    const teamRes = await axios.get(`${BASE_URL}/api/sales/my-team`, {
      params: { page: 1, limit: 20 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ My Team Response:');
    console.log(`   Total L1 Members: ${teamRes.data.data.summary.totalL1}`);
    console.log(`   Total L2 Users: ${teamRes.data.data.summary.totalL2}`);
    console.log(`   Active Members: ${teamRes.data.data.summary.activeMembers}`);

    if (teamRes.data.data.teamMembers.length > 0) {
      console.log('\n👥 Team Members:');
      teamRes.data.data.teamMembers.slice(0, 5).forEach((member, i) => {
        console.log(`   ${i + 1}. ${member.name} - ${member.email}`);
      });
    }

    // Test my-stats
    console.log('\n4️⃣ Testing /api/sales/my-stats...');
    const statsRes = await axios.get(`${BASE_URL}/api/sales/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('✅ My Stats Response:');
    console.log('   User:', statsRes.data.data.user.name);
    console.log('   Referral Code:', statsRes.data.data.user.referralCode);
    console.log('   Team Stats:', JSON.stringify(statsRes.data.data.teamStats, null, 2));
    console.log('   Order Stats:', JSON.stringify(statsRes.data.data.orderStats, null, 2));

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.log('\n📄 Error Response:');
      console.log(JSON.stringify(error.response.data, null, 2));
      console.log('\n📊 Status Code:', error.response.status);
    }
  }
}

main();
