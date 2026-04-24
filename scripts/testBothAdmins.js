/**
 * Test Both Admin Accounts on Live Production API
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

const admins = [
  {
    name: 'Admin 1',
    email: 'admin@epi.com',
    password: '@Saoirse123'
  },
  {
    name: 'Shubhashri Admin',
    email: 'shubhashri.it.saoirse@gmail.com',
    password: 'Shubha@123'
  }
];

async function testAdmin(admin) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${admin.name}`);
  console.log(`📧 Email: ${admin.email}`);
  console.log('='.repeat(80));

  try {
    // Login
    console.log('\n1️⃣ Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: admin.email,
      password: admin.password
    });

    if (!loginRes.data.success) {
      console.log(`❌ Login failed: ${loginRes.data.message}`);
      return false;
    }

    console.log('✅ Login successful!');
    const token = loginRes.data.data.accessToken;
    const userId = loginRes.data.data.userId;
    const role = loginRes.data.data.role;

    console.log(`   👤 Name: ${loginRes.data.data.name}`);
    console.log(`   📋 Role: ${role}`);
    console.log(`   🆔 ID: ${userId}`);

    // Test my-opportunities
    console.log('\n2️⃣ Testing my-opportunities API...');
    const oppRes = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
      params: { page: 1, limit: 20 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const total = oppRes.data.data.pagination.total;
    const summary = oppRes.data.data.summary;

    console.log(`   Total Opportunities: ${total}`);
    console.log(`   - With Cart: ${summary.withCart}`);
    console.log(`   - With Wishlist: ${summary.withWishlist}`);
    console.log(`   - Inactive: ${summary.inactive}`);
    console.log(`   - New Signups: ${summary.newSignups}`);

    if (total > 0) {
      console.log('\n   🎉 Found opportunities! Sample:');
      oppRes.data.data.opportunities.slice(0, 2).forEach((opp, i) => {
        console.log(`\n   ${i + 1}. ${opp.name}`);
        console.log(`      Email: ${opp.email}`);
        console.log(`      Type: ${opp.type}`);
        console.log(`      Level: L${opp.level}`);
      });
    } else {
      console.log('   ⚠️  No opportunities found');
    }

    // Test my-team
    console.log('\n3️⃣ Testing my-team API...');
    const teamRes = await axios.get(`${BASE_URL}/api/sales/my-team`, {
      params: { page: 1, limit: 5 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const teamSummary = teamRes.data.data.summary;
    console.log(`   L1 Members: ${teamSummary.totalL1}`);
    console.log(`   L2 Users: ${teamSummary.totalL2}`);
    console.log(`   Active Members: ${teamSummary.activeMembers}`);

    if (teamRes.data.data.teamMembers.length > 0) {
      console.log('\n   Team Members:');
      teamRes.data.data.teamMembers.forEach((member, i) => {
        console.log(`   ${i + 1}. ${member.name} (${member.email})`);
      });
    }

    // Test my-stats
    console.log('\n4️⃣ Testing my-stats API...');
    const statsRes = await axios.get(`${BASE_URL}/api/sales/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const stats = statsRes.data.data;
    console.log(`   Referral Code: ${stats.user.referralCode}`);
    console.log(`   Referral Limit: ${stats.user.referralLimit}`);
    console.log(`   Remaining Referrals: ${stats.user.remainingReferrals}`);
    console.log(`   Team Size: ${stats.teamStats.totalTeamSize}`);
    console.log(`   Total Orders: ${stats.orderStats.totalOrders}`);
    console.log(`   Active Orders: ${stats.orderStats.activeOrders}`);

    console.log(`\n✅ ${admin.name} - All APIs tested successfully!`);
    return true;

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data.message || 'N/A'}`);
    }
    return false;
  }
}

async function main() {
  console.log('\n🚀 Testing Both Admin Accounts on Production API');
  console.log('🌐 Base URL:', BASE_URL);

  const results = [];

  for (const admin of admins) {
    const success = await testAdmin(admin);
    results.push({ admin: admin.name, success });
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.admin}: ${result.success ? 'Working' : 'Failed'}`);
  });

  const workingCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Result: ${workingCount}/${results.length} admin accounts working`);

  console.log('\n✅ Testing complete!\n');
}

main();
