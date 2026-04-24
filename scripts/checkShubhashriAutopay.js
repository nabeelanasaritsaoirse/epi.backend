const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

async function checkShubhashriAutopay() {
  try {
    console.log('=== Checking Autopay for shubhashri410@gmail.com ===\n');

    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const adminToken = adminLogin.data.data?.accessToken;
    console.log('✅ Admin logged in\n');

    // Step 2: Get user details
    console.log('Step 2: Finding user...');
    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || [];
    const targetUser = users.find(u => u.email === 'shubhashri410@gmail.com');

    if (!targetUser) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found!');
    console.log('\n=== User Details ===');
    console.log('User ID:', targetUser._id);
    console.log('Name:', targetUser.name);
    console.log('Email:', targetUser.email);
    console.log('Wallet Balance:', targetUser.wallet?.balance || 0);
    console.log('');

    // Step 3: Check autopay settings via user's perspective
    // Note: We need user's token for this, so let's create a test to enable autopay

    console.log('Step 3: Checking if user needs to enable autopay...');
    console.log('');
    console.log('⚠️  To check autopay status, we need the user\'s JWT token.');
    console.log('');
    console.log('=== How User Can Enable Autopay ===');
    console.log('1. User logs in via mobile app');
    console.log('2. User goes to autopay settings');
    console.log('3. User calls: PUT /api/installments/autopay/settings');
    console.log('4. Body: { "enabled": true }');
    console.log('');

    // Step 4: Check if user has any installment orders
    console.log('Step 4: Checking user\'s orders...');

    try {
      const ordersResponse = await axios.get(
        `${BASE_URL}/api/sales/users/${targetUser._id}/orders`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const orders = ordersResponse.data.data?.orders || ordersResponse.data.orders || [];
      console.log(`Found ${orders.length} order(s)\n`);

      if (orders.length > 0) {
        console.log('User\'s Orders:');
        orders.forEach((order, idx) => {
          console.log(`\n${idx + 1}. Order ID: ${order._id || order.orderId}`);
          console.log(`   Product: ${order.productName || order.product?.name || 'N/A'}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Order Autopay: ${order.autopay?.enabled ? '✅ ENABLED' : '❌ NOT ENABLED'}`);
        });
        console.log('');
      } else {
        console.log('⚠️  User has no orders yet\n');
      }
    } catch (err) {
      console.log('Could not fetch orders:', err.response?.data?.message || err.message);
    }

    // Step 5: Summary
    console.log('\n=== SUMMARY ===');
    console.log('User:', targetUser.name);
    console.log('Email:', targetUser.email);
    console.log('User ID:', targetUser._id);
    console.log('');
    console.log('ℹ️  Note: Sales API does not include autopaySettings in response.');
    console.log('To check if user has enabled autopay globally:');
    console.log('  - User needs to call GET /api/installments/autopay/settings with their token');
    console.log('  - OR we need to add autopaySettings field to sales API response');
    console.log('');
    console.log('To enable autopay:');
    console.log('  - User calls PUT /api/installments/autopay/settings with { "enabled": true }');
    console.log('  - This sets user-level autopay preference');
    console.log('');
    console.log('For order-level autopay:');
    console.log('  - User calls POST /api/installments/autopay/enable/:orderId');
    console.log('  - This enables autopay for a specific order');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkShubhashriAutopay();
