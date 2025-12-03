const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg';

async function checkBothUsers() {
  console.log('🔍 CHECKING BOTH USERS\n');
  console.log('='.repeat(70));

  try {
    // User 1
    const user1Payload = JSON.parse(Buffer.from(USER1_TOKEN.split('.')[1], 'base64').toString());
    const user1Id = user1Payload.userId;

    const user1Profile = await axios.get(
      `${BASE_URL}/api/auth/profile/${user1Id}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('\n👤 USER 1:');
    console.log('   ID:', user1Id);
    console.log('   Name:', user1Profile.data.data.name);
    console.log('   Email:', user1Profile.data.data.email);
    console.log('   Referral Code:', user1Profile.data.data.referralCode);
    console.log('   ReferredBy:', user1Profile.data.data.referredBy || 'None');

    // User 2
    const user2Payload = JSON.parse(Buffer.from(USER2_TOKEN.split('.')[1], 'base64').toString());
    const user2Id = user2Payload.userId;

    const user2Profile = await axios.get(
      `${BASE_URL}/api/auth/profile/${user2Id}`,
      { headers: { 'Authorization': `Bearer ${USER2_TOKEN}` } }
    );

    console.log('\n👤 USER 2:');
    console.log('   ID:', user2Id);
    console.log('   Name:', user2Profile.data.data.name);
    console.log('   Email:', user2Profile.data.data.email);
    console.log('   Referral Code:', user2Profile.data.data.referralCode);
    console.log('   ReferredBy:', user2Profile.data.data.referredBy || 'None');

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(70));
    console.log('User 1 can use code:', user2Profile.data.data.referralCode);
    console.log('User 2 can use code:', user1Profile.data.data.referralCode);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkBothUsers();
