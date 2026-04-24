/**
 * Test Production API with Both Admin Accounts
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

async function testWithCredentials(name, email, password) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Testing: ${name}`);
  console.log(`📧 Email: ${email}`);
  console.log('='.repeat(80));

  try {
    // 1. Login
    console.log('\n1️⃣ Login...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email,
      password
    });

    if (!loginRes.data.success) {
      console.log(`❌ Login failed: ${loginRes.data.message}`);
      console.log(`   Code: ${loginRes.data.code}`);
      return false;
    }

    console.log('✅ Login successful!');
    const data = loginRes.data.data;
    console.log(`   👤 Name: ${data.name}`);
    console.log(`   📋 Role: ${data.role}`);
    console.log(`   🆔 User ID: ${data.userId}`);
    console.log(`   🔗 Module Access: ${data.moduleAccess || 'All'}`);

    const token = data.accessToken;

    // 2. Test my-opportunities
    console.log('\n2️⃣ Testing /api/sales/my-opportunities...');
    const oppRes = await axios.get(`${BASE_URL}/api/sales/my-opportunities`, {
      params: { page: 1, limit: 20 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const oppData = oppRes.data.data;
    console.log(`   📊 Opportunities: ${oppData.pagination.total}`);
    console.log(`   📦 Cart: ${oppData.summary.withCart}`);
    console.log(`   💝 Wishlist: ${oppData.summary.withWishlist}`);
    console.log(`   💤 Inactive: ${oppData.summary.inactive}`);
    console.log(`   🆕 New: ${oppData.summary.newSignups}`);

    if (oppData.pagination.total > 0) {
      console.log('\n   🎉 DATA FOUND! Sample opportunities:');
      oppData.opportunities.slice(0, 3).forEach((opp, i) => {
        console.log(`\n   ${i + 1}. ${opp.name}`);
        console.log(`      📧 ${opp.email}`);
        console.log(`      📍 Type: ${opp.type} | Level: L${opp.level}`);
        if (opp.details) {
          console.log(`      📋 Details:`, JSON.stringify(opp.details, null, 2).substring(0, 100));
        }
      });
    }

    // 3. Test my-team
    console.log('\n3️⃣ Testing /api/sales/my-team...');
    const teamRes = await axios.get(`${BASE_URL}/api/sales/my-team`, {
      params: { page: 1, limit: 10 },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const teamData = teamRes.data.data;
    console.log(`   👥 Total L1: ${teamData.summary.totalL1}`);
    console.log(`   👥 Total L2: ${teamData.summary.totalL2}`);
    console.log(`   ⚡ Active: ${teamData.summary.activeMembers}`);

    if (teamData.teamMembers.length > 0) {
      console.log('\n   Team members:');
      teamData.teamMembers.slice(0, 5).forEach((member, i) => {
        console.log(`   ${i + 1}. ${member.name} (${member.email})`);
        console.log(`      📊 L2: ${member.stats.level2Count} | Orders: ${member.stats.totalOrders}`);
      });
    }

    // 4. Test my-stats
    console.log('\n4️⃣ Testing /api/sales/my-stats...');
    const statsRes = await axios.get(`${BASE_URL}/api/sales/my-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const stats = statsRes.data.data;
    console.log(`   🔗 Referral Code: ${stats.user.referralCode}`);
    console.log(`   📊 Team Size: ${stats.teamStats.totalTeamSize}`);
    console.log(`   📦 Total Orders: ${stats.orderStats.totalOrders}`);
    console.log(`   💰 Total Revenue: ₹${stats.revenueStats.totalPaidAmount}`);
    console.log(`   💵 Commission: ₹${stats.commissionStats.totalEarned}`);

    console.log(`\n✅ ${name} - All tests passed!`);
    return true;

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data.message || 'N/A'}`);
      if (error.response.data.code) {
        console.log(`   Code: ${error.response.data.code}`);
      }
    }
    return false;
  }
}

async function main() {
  console.log('\n🚀 Production API Testing');
  console.log(`🌐 Base URL: ${BASE_URL}\n`);

  const accounts = [
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

  const results = [];

  for (const account of accounts) {
    const success = await testWithCredentials(account.name, account.email, account.password);
    results.push({ name: account.name, success });
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.success ? 'Working' : 'Failed'}`);
  });

  const workingCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Result: ${workingCount}/${results.length} accounts working\n`);

  if (workingCount === 0) {
    console.log('⚠️  No accounts working! Possible issues:');
    console.log('   1. Wrong credentials');
    console.log('   2. Admin accounts not set up properly');
    console.log('   3. Users have no referral chains');
    console.log('   4. Need to set linkedUserId for admins\n');
  }
}

main();
