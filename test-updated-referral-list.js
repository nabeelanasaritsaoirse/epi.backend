const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

// User 1 (shadin) - Has 2 referrals
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';
const USER1_ID = '691af389415a3d077c3bb154';

async function testUpdatedReferralList() {
  console.log('🧪 TESTING UPDATED REFERRAL LIST ENDPOINT\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📋 Fetching referral list for User 1 (shadin)...\n');
    console.log('User ID:', USER1_ID);
    console.log('Expected Referrals: 2 (including Shahir who just applied the code)\n');

    const response = await axios.get(
      `${BASE_URL}/api/referral/list/${USER1_ID}`,
      { headers: { 'Authorization': `Bearer ${USER1_TOKEN}` } }
    );

    console.log('✅ API Response:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log('Total Referrals:', response.data.referrals.length);

    if (response.data.referrals.length > 0) {
      console.log('\n📜 Referral Details:');
      response.data.referrals.forEach((ref, index) => {
        console.log(`\n${index + 1}. ${ref.referredUser.name}`);
        console.log(`   User ID: ${ref.referredUser._id}`);
        console.log(`   Total Products: ${ref.totalProducts}`);
        console.log(`   Total Commission: ₹${ref.totalCommission}`);
        console.log(`   Products: ${ref.productList.length > 0 ? ref.productList.length : 'None yet'}`);
        if (ref.joinedAt) {
          console.log(`   Joined At: ${new Date(ref.joinedAt).toLocaleString()}`);
        }
      });
    }

    console.log('\n' + '='.repeat(70));

    // Check if Shahir is in the list
    const shahirInList = response.data.referrals.some(
      ref => ref.referredUser._id === '691d6d83962542bf4120f357'
    );

    if (shahirInList) {
      console.log('✅ SUCCESS! Shahir (User 2) now appears in the referral list!');
    } else {
      console.log('⚠️  Shahir (User 2) not found in the list');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testUpdatedReferralList();
