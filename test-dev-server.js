const axios = require('axios');

const DEV_SERVER = 'http://13.127.15.87:8080';
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg';

async function testDevServer() {
  console.log('🧪 TESTING DEVELOPMENT SERVER\n');
  console.log('Server:', DEV_SERVER);
  console.log('='.repeat(70));

  try {
    // Step 1: Check if server is running
    console.log('\n📋 STEP 1: Checking if dev server is running...\n');

    const healthCheck = await axios.get(`${DEV_SERVER}/`, { timeout: 5000 });
    console.log('✅ Server is running!');
    console.log('Response:', healthCheck.data);

    // Step 2: Get User 1 details
    console.log('\n📋 STEP 2: Getting User 1 details...\n');

    const user1Id = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString()).userId;
    console.log('User 1 ID from token:', user1Id);

    try {
      const user1Profile = await axios.get(
        `${DEV_SERVER}/api/auth/profile/${user1Id}`,
        { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
      );
      console.log('✅ User 1 found on dev server!');
      console.log('   Name:', user1Profile.data.data.name);
      console.log('   Email:', user1Profile.data.data.email);
      console.log('   Referral Code:', user1Profile.data.data.referralCode);
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        console.log('❌ User 1 NOT found on dev server');
        console.log('   Need to create users on dev server first');
        return;
      }
      throw error;
    }

    // Step 3: Test referral list endpoint
    console.log('\n📋 STEP 3: Testing referral list endpoint on dev server...\n');

    const referralList = await axios.get(
      `${DEV_SERVER}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('✅ Referral List API Response:');
    console.log('   Total Referrals:', referralList.data.referrals.length);

    if (referralList.data.referrals.length > 0) {
      console.log('\n   Referral Details:');
      referralList.data.referrals.forEach((ref, i) => {
        console.log(`\n   ${i + 1}. ${ref.referredUser.name}`);
        console.log(`      User ID: ${ref.referredUser._id}`);
        console.log(`      Products: ${ref.totalProducts}`);
        console.log(`      Commission: ₹${ref.totalCommission}`);
        if (ref.joinedAt) {
          console.log(`      Joined: ${new Date(ref.joinedAt).toLocaleString()}`);
        }
      });
    } else {
      console.log('   No referrals found');
    }

    // Step 4: Check referral stats
    console.log('\n📋 STEP 4: Checking referral stats...\n');

    const stats = await axios.get(
      `${DEV_SERVER}/api/auth/referral-stats/${user1Id}`
    );

    console.log('✅ Referral Stats:');
    console.log('   Total Referrals:', stats.data.data.referralStats.totalReferrals);
    console.log('   Referred Users:', stats.data.data.referredUsers.length);

    if (stats.data.data.referredUsers.length > 0) {
      console.log('\n   Referred Users List:');
      stats.data.data.referredUsers.forEach((user, i) => {
        console.log(`   ${i + 1}. ${user.name} (${user.userId})`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPARISON');
    console.log('='.repeat(70));
    console.log('Referrals in /api/referral/list:', referralList.data.referrals.length);
    console.log('Referrals in /api/auth/referral-stats:', stats.data.data.referralStats.totalReferrals);
    console.log('='.repeat(70));

    if (referralList.data.referrals.length === stats.data.data.referralStats.totalReferrals) {
      console.log('\n🎉 SUCCESS! Both endpoints show the same count!');
      console.log('✅ The fix is working correctly on dev server!');
    } else {
      console.log('\n⚠️  Different counts detected');
      console.log('This is expected if code changes are deployed to dev server');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Development server is not running or not accessible');
    } else if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testDevServer();
