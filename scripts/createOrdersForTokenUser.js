/**
 * Create COMPLETED Orders for User with Valid Token
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// User with valid token
const USER_ID = '69747d0ed2e9d125baaf483c';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTc0N2QwZWQyZTlkMTI1YmFhZjQ4M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDcwNTU3NSwiZXhwIjoxNzcxMzEwMzc1fQ.feZD7-Myhkt-ZQpgtKoD3HBaVKICmXIP9fgHAXikhcY';

const ORDER_COUNT = 3;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('=== CREATING COMPLETED ORDERS ===\n');
    console.log(`User ID: ${USER_ID}\n`);

    // Step 1: Admin Login
    console.log('Step 1: Admin login...');
    const adminLogin = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const ADMIN_TOKEN = adminLogin.data.data.accessToken;
    console.log('✅ Admin logged in\n');

    // Step 2: Add wallet funds
    console.log('Step 2: Adding wallet funds...');
    await axios.post(
      `${BASE_URL}/api/admin/wallet/credit`,
      { userId: USER_ID, amount: 10000, description: 'Test funds for review' },
      { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
    );
    console.log('✅ Wallet credited\n');

    // Step 3: Get products
    console.log('Step 3: Fetching products...');
    const productsRes = await axios.get(`${BASE_URL}/api/products`, {
      params: { page: 1, limit: 50 }
    });

    const activeProducts = productsRes.data.data.filter(p => !p.isDeleted).slice(0, ORDER_COUNT);
    console.log(`✅ Found ${activeProducts.length} products\n`);

    // Step 4: Create orders
    console.log('Step 4: Creating orders...');
    const orderIds = [];

    for (let i = 0; i < activeProducts.length; i++) {
      const product = activeProducts[i];
      console.log(`  [${i + 1}/${activeProducts.length}] Creating order for ${product.name.substring(0, 40)}...`);

      try {
        const orderRes = await axios.post(
          `${BASE_URL}/api/installments/admin/orders/create-for-user`,
          {
            userId: USER_ID,
            productId: product.productId,
            totalDays: 10,
            paymentMethod: 'WALLET',
            shippingAddress: {
              name: 'Test User',
              phoneNumber: '9999999999',
              addressLine1: '123 Test Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              pincode: '400001',
              country: 'India',
            },
          },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );

        if (orderRes.data.success) {
          const orderId = orderRes.data.data?.order?._id || orderRes.data.data?._id;
          orderIds.push({ orderId, productName: product.name });
          console.log(`     ✅ Order created: ${orderId}`);
        }
      } catch (error) {
        console.log(`     ❌ Error: ${error.response?.data?.message || error.message}`);
      }

      await delay(300);
    }

    console.log(`\n✅ Created ${orderIds.length} orders\n`);

    // Step 5: Mark as DELIVERED
    console.log('Step 5: Marking orders as DELIVERED...');
    for (let i = 0; i < orderIds.length; i++) {
      const order = orderIds[i];
      console.log(`  [${i + 1}/${orderIds.length}] Marking ${order.orderId} as DELIVERED...`);

      try {
        await axios.put(
          `${BASE_URL}/api/installments/admin/orders/${order.orderId}/delivery-status`,
          { status: 'DELIVERED' },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );
        console.log('     ✅ Delivered');
      } catch (error) {
        console.log(`     ❌ Error: ${error.response?.data?.message || error.message}`);
      }

      await delay(200);
    }

    console.log('\n✅ All orders marked DELIVERED\n');

    // Step 6: Mark all payments as PAID (COMPLETED status)
    console.log('Step 6: Marking all payments as PAID...');
    for (let i = 0; i < orderIds.length; i++) {
      const order = orderIds[i];
      console.log(`  [${i + 1}/${orderIds.length}] Marking ${order.orderId} payments as PAID...`);

      try {
        await axios.post(
          `${BASE_URL}/api/installments/admin/orders/${order.orderId}/mark-all-paid`,
          { note: 'Test - all payments marked paid' },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );
        console.log('     ✅ Status: COMPLETED');
      } catch (error) {
        console.log(`     ❌ Error: ${error.response?.data?.message || error.message}`);
      }

      await delay(200);
    }

    console.log('\n✅ All orders are COMPLETED!\n');

    // Step 7: Test the API with user token
    console.log('Step 7: Testing API with user token...');
    const testRes = await axios.get(`${BASE_URL}/api/installments/orders`, {
      headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
      params: { status: 'COMPLETED', limit: 10 }
    });

    console.log(`✅ API Response: ${testRes.status}`);
    console.log(`✅ Orders Count: ${testRes.data.data.count}`);

    if (testRes.data.data.orders.length > 0) {
      console.log('\n🎉 COMPLETED Orders Found:\n');
      testRes.data.data.orders.forEach((o, i) => {
        console.log(`${i + 1}. ${o.productName}`);
        console.log(`   Order ID: ${o.orderId}`);
        console.log(`   Status: ${o.status} | Delivery: ${o.deliveryStatus}`);
        console.log('');
      });
    }

    console.log('\n=== SUCCESS ===');
    console.log('User ab review kar sakta hai! ✅');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

main();
