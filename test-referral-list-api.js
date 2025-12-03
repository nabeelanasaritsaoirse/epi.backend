const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER_ID = '691d6035962542bf4120f30b';

async function testReferralListAPI() {
  try {
    console.log('🧪 Testing Referral List API...\n');
    console.log('📍 Endpoint:', `${BASE_URL}/api/referral/list/${USER_ID}`);
    console.log('🔑 Using Token:', TOKEN.substring(0, 30) + '...\n');

    const response = await axios.get(`${BASE_URL}/api/referral/list/${USER_ID}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success!');
    console.log('📊 Status:', response.status);
    console.log('📦 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.status || error.message);
    if (error.response) {
      console.error('📦 Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testReferralListAPI();
