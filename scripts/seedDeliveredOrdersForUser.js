/**
 * Seed Delivered Orders for User
 *
 * This script creates 10 delivered orders with different products for a specific user
 * to test review eligibility feature.
 *
 * Usage: node scripts/seedDeliveredOrdersForUser.js
 */

const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';

// Admin credentials
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Target user (from JWT token)
const USER_ID = '6953c5e2ad6010200641a72b';
const USER_PHONE = '7994374844';

// Number of orders to create
const ORDER_COUNT = 10;

// Helper: delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== SEED DELIVERED ORDERS SCRIPT ===\n');
  console.log(`Target User Phone: ${USER_PHONE}`);
  console.log(`Orders to Create: ${ORDER_COUNT}\n`);

  try {
    // ─── Step 1: Admin Login ───
    console.log('Step 1: Logging in as admin...');
    const adminLogin = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!adminLogin.data.success) {
      console.error('❌ Admin login failed:', adminLogin.data.message);
      process.exit(1);
    }

    const ADMIN_TOKEN = adminLogin.data.data.accessToken;
    console.log('✅ Admin logged in successfully.\n');

    // ─── Step 2: Skip User Verification (using known user ID from JWT) ───
    console.log(`Step 2: Using user ID from JWT token: ${USER_ID}`);
    console.log(`   (Skipping verification - will create orders directly)\n`);

    // ─── Step 3: Add Wallet Funds ───
    console.log('Step 3: Adding wallet funds to user...');
    const creditRes = await axios.post(
      `${BASE_URL}/api/admin/wallet/credit`,
      { userId: USER_ID, amount: 10000, description: 'Test funds for review testing' },
      { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
    );

    if (creditRes.data.success) {
      console.log(`✅ Credited Rs.10,000 to user wallet\n`);
    } else {
      console.log(`⚠️  Wallet credit failed: ${creditRes.data.message}\n`);
    }

    // ─── Step 4: Fetch Active Products ───
    console.log('Step 4: Fetching active products...');
    const productsResponse = await axios.get(`${BASE_URL}/api/products`, {
      params: { page: 1, limit: 50 }
    });

    if (!productsResponse.data.success) {
      console.error('❌ Failed to fetch products');
      process.exit(1);
    }

    // Filter for active, available products
    const allProducts = productsResponse.data.data || [];
    const activeProducts = allProducts.filter(p =>
      !p.isDeleted &&
      p.stock > 0 &&
      p.status === 'active'
    );

    if (activeProducts.length < ORDER_COUNT) {
      console.log(`⚠️  Warning: Only ${activeProducts.length} active products found. Will create ${Math.min(activeProducts.length, ORDER_COUNT)} orders.`);
    }

    console.log(`✅ Found ${activeProducts.length} active products\n`);

    // Select products to use
    const productsToUse = activeProducts.slice(0, ORDER_COUNT);

    // ─── Step 5: Create Installment Orders ───
    console.log(`Step 5: Creating ${productsToUse.length} installment orders...`);
    const orderIds = [];

    for (let i = 0; i < productsToUse.length; i++) {
      const product = productsToUse[i];

      console.log(`  [${i + 1}/${productsToUse.length}] Creating order for: ${product.name.substring(0, 50)}...`);

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
              phoneNumber: USER_PHONE,
              addressLine1: '123 Test Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              pincode: '400001',
              country: 'India',
            },
          },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );

        if (!orderRes.data.success) {
          console.error(`      ❌ Failed: ${orderRes.data.message || orderRes.data.error}`);
          continue;
        }

        const orderData = orderRes.data.data;
        const orderId = orderData?.order?._id || orderData?.order?.orderId || orderData?._id;

        if (!orderId) {
          console.error(`      ❌ No orderId found in response`);
          continue;
        }

        orderIds.push({
          orderId,
          productName: product.name,
          productId: product.productId
        });

        console.log(`      ✅ Order created: ${orderId}`);
        await delay(300);

      } catch (error) {
        console.error(`      ❌ Error: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log(`\n✅ Created ${orderIds.length} orders successfully.\n`);

    if (orderIds.length === 0) {
      console.error('❌ No orders were created. Exiting.');
      process.exit(1);
    }

    // ─── Step 6: Mark All Orders as DELIVERED ───
    console.log('Step 6: Marking all orders as DELIVERED...');

    for (let i = 0; i < orderIds.length; i++) {
      const order = orderIds[i];

      console.log(`  [${i + 1}/${orderIds.length}] Delivering order ${order.orderId}...`);

      try {
        const deliveryRes = await axios.put(
          `${BASE_URL}/api/installments/admin/orders/${order.orderId}/delivery-status`,
          { status: 'DELIVERED' },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );

        if (!deliveryRes.data.success) {
          console.error(`      ❌ Failed: ${deliveryRes.data.message || deliveryRes.data.error}`);
          continue;
        }

        console.log(`      ✅ Order marked DELIVERED`);
        await delay(200);

      } catch (error) {
        console.error(`      ❌ Error: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log('\n✅ All orders marked as DELIVERED!\n');

    // ─── Step 7: Summary ───
    console.log('=== SUMMARY ===');
    console.log(`User Phone: ${USER_PHONE}`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Orders Created: ${orderIds.length}`);
    console.log('\nDelivered Products:');
    orderIds.forEach((order, i) => {
      console.log(`  ${i + 1}. ${order.productName.substring(0, 60)}`);
      console.log(`     Product ID: ${order.productId}`);
      console.log(`     Order ID: ${order.orderId}`);
    });

    console.log('\n✅ User can now review these products!');
    console.log('=== SCRIPT COMPLETED ===');

  } catch (error) {
    console.error('\n❌ Script failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data?.message || error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();
