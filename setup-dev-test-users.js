const axios = require('axios');
const crypto = require('crypto');

const DEV_SERVER = 'http://13.127.15.87:8080';

async function setupTestUsers() {
  console.log('🧪 SETTING UP TEST USERS ON DEV SERVER\n');
  console.log('Server:', DEV_SERVER);
  console.log('='.repeat(70));

  try {
    // Create User 1 (Referrer)
    console.log('\n📋 STEP 1: Creating User 1 (Referrer - Shadin)...\n');

    const user1FirebaseUid = 'test_shadin_' + crypto.randomBytes(8).toString('hex');
    const user1Data = {
      name: 'Shadin Test',
      email: 'shadin.test@example.com',
      phoneNumber: '+919876543210',
      firebaseUid: user1FirebaseUid
    };

    const user1Response = await axios.post(
      `${DEV_SERVER}/api/auth/signup`,
      user1Data
    );

    console.log('✅ User 1 Created!');
    console.log('   User ID:', user1Response.data.data.userId);
    console.log('   Name:', user1Response.data.data.name);
    console.log('   Referral Code:', user1Response.data.data.referralCode);
    console.log('   Access Token:', user1Response.data.data.accessToken.substring(0, 50) + '...');

    const user1Id = user1Response.data.data.userId;
    const user1ReferralCode = user1Response.data.data.referralCode;
    const user1Token = user1Response.data.data.accessToken;

    // Create User 2 (Referee)
    console.log('\n📋 STEP 2: Creating User 2 (Referee - Shahir)...\n');

    const user2FirebaseUid = 'test_shahir_' + crypto.randomBytes(8).toString('hex');
    const user2Data = {
      name: 'Shahir Test',
      email: 'shahir.test@example.com',
      phoneNumber: '+919876543211',
      firebaseUid: user2FirebaseUid,
      referralCode: user1ReferralCode  // Apply User 1's referral code during signup
    };

    const user2Response = await axios.post(
      `${DEV_SERVER}/api/auth/signup`,
      user2Data
    );

    console.log('✅ User 2 Created!');
    console.log('   User ID:', user2Response.data.data.userId);
    console.log('   Name:', user2Response.data.data.name);
    console.log('   Referral Applied:', user2Response.data.data.referralApplied || false);
    console.log('   Access Token:', user2Response.data.data.accessToken.substring(0, 50) + '...');

    const user2Id = user2Response.data.data.userId;
    const user2Token = user2Response.data.data.accessToken;

    // Verify referral link
    console.log('\n📋 STEP 3: Verifying referral link...\n');

    const user2Profile = await axios.get(
      `${DEV_SERVER}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${user2Token}` } }
    );

    console.log('✅ User 2 Profile:');
    console.log('   ReferredBy:', user2Profile.data.data.referredBy || 'None');
    console.log('   Expected (User 1 ID):', user1Id);
    console.log('   Match:', user2Profile.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');

    // Test referral list
    console.log('\n📋 STEP 4: Testing referral list endpoint...\n');

    const referralList = await axios.get(
      `${DEV_SERVER}/api/referral/list/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${user1Token}` } }
    );

    console.log('✅ Referral List Response:');
    console.log('   Total Referrals:', referralList.data.referrals.length);

    if (referralList.data.referrals.length > 0) {
      console.log('\n   Referrals:');
      referralList.data.referrals.forEach((ref, i) => {
        console.log(`\n   ${i + 1}. ${ref.referredUser.name} (${ref.referredUser._id})`);
        console.log(`      Products: ${ref.totalProducts}`);
        console.log(`      Commission: ₹${ref.totalCommission}`);
        if (ref.joinedAt) {
          console.log(`      Joined: ${new Date(ref.joinedAt).toLocaleString()}`);
        }
      });
    }

    // Check if User 2 is in the list
    const user2InList = referralList.data.referrals.some(ref => ref.referredUser._id === user2Id);

    // Test referral stats
    console.log('\n📋 STEP 5: Testing referral stats endpoint...\n');

    const stats = await axios.get(
      `${DEV_SERVER}/api/auth/referral-stats/${user1Id}`
    );

    console.log('✅ Referral Stats:');
    console.log('   Total Referrals:', stats.data.data.referralStats.totalReferrals);

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(70));
    console.log('User 1 ID:', user1Id);
    console.log('User 1 Referral Code:', user1ReferralCode);
    console.log('User 1 Token:', user1Token);
    console.log('\nUser 2 ID:', user2Id);
    console.log('User 2 Token:', user2Token);
    console.log('\n✓ User 2 linked to User 1:', user2Profile.data.data.referredBy === user1Id ? '✅ YES' : '❌ NO');
    console.log('✓ User 2 in /api/referral/list:', user2InList ? '✅ YES' : '❌ NO');
    console.log('✓ User 2 in /api/auth/referral-stats:', stats.data.data.referralStats.totalReferrals > 0 ? '✅ YES' : '❌ NO');
    console.log('='.repeat(70));

    if (user2InList && user2Profile.data.data.referredBy === user1Id) {
      console.log('\n🎉 SUCCESS! Referral system is working correctly on dev server!');
      console.log('✅ User appears in list immediately after applying referral code!');
    } else {
      console.log('\n⚠️  Issue detected:');
      if (!user2InList) {
        console.log('❌ User 2 NOT in referral list (code changes may not be deployed)');
      }
    }

    console.log('\n📝 SAVE THESE TOKENS FOR TESTING:');
    console.log(`\nconst USER1_TOKEN = '${user1Token}';`);
    console.log(`const USER2_TOKEN = '${user2Token}';`);
    console.log(`const USER1_ID = '${user1Id}';`);
    console.log(`const USER2_ID = '${user2Id}';`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

setupTestUsers();
