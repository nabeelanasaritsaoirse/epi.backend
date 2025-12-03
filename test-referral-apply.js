const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

// ==================== PASTE YOUR TOKENS HERE ====================
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';

// PASTE USER 2 TOKEN BELOW:
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg';

// User 1's referral code (automatically detected)
const USER1_REFERRAL_CODE = '49E59B3B';
// ================================================================

async function testReferralFlow() {
  console.log('🧪 TESTING REFERRAL FLOW\n');
  console.log('=' .repeat(70));

  try {
    // Get User 1 ID
    const user1Payload = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString());
    const user1Id = user1Payload.userId;

    // Get User 2 ID
    const user2Payload = JSON.parse(Buffer.from(USER2_TOKEN.split('.')[1], 'base64').toString());
    const user2Id = user2Payload.userId;

    console.log('\n👤 USER 1 (Referrer):');
    console.log('   ID:', user1Id);
    console.log('   Referral Code:', USER1_REFERRAL_CODE);

    console.log('\n👤 USER 2 (Referee):');
    console.log('   ID:', user2Id);

    // ====== STEP 1: Get User 2's current profile ======
    console.log('\n📋 STEP 1: Checking User 2 current status...\n');

    const user2Before = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('   Name:', user2Before.data.data.name);
    console.log('   Email:', user2Before.data.data.email);
    console.log('   Current referredBy:', user2Before.data.data.referredBy || 'None');

    // ====== STEP 2: Apply referral code ======
    console.log('\n📋 STEP 2: Applying referral code...\n');

    try {
      const applyResponse = await axios.post(
        `${BASE_URL}/api/auth/applyReferralCode`,
        { referralCode: USER1_REFERRAL_CODE },
        { headers: {
          'Authorization': `Bearer ${USER2_TOKEN}`,
          'Content-Type': 'application/json'
        } }
      );

      console.log('✅ SUCCESS! Referral code applied!');
      console.log('   Response:', JSON.stringify(applyResponse.data, null, 2));
    } catch (error) {
      if (error.response?.data?.code === 'REFERRAL_ALREADY_APPLIED') {
        console.log('⚠️  Referral code already applied to this account');
      } else {
        console.log('❌ Failed to apply referral code');
        console.log('   Error:', JSON.stringify(error.response?.data || error.message, null, 2));
      }
    }

    // ====== STEP 3: Verify User 2's updated profile ======
    console.log('\n📋 STEP 3: Verifying User 2 profile updated...\n');

    const user2After = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('   Updated referredBy:', user2After.data.data.referredBy || 'None');
    console.log('   Is linked to User 1?', user2After.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');

    // ====== STEP 4: Check User 1's referral list ======
    console.log('\n📋 STEP 4: Checking User 1 referral list...\n');

    const listResponse = await axios.get(
      `${BASE_URL}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('   Total Referrals:', listResponse.data.referrals.length);

    if (listResponse.data.referrals.length > 0) {
      console.log('\n   📜 Referral List:');
      listResponse.data.referrals.forEach((ref, index) => {
        console.log(`\n   ${index + 1}. ${ref.referredUser.name}`);
        console.log(`      ID: ${ref.referredUser._id}`);
        console.log(`      Products: ${ref.totalProducts}`);
        console.log(`      Commission: ₹${ref.totalCommission}`);
      });
    }

    // Check if User 2 is in the list
    const user2InList = listResponse.data.referrals.some(
      ref => ref.referredUser._id === user2Id
    );

    // ====== FINAL SUMMARY ======
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(70));
    console.log('✓ User 2 linked to User 1:', user2After.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');
    console.log('✓ User 2 in referral list:', user2InList ? '✅ YES' : '❌ NO (Will appear after purchase)');
    console.log('✓ Total referrals for User 1:', listResponse.data.referrals.length);
    console.log('='.repeat(70));

    if (user2After.data.data.referredBy === user1Id) {
      console.log('\n🎉 SUCCESS! Referral linking is working correctly!');
      if (!user2InList) {
        console.log('ℹ️  Note: User 2 will appear in the referral list after making a purchase.');
      }
    } else {
      console.log('\n❌ FAILED! Referral was not applied correctly.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testReferralFlow();
