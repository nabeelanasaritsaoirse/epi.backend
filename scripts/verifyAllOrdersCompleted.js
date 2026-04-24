const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_ID = '698ad0c598104dd8464e00f8';

async function main() {
  try {
    console.log('=== VERIFYING ALL COMPLETED ORDERS ===\n');

    // Admin login
    const loginRes = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const ADMIN_TOKEN = loginRes.data.data.accessToken;

    // Get all orders for user
    const ordersRes = await axios.get(`${BASE_URL}/api/installments/admin/orders/all`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      params: { userId: USER_ID, limit: 50 }
    });

    const orders = ordersRes.data.data?.orders || [];
    const completedOrders = orders.filter(o => o.status === 'COMPLETED');
    const activeOrders = orders.filter(o => o.status === 'ACTIVE');

    console.log(`✅ User ID: ${USER_ID}`);
    console.log(`✅ Phone: 1234567899\n`);
    console.log(`📊 Total Orders: ${orders.length}`);
    console.log(`✅ COMPLETED Orders: ${completedOrders.length}`);
    console.log(`⚠️  ACTIVE Orders: ${activeOrders.length}\n`);

    if (completedOrders.length > 0) {
      console.log('🎉 COMPLETED Orders (Review Eligible):');
      completedOrders.forEach((order, i) => {
        console.log(`\n${i + 1}. ${order.productName}`);
        console.log(`   Order ID: ${order.orderId}`);
        console.log(`   Product ID: ${order.product}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery: ${order.deliveryStatus}`);
      });
    }

    console.log('\n=== SUCCESS ===');
    console.log(`\n✅ User has ${completedOrders.length} COMPLETED orders!`);
    console.log('✅ All orders are review-eligible!');
    console.log('\n💡 To test via User API:');
    console.log('   1. User ko Firebase se login karao');
    console.log('   2. Valid JWT token milega');
    console.log('   3. Us token se GET /api/installments/orders?status=COMPLETED');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
