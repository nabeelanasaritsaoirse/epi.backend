/**
 * Create Installment Orders & Mark All Payments as Paid
 *
 * This script:
 * 1. Logs in as admin
 * 2. Fetches available products
 * 3. Creates installment orders for a user (up to 5 products)
 * 4. Marks all installments as paid for each order
 *
 * Usage:
 *   node scripts/createOrderAndMarkPaid.js
 *
 * You can customize the CONFIG section below before running.
 */

const http = require('http');

// ============================================
// CONFIG - Update these values as needed
// ============================================
const CONFIG = {
  // Base URL (without trailing slash)
  BASE_HOST: '13.127.15.87',
  BASE_PORT: 8080,

  // Admin credentials
  ADMIN_EMAIL: 'admin@epi.com',
  ADMIN_PASSWORD: '@Saoirse123',

  // User token (used to get user profile/ID)
  USER_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUzYzVlMmFkNjAxMDIwMDY0MWE3MmIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDAzNjQ4MiwiZXhwIjoxNzcwNjQxMjgyfQ.VY4TdXVPN4YpTM3d1REhUPAJG-y3cXH4AYT6T13Ga20',

  // User ID (decoded from the token above)
  USER_ID: '6953c5e2ad6010200641a72b',

  // Shipping address for orders
  SHIPPING_ADDRESS: {
    name: 'Test User',
    phoneNumber: '9999999999',
    addressLine1: '123 Test Street',
    addressLine2: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India',
  },

  // Installment plan days per order
  TOTAL_DAYS: 5,

  // How many products to create orders for (max 5)
  MAX_PRODUCTS: 5,
};

// ============================================
// HTTP Helper
// ============================================
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.BASE_HOST,
      port: CONFIG.BASE_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => reject(error));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Main Script
