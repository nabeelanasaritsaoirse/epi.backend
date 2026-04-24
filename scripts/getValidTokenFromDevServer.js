const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_PHONE = '9999999999'; // Different phone to create new user

async function main() {
  try {
    console.log('=== GETTING VALID TOKEN FROM DEV SERVER ===\n');

    // Create a new test user to get a valid token
    console.log('Creating new test user...');

    const firebaseUid = `test_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const signupRes = await axios.post(`${BASE_URL}/api/auth/signup`, {
      name: 'Token Test User',
      email: `tokentest${Date.now()}@example.com`,
      phoneNumber: USER_PHONE,
      firebaseUid: firebaseUid,
    });

    if (signupRes.data.success) {
      const USER_ID = signupRes.data.data.userId;
      const USER_TOKEN = signupRes.data.data.accessToken;

      console.log('\n✅ User created successfully!');
      console.log(`User ID: ${USER_ID}`);
      console.log(`Phone: ${USER_PHONE}`);
      console.log(`\n🎫 VALID TOKEN:\n${USER_TOKEN}`);

      // Test the token
      console.log('\n📡 Testing token...');
      const ordersRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
        params: { limit: 10 }
      });

      console.log('✅ Token is VALID!');
      console.log('API Response:', ordersRes.data.success);
      console.log('Orders for this user:', ordersRes.data.data.count);

      console.log('\n=== USE THIS TOKEN FOR USER 698ad0c598104dd8464e00f8 ===');
      console.log('❌ This token is for a different user!');
      console.log('❌ We need to get the JWT_SECRET from dev server to generate correct token');
      console.log('\n💡 SOLUTION: User ko login karke token lena hoga via Firebase auth');

    } else {
      console.log('❌ Failed to create user:', signupRes.data.message);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

main();
