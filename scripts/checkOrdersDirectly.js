const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_ID = '698ad0c598104dd8464e00f8';
const ORDER_IDS = [
  '698ad1df98104dd8464e0428',
  '698ad1e098104dd8464e043d',
  '698ad1e098104dd8464e044b'
];

async function main() {
  try {
    console.log('=== CHECKING ORDERS DIRECTLY VIA ADMIN API ===\n');

    // Step 1: Admin Login
    console.log('Step 1: Admin login...');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const ADMIN_TOKEN = adminLoginRes.data.data.accessToken;
    console.log('✅ Admin logged in\n');

    // Step 2: Check each order
    console.log('Step 2: Checking each order...\n');

    for (let i = 0; i < ORDER_IDS.length; i++) {
      const orderId = ORDER_IDS[i];
      console.log(`[${i + 1}/3] Order: ${orderId}`);

      try {
        const orderRes = await axios.get(
          `${BASE_URL}/api/installments/admin/orders/${orderId}`,
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );

        if (orderRes.data.success) {
          const order = orderRes.data.data;
          console.log(`   ✅ Found!`);
          console.log(`   Product: ${order.productName}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Delivery Status: ${order.deliveryStatus}`);
          console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
          console.log(`   Total Paid: ₹${order.totalPaidAmount}`);
          console.log(`   Remaining: ₹${order.remainingAmount}`);
          console.log(`   Completed At: ${order.completedAt || 'NULL'}`);
          console.log('');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.response?.data?.message || error.message}\n`);
      }
    }

    // Step 3: Get all orders for this user
    console.log('Step 3: Getting all orders for user...\n');
    const allOrdersRes = await axios.get(
      `${BASE_URL}/api/installments/admin/orders`,
      {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        params: { userId: USER_ID, limit: 50 }
      }
    );

    console.log(`Total orders for user: ${allOrdersRes.data.count}`);

    if (allOrdersRes.data.orders && allOrdersRes.data.orders.length > 0) {
      console.log('\nAll Orders:\n');
      allOrdersRes.data.orders.forEach((order, i) => {
        console.log(`${i + 1}. ${order.orderId} (${order._id})`);
        console.log(`   Product: ${order.productName}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery: ${order.deliveryStatus}`);
        console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
        console.log(`   Completed: ${order.completedAt || 'NULL'}`);
        console.log('');
      });
    } else {
      console.log('❌ No orders found for this user!');
    }

    console.log('=== CHECK COMPLETED ===');

  } catch (error) {
    console.error('\n❌ Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
