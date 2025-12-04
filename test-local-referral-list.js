const axios = require('axios');

// Try both local and live endpoints
const ENDPOINTS = [
  { name: 'Local', url: 'http://localhost:3000' },
  { name: 'Live', url: 'https://api.epielio.com' }
];

const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';
const USER1_ID = '691af389415a3d077c3bb154';

async function testBothEndpoints() {
  console.log('🧪 TESTING REFERRAL LIST ON LOCAL AND LIVE\n');

  for (const endpoint of ENDPOINTS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing ${endpoint.name} Server: ${endpoint.url}`);
    console.log('='.repeat(70));

    try {
      const response = await axios.get(
        `${endpoint.url}/api/referral/list/${USER1_ID}`,
        {
          headers: { 'Authorization': `Bearer ${USER1_TOKEN}` },
          timeout: 5000
        }
      );

      console.log(`✅ ${endpoint.name} Server Response:`);
      console.log(`   Total Referrals: ${response.data.referrals.length}`);

      if (response.data.referrals.length > 0) {
        console.log('\n   Referrals:');
        response.data.referrals.forEach((ref, i) => {
          console.log(`   ${i + 1}. ${ref.referredUser.name} (${ref.referredUser._id})`);
          console.log(`      Products: ${ref.totalProducts}, Commission: ₹${ref.totalCommission}`);
        });
      } else {
        console.log('   No referrals found');
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint.name} server is not running`);
      } else if (error.code === 'ETIMEDOUT') {
        console.log(`❌ ${endpoint.name} server timeout`);
      } else {
        console.log(`❌ ${endpoint.name} Error:`, error.response?.status || error.message);
        if (error.response?.data) {
          console.log('   Response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 NEXT STEPS:');
  console.log('='.repeat(70));
  console.log('1. If local server works, the code changes are correct');
  console.log('2. Deploy the changes to the live server');
  console.log('3. Or restart the live server if already deployed');
  console.log('='.repeat(70));
}

testBothEndpoints();