// ============================================
async function main() {
  try {
    console.log('='.repeat(70));
    console.log('  CREATE INSTALLMENT ORDERS & MARK ALL PAID');
    console.log('='.repeat(70));
    console.log(`Server: http://${CONFIG.BASE_HOST}:${CONFIG.BASE_PORT}`);
    console.log(`User ID: ${CONFIG.USER_ID}`);
    console.log(`Max Products: ${CONFIG.MAX_PRODUCTS}`);
    console.log(`Installment Days: ${CONFIG.TOTAL_DAYS}`);
    console.log('='.repeat(70) + '\n');

    // ------------------------------------------
    // Step 1: Admin Login
    // ------------------------------------------
    console.log('[Step 1] Admin Login...');
    const loginResult = await makeRequest('POST', '/api/admin-auth/login', {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });

    if (loginResult.statusCode !== 200 || !loginResult.data?.data?.accessToken) {
      console.log('FAILED - Admin login failed');
      console.log('Response:', JSON.stringify(loginResult.data, null, 2));
      return;
    }

    const adminToken = loginResult.data.data.accessToken;
    console.log('OK - Admin logged in\n');

    // ------------------------------------------
    // Step 2: Get user profile via user token
    // ------------------------------------------
    console.log('[Step 2] Fetching user profile...');
    const profileResult = await makeRequest('GET', '/api/auth/profile', null, CONFIG.USER_TOKEN);

    let userId = CONFIG.USER_ID;
    if (profileResult.statusCode === 200 && profileResult.data?.data) {
      const user = profileResult.data.data;
      userId = user._id || userId;
      console.log(`OK - User: ${user.name || user.email || userId}`);
      console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);

      // Update shipping address with user info if available
      if (user.name) CONFIG.SHIPPING_ADDRESS.name = user.name;
      if (user.phoneNumber) CONFIG.SHIPPING_ADDRESS.phoneNumber = user.phoneNumber;
    } else {
      console.log(`WARN - Could not fetch profile, using user ID: ${userId}`);
    }
    console.log();

    // ------------------------------------------
    // Step 3: Fetch available products
    // ------------------------------------------
    console.log('[Step 3] Fetching available products...');
    const productsResult = await makeRequest('GET', '/api/products/admin/all', null, adminToken);

    let products = [];
    if (productsResult.statusCode === 200) {
      const allProducts = productsResult.data?.data?.products || productsResult.data?.data || productsResult.data?.products || [];
      // Filter to only active, non-deleted, published products
      products = allProducts.filter((p) => {
        const isActive = !p.isDeleted && (p.status === 'published' || p.status === 'active');
        const hasPrice = p.pricing?.finalPrice > 0 || p.pricing?.salePrice > 0 || p.pricing?.regularPrice > 0;
        return isActive && hasPrice;
      });

      console.log(`OK - Found ${allProducts.length} total, ${products.length} active products`);
    } else {
      // Fallback: try public products endpoint
      console.log('WARN - Admin products endpoint failed, trying public endpoint...');
      const publicResult = await makeRequest('GET', '/api/products', null, adminToken);
      if (publicResult.statusCode === 200) {
        products = publicResult.data?.data?.products || publicResult.data?.data || publicResult.data?.products || [];
        products = products.filter((p) => !p.isDeleted);
        console.log(`OK - Found ${products.length} products via public endpoint`);
      } else {
        console.log('FAILED - Could not fetch products');
        console.log('Response:', JSON.stringify(publicResult.data, null, 2));
        return;
      }
    }

    if (products.length === 0) {
      console.log('FAILED - No active products found. Cannot create orders.');
      return;
    }

    // Select up to MAX_PRODUCTS
    const selectedProducts = products.slice(0, CONFIG.MAX_PRODUCTS);
    console.log(`\nSelected ${selectedProducts.length} products for orders:\n`);
    selectedProducts.forEach((p, i) => {
      const price = p.pricing?.finalPrice || p.pricing?.salePrice || p.pricing?.regularPrice || 0;
      console.log(`  ${i + 1}. ${p.name} - Rs.${price} (ID: ${p._id})`);
    });
    console.log();

    // ------------------------------------------
    // Step 4: Create orders and mark all paid
    // ------------------------------------------
    const results = [];

    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      const price = product.pricing?.finalPrice || product.pricing?.salePrice || product.pricing?.regularPrice || 0;

      console.log('-'.repeat(70));
      console.log(`[Order ${i + 1}/${selectedProducts.length}] ${product.name} (Rs.${price})`);
      console.log('-'.repeat(70));

      // 4a: Create installment order
      console.log('  Creating order...');
      const orderData = {
        userId: userId,
        productId: product._id,
        totalDays: CONFIG.TOTAL_DAYS,
        shippingAddress: CONFIG.SHIPPING_ADDRESS,
        paymentMethod: 'WALLET',
        autoPayFirstInstallment: true,
      };

      const createResult = await makeRequest(
        'POST',
        '/api/installments/admin/orders/create-for-user',
        orderData,
        adminToken
      );

      if (createResult.statusCode !== 201 && createResult.statusCode !== 200) {
        console.log(`  FAILED - Could not create order`);
        const errMsg = createResult.data?.message || createResult.data?.error || JSON.stringify(createResult.data);
        console.log(`  Error: ${errMsg}`);
        results.push({
          product: product.name,
          productId: product._id,
          status: 'FAILED_TO_CREATE',
          error: errMsg,
        });
        console.log();
        continue;
      }

      const order = createResult.data?.data?.order;
      const orderId = order?._id;
      const orderNumber = order?.orderId;

      console.log(`  OK - Order created: ${orderNumber} (ID: ${orderId})`);
      console.log(`  Status: ${order?.status}`);
      console.log(`  Daily Amount: Rs.${order?.dailyPaymentAmount || order?.dailyInstallmentAmount || 'N/A'}`);
      console.log(`  Paid: ${order?.paidInstallments || 0}/${order?.totalDays}`);

      // Small delay before marking payments
      await sleep(1000);

      // 4b: Mark all remaining payments as paid
      console.log('  Marking all payments as paid...');
      const markResult = await makeRequest(
        'POST',
        `/api/installments/admin/orders/${orderId}/mark-all-paid`,
        { note: 'All payments marked paid by admin script' },
        adminToken
      );

      if (markResult.statusCode === 200) {
        const markData = markResult.data?.data;
        console.log(`  OK - ${markData?.paymentsMarked || 0} payment(s) marked as paid`);
        console.log(`  Order Status: ${markData?.order?.status || 'COMPLETED'}`);

        results.push({
          product: product.name,
          productId: product._id,
          orderId: orderId,
          orderNumber: orderNumber,
          status: 'COMPLETED',
          paymentsMarked: markData?.paymentsMarked || 0,
        });
      } else {
        console.log(`  WARN - Mark-all-paid returned ${markResult.statusCode}`);
        console.log(`  Response: ${markResult.data?.message || JSON.stringify(markResult.data)}`);

        results.push({
          product: product.name,
          productId: product._id,
          orderId: orderId,
          orderNumber: orderNumber,
          status: 'CREATED_BUT_NOT_FULLY_PAID',
          error: markResult.data?.message || 'Unknown error',
        });
      }

      console.log();
      // Small delay between orders
      await sleep(500);
    }

    // ------------------------------------------
    // Step 5: Verify orders via user token
    // ------------------------------------------
    console.log('='.repeat(70));
    console.log('[Step 5] Verifying orders via user API...');
    const verifyResult = await makeRequest('GET', '/api/installments/orders', null, CONFIG.USER_TOKEN);

    if (verifyResult.statusCode === 200) {
      const orders = verifyResult.data?.data?.orders || verifyResult.data?.data || [];
      console.log(`OK - User has ${Array.isArray(orders) ? orders.length : 0} installment order(s)\n`);
    } else {
      console.log(`WARN - Could not verify orders (status: ${verifyResult.statusCode})\n`);
    }

    // ------------------------------------------
    // Summary
    // ------------------------------------------
    console.log('='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));

    const successful = results.filter((r) => r.status === 'COMPLETED');
    const failed = results.filter((r) => r.status !== 'COMPLETED');

    console.log(`Total: ${results.length} | Completed: ${successful.length} | Failed: ${failed.length}\n`);

    results.forEach((r, i) => {
      const icon = r.status === 'COMPLETED' ? 'OK' : 'FAIL';
      console.log(`  ${i + 1}. [${icon}] ${r.product}`);
      if (r.orderNumber) console.log(`     Order: ${r.orderNumber} | Payments Marked: ${r.paymentsMarked || 0}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('Script complete.');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error(error);
  }
}

main();
