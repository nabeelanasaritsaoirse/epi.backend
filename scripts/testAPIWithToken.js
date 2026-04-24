const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OThhZDBjNTk4MTA0ZGQ4NDY0ZTAwZjgiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDcwNzM1NCwiZXhwIjoxNzcxMzEyMTU0fQ.WWgfkczlQpxJHZLbZ-eJTfxFVePBW_GuFt4fCSaEfC8';
const USER_ID = '698ad0c598104dd8464e00f8';

async function main() {
  try {
    console.log('=== TESTING API WITH TOKEN ===\n');
    console.log(`User ID: ${USER_ID}`);
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Token: ${USER_TOKEN.substring(0, 50)}...\n`);

    // Test 1: Get all orders (no status filter)
    console.log('Test 1: Getting ALL orders (no filter)...');
    try {
      const allOrdersRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
        params: { limit: 20 }
      });

      console.log('Status:', allOrdersRes.status);
      console.log('Success:', allOrdersRes.data.success);
      console.log('Orders Count:', allOrdersRes.data.data.count);
      console.log('Orders Length:', allOrdersRes.data.data.orders.length);

      if (allOrdersRes.data.data.orders.length > 0) {
        console.log('\n✅ Orders found!');
        allOrdersRes.data.data.orders.forEach((order, i) => {
          console.log(`\n${i + 1}. Order: ${order.orderId}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Delivery: ${order.deliveryStatus}`);
        });
      } else {
        console.log('❌ No orders found\n');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // Test 2: Get COMPLETED orders
    console.log('\nTest 2: Getting COMPLETED orders...');
    try {
      const completedRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
        params: { status: 'COMPLETED', limit: 20 }
      });

      console.log('Status:', completedRes.status);
      console.log('Orders Count:', completedRes.data.data.count);

      if (completedRes.data.data.orders.length > 0) {
        console.log('✅ COMPLETED orders found!');
        completedRes.data.data.orders.forEach((order, i) => {
          console.log(`${i + 1}. ${order.orderId} - ${order.status}`);
        });
      } else {
        console.log('❌ No COMPLETED orders\n');
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data || error.message);
    }

    // Test 3: Check via Admin API
    console.log('\nTest 3: Checking via Admin API...');

    const adminLogin = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const ADMIN_TOKEN = adminLogin.data.data.accessToken;
    console.log('✅ Admin logged in');

    try {
      const adminOrdersRes = await axios.get(`${BASE_URL}/api/installments/admin/orders/all`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        params: { limit: 50, userId: USER_ID }
      });

      const orders = adminOrdersRes.data.data?.orders || adminOrdersRes.data.orders || [];
      console.log('Total Orders in System:', orders.length);

      // Filter by user
      const userOrders = orders.filter(o =>
        o.user === USER_ID || o.user?._id === USER_ID || String(o.user) === USER_ID
      );

      console.log(`Orders for User ${USER_ID}:`, userOrders.length);

      if (userOrders.length > 0) {
        console.log('\n✅ Found orders for this user via Admin API!');
        userOrders.forEach((order, i) => {
          console.log(`\n${i + 1}. Order: ${order.orderId} (${order._id})`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Delivery: ${order.deliveryStatus}`);
          console.log(`   User: ${order.user}`);
        });
      } else {
        console.log('❌ No orders found for this user via Admin API');

        // Show first 5 orders to see what users exist
        console.log('\nFirst 5 orders in system:');
        orders.slice(0, 5).forEach((order, i) => {
          console.log(`${i + 1}. ${order.orderId} - User: ${order.user}`);
        });
      }
    } catch (error) {
      console.log('❌ Admin API Error:', error.response?.data || error.message);
    }

    console.log('\n=== TEST COMPLETED ===');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

main();
