const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

// ==================== CONFIGURATION ====================
// UPDATE THESE VALUES WITH YOUR ACTUAL TOKENS AND REFERRAL CODE

const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER2_TOKEN = 'PASTE_USER_2_TOKEN_HERE';
const USER1_REFERRAL_CODE = 'PASTE_REFERRAL_CODE_HERE';

// =======================================================

async function testCompleteReferralFlow() {
  console.log('🧪 COMPLETE REFERRAL FLOW TEST\n');
  console.log('=' .repeat(60));

  try {
    // ============ STEP 1: Get User 1 Info & Referral Code ============
    console.log('\n📋 STEP 1: Getting User 1 Info...\n');

    const user1Payload = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString());
    const user1Id = user1Payload.userId;

    console.log('User 1 ID:', user1Id);

    // Get User 1's profile to check referral code
    const user1ProfileResponse = await axios.get(
      `${BASE_URL}/api/auth/profile/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    const user1ReferralCode = user1ProfileResponse.data.data.referralCode;
    console.log('✅ User 1 Name:', user1ProfileResponse.data.data.name);
    console.log('✅ User 1 Referral Code:', user1ReferralCode);

    // ============ STEP 2: Check User 1's Current Referral List ============
    console.log('\n📋 STEP 2: Checking User 1 Current Referral List...\n');

    const initialListResponse = await axios.get(
      `${BASE_URL}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('Current Referrals Count:', initialListResponse.data.referrals.length);
    console.log('Current Referrals:', JSON.stringify(initialListResponse.data.referrals, null, 2));

    // ============ STEP 3: Get User 2 Info ============
    console.log('\n📋 STEP 3: Getting User 2 Info...\n');

    const user2Payload = JSON.parse(Buffer.from(USER2_TOKEN.split('.')[1], 'base64').toString());
    const user2Id = user2Payload.userId;

    console.log('User 2 ID:', user2Id);

    const user2ProfileResponse = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('✅ User 2 Name:', user2ProfileResponse.data.data.name);
    console.log('✅ User 2 Email:', user2ProfileResponse.data.data.email);
    console.log('✅ User 2 Current referredBy:', user2ProfileResponse.data.data.referredBy || 'None');

    // ============ STEP 4: Apply Referral Code ============
    console.log('\n📋 STEP 4: Applying Referral Code...\n');

    const referralCodeToUse = USER1_REFERRAL_CODE || user1ReferralCode;
    console.log('Applying Referral Code:', referralCodeToUse);

    try {
      const applyResponse = await axios.post(
        `${BASE_URL}/api/auth/applyReferralCode`,
        { referralCode: referralCodeToUse },
        { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
      );

      console.log('✅ Referral Code Applied Successfully!');
      console.log('Response:', JSON.stringify(applyResponse.data, null, 2));
    } catch (applyError) {
      if (applyError.response) {
        console.log('❌ Failed to apply referral code');
        console.log('Status:', applyError.response.status);
        console.log('Error:', JSON.stringify(applyError.response.data, null, 2));

        if (applyError.response.data.code === 'REFERRAL_ALREADY_APPLIED') {
          console.log('\n⚠️  Referral code already applied. Continuing with verification...');
        } else {
          throw applyError;
        }
      } else {
        throw applyError;
      }
    }

    // ============ STEP 5: Verify User 2 Profile Updated ============
    console.log('\n📋 STEP 5: Verifying User 2 Profile Updated...\n');

    const user2UpdatedProfile = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('✅ User 2 Updated referredBy:', user2UpdatedProfile.data.data.referredBy);
    console.log('✅ Expected referredBy (User 1 ID):', user1Id);
    console.log('✅ Match:', user2UpdatedProfile.data.data.referredBy === user1Id ? 'YES ✓' : 'NO ✗');

    // ============ STEP 6: Check User 1's Updated Referral List ============
    console.log('\n📋 STEP 6: Checking User 1 Updated Referral List...\n');

    const updatedListResponse = await axios.get(
      `${BASE_URL}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('Updated Referrals Count:', updatedListResponse.data.referrals.length);
    console.log('Updated Referrals:', JSON.stringify(updatedListResponse.data.referrals, null, 2));

    // Check if User 2 appears in the list
    const user2InList = updatedListResponse.data.referrals.some(
      ref => ref.referredUser._id === user2Id
    );

    console.log('\n✅ User 2 appears in User 1 referral list:', user2InList ? 'YES ✓' : 'NO ✗');

    // ============ STEP 7: Check Referral Stats ============
    console.log('\n📋 STEP 7: Checking User 1 Referral Stats...\n');

    const statsResponse = await axios.get(
      `${BASE_URL}/api/auth/referral-stats/${user1Id}`
    );

    console.log('Referral Stats:', JSON.stringify(statsResponse.data.data.referralStats, null, 2));
    console.log('Referred Users:', JSON.stringify(statsResponse.data.data.referredUsers, null, 2));

    // ============ FINAL SUMMARY ============
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ User 1 Referral Code:', user1ReferralCode);
    console.log('✅ User 2 Applied Code:', user2UpdatedProfile.data.data.referredBy ? 'YES' : 'NO');
    console.log('✅ User 2 in Referral List:', user2InList ? 'YES' : 'NO');
    console.log('✅ Total Referrals:', statsResponse.data.data.referralStats.totalReferrals);
    console.log('='.repeat(60));

    if (user2InList) {
      console.log('\n🎉 SUCCESS! Referral flow is working correctly!');
    } else {
      console.log('\n⚠️  WARNING: User 2 not found in referral list. Please check the data.');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.status || error.message);
    if (error.response) {
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Details:', error.message);
    }
  }
}

// ============ HELPER FUNCTION: Test with just checking existing data ============
async function quickCheck() {
  console.log('🔍 QUICK CHECK - Existing Referral Data\n');

  try {
    const user1Payload = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString());
    const user1Id = user1Payload.userId;

    console.log('User 1 ID:', user1Id);

    // Get referral list
    const listResponse = await axios.get(
      `${BASE_URL}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('\n📊 Referral List:');
    console.log(JSON.stringify(listResponse.data, null, 2));

    // Get referral stats
    const statsResponse = await axios.get(
      `${BASE_URL}/api/auth/referral-stats/${user1Id}`
    );

    console.log('\n📊 Referral Stats:');
    console.log(JSON.stringify(statsResponse.data.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// ============ RUN THE TEST ============
console.log('\n🚀 Choose test mode:');
console.log('1. Run FULL test (applies referral code)');
console.log('2. Run QUICK check (just checks existing data)\n');

// Uncomment the test you want to run:
// testCompleteReferralFlow();  // Full test
quickCheck();  // Quick check only
