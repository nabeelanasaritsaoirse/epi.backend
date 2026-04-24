const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_ID = '698ad0c598104dd8464e00f8';
const USER_PHONE = '1234567899';

async function main() {
  try {
    console.log('=== TESTING COMPLETED ORDERS API ===\n');

    // Step 1: Login as the user
    console.log('Step 1: Logging in as user...');
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      phoneNumber: USER_PHONE
    });

    if (!loginRes.data.success) {
      console.error('❌ User login failed:', loginRes.data.message);
      process.exit(1);
    }

    const USER_TOKEN = loginRes.data.data.accessToken;
    console.log('✅ User logged in successfully');
    console.log(`User ID: ${loginRes.data.data.userId}\n`);

    // Step 2: Test the completed orders API
    console.log('Step 2: Fetching completed orders...');
    const ordersRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
      headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
      params: { status: 'COMPLETED', limit: 10, page: 1 }
    });

    console.log('\n📦 API Response:');
    console.log('Status:', ordersRes.status);
    console.log('Success:', ordersRes.data.success);
    console.log('Message:', ordersRes.data.message);
    console.log('Orders Count:', ordersRes.data.data.count);
    console.log('Orders:', ordersRes.data.data.orders.length);

    if (ordersRes.data.data.orders.length > 0) {
      console.log('\n✅ Orders found:');
      ordersRes.data.data.orders.forEach((order, i) => {
        console.log(`\n${i + 1}. Order: ${order.orderId}`);
        console.log(`   Product: ${order.productName}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
        console.log(`   Completed At: ${order.completedAt}`);
      });
    } else {
      console.log('\n❌ No orders found with status=COMPLETED');

      // Let's check all orders
      console.log('\n🔍 Checking ALL orders (no status filter)...');
      const allOrdersRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
        headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
        params: { limit: 20, page: 1 }
      });

      console.log('Total Orders:', allOrdersRes.data.data.count);

      if (allOrdersRes.data.data.orders.length > 0) {
        console.log('\nAll Orders:');
        allOrdersRes.data.data.orders.forEach((order, i) => {
          console.log(`\n${i + 1}. Order: ${order.orderId}`);
          console.log(`   Product: ${order.productName}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Delivery Status: ${order.deliveryStatus}`);
          console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
          console.log(`   Completed At: ${order.completedAt || 'Not completed'}`);
        });
      }
    }

    // Step 3: Also check via admin API
    console.log('\n\nStep 3: Checking via Admin API...');
    const adminLoginRes = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const ADMIN_TOKEN = adminLoginRes.data.data.accessToken;

    const adminOrdersRes = await axios.get(`${BASE_URL}/api/installments/admin/orders`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      params: { userId: USER_ID, limit: 20 }
    });

    console.log('\n📦 Admin API Response:');
    console.log('Total Orders for User:', adminOrdersRes.data.count);

    if (adminOrdersRes.data.orders && adminOrdersRes.data.orders.length > 0) {
      console.log('\nOrders found via Admin API:');
      adminOrdersRes.data.orders.forEach((order, i) => {
        console.log(`\n${i + 1}. Order: ${order.orderId} (${order._id})`);
        console.log(`   Product: ${order.productName}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);
        console.log(`   Paid: ${order.paidInstallments}/${order.totalDays}`);
        console.log(`   Total Paid Amount: ₹${order.totalPaidAmount}`);
        console.log(`   Remaining Amount: ₹${order.remainingAmount}`);
        console.log(`   Completed At: ${order.completedAt || 'Not completed'}`);
      });
    }

    console.log('\n=== TEST COMPLETED ===');

  } catch (error) {
    console.error('\n❌ Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data?.message || error.response.data);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
