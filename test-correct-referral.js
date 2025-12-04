const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

// User 1 (shadin) - REFERRER
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';
const USER1_REFERRAL_CODE = '925C0700';

// User 2 (Shahir) - REFEREE
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg';

async function testCorrectReferralFlow() {
  console.log('🧪 TESTING CORRECT REFERRAL FLOW\n');
  console.log('='.repeat(70));

  try {
    const user1Id = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString()).userId;
    const user2Id = JSON.parse(Buffer.from(USER2_TOKEN.split('.')[1], 'base64').toString()).userId;

    console.log('\n👤 SCENARIO:');
    console.log('   User 1 (shadin) - Referrer');
    console.log('   User 2 (Shahir) - Will apply User 1\'s referral code');

    // ====== STEP 1: Check User 2 before ======
    console.log('\n📋 STEP 1: User 2 Status BEFORE...\n');

    const user2Before = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('   Name:', user2Before.data.data.name);
    console.log('   ReferredBy:', user2Before.data.data.referredBy || 'None');

    // ====== STEP 2: Apply User 1's referral code to User 2 ======
    console.log('\n📋 STEP 2: User 2 applying User 1\'s referral code...\n');
    console.log('   Referral Code:', USER1_REFERRAL_CODE);

    try {
      const applyResponse = await axios.post(
        `${BASE_URL}/api/auth/applyReferralCode`,
        { referralCode: USER1_REFERRAL_CODE },
        { headers: {
          'Authorization': `Bearer ${USER2_TOKEN}`,
          'Content-Type': 'application/json'
        } }
      );

      console.log('   ✅ SUCCESS! Referral code applied!');
      console.log('   Response:', JSON.stringify(applyResponse.data, null, 2));
    } catch (error) {
      if (error.response?.data?.code === 'REFERRAL_ALREADY_APPLIED') {
        console.log('   ⚠️  Referral code already applied to this account');
        console.log('   Current referredBy:', error.response.data.data?.referrerId || 'Unknown');
      } else {
        console.log('   ❌ Failed to apply referral code');
        console.log('   Error:', JSON.stringify(error.response?.data || error.message, null, 2));
      }
    }

    // ====== STEP 3: Check User 2 after ======
    console.log('\n📋 STEP 3: User 2 Status AFTER...\n');

    const user2After = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('   ReferredBy:', user2After.data.data.referredBy || 'None');
    console.log('   Expected:', user1Id);
    console.log('   Match:', user2After.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');

    // ====== STEP 4: Check User 1's referral list ======
    console.log('\n📋 STEP 4: User 1\'s Referral List...\n');

    const listResponse = await axios.get(
      `${BASE_URL}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('   Total Referrals:', listResponse.data.referrals.length);

    if (listResponse.data.referrals.length > 0) {
      console.log('\n   📜 Referrals:');
      listResponse.data.referrals.forEach((ref, index) => {
        console.log(`\n   ${index + 1}. ${ref.referredUser.name} (${ref.referredUser._id})`);
        console.log(`      Products: ${ref.totalProducts}`);
        console.log(`      Commission: ₹${ref.totalCommission}`);
      });
    }

    const user2InList = listResponse.data.referrals.some(
      ref => ref.referredUser._id === user2Id
    );

    // ====== STEP 5: Check referral stats ======
    console.log('\n📋 STEP 5: User 1\'s Referral Stats...\n');

    const statsResponse = await axios.get(
      `${BASE_URL}/api/auth/referral-stats/${user1Id}`
    );

    console.log('   Total Referrals:', statsResponse.data.data.referralStats.totalReferrals);
    console.log('   Referral Limit:', statsResponse.data.data.referralStats.referralLimit);
    console.log('   Remaining:', statsResponse.data.data.referralStats.remainingReferrals);

    // ====== FINAL SUMMARY ======
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(70));
    console.log('✓ Referral Code Applied:', user2After.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');
    console.log('✓ User 2 in Referral List:', user2InList ? '✅ YES' : '⚠️  NO (Will appear after purchase)');
    console.log('✓ User 1 Total Referrals:', statsResponse.data.data.referralStats.totalReferrals);
    console.log('✓ User 2 appears in stats:', statsResponse.data.data.referredUsers.some(u => u.userId === user2Id) ? '✅ YES' : '❌ NO');
    console.log('='.repeat(70));

    if (user2After.data.data.referredBy === user1Id) {
      console.log('\n🎉 SUCCESS! Referral system is working correctly!');
      console.log('ℹ️  Note: User 2 will appear in /api/referral/list after making a purchase.');
      console.log('ℹ️  User 2 already appears in /api/auth/referral-stats because referredBy is set.');
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

testCorrectReferralFlow();
