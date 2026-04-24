/**
 * Migrate User Order from Normal to Installment
 *
 * This script:
 * 1. Finds the user's normal orders
 * 2. Creates equivalent installment orders using admin API
 * 3. Marks all payments as completed if requested
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';
const USER_PHONE = '8897193576';

// Configuration
const CONFIG = {
  // Set to true to mark all payments as completed after creating order
  markAllPaid: true,

  // Set to true to create order even if product is deleted
  forceCreateWithDeletedProduct: false,

  // Alternative product ID if original is deleted
  alternativeProductId: null // Set to active product ID if needed
};

let adminToken = null;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  try {
    console.log('🚀 Migrating User Order to Installment System');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`User Phone: ${USER_PHONE}`);
    console.log('='.repeat(70) + '\n');

    // Step 1: Admin Login
    console.log('🔐 Step 1: Admin Login...');
    const loginResult = await makeRequest('POST', '/api/admin-auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginResult.statusCode !== 200) {
      console.log('❌ Admin login failed');
      console.log('Response:', JSON.stringify(loginResult.data, null, 2));
      return;
    }

    adminToken = loginResult.data.data.accessToken;
    console.log('✅ Admin logged in successfully\n');

    // Step 2: Get normal orders
    console.log('📦 Step 2: Fetching normal orders...');
    const ordersResult = await makeRequest('GET', '/api/orders', null, adminToken);

    if (ordersResult.statusCode !== 200) {
      console.log('❌ Failed to fetch normal orders');
      return;
    }

    const allOrders = ordersResult.data.orders || [];
    const userOrders = allOrders.filter(order => {
      const phone = order.deliveryAddress?.phoneNumber;
      return phone === USER_PHONE || phone === `+91${USER_PHONE}`;
    });

    if (userOrders.length === 0) {
      console.log('❌ No normal orders found for this user');
      return;
    }

    console.log(`✅ Found ${userOrders.length} normal order(s)\n`);

    // Step 3: Migrate each order
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < userOrders.length; i++) {
      const normalOrder = userOrders[i];

      console.log(`\n${'='.repeat(70)}`);
      console.log(`MIGRATING ORDER ${i + 1}/${userOrders.length}`);
      console.log(`${'='.repeat(70)}\n`);

      console.log(`Normal Order ID: ${normalOrder._id}`);
      console.log(`Product: ${normalOrder.product?.name || 'N/A'}`);
      console.log(`Amount: ₹${normalOrder.orderAmount || 0}`);
      console.log(`Days: ${normalOrder.paymentDetails?.totalDuration || 0}`);

      // Prepare installment order data
      const userId = typeof normalOrder.user === 'object' ? normalOrder.user._id : normalOrder.user;
      const productId = CONFIG.alternativeProductId ||
                       (typeof normalOrder.product === 'object' ? normalOrder.product._id : normalOrder.product);

      const installmentOrderData = {
        userId: userId,
        productId: productId,
        totalDays: normalOrder.paymentDetails?.totalDuration || normalOrder.paymentDetails?.totalDays || 5,
        shippingAddress: {
          fullName: normalOrder.deliveryAddress.name,
          phone: normalOrder.deliveryAddress.phoneNumber,
          addressLine1: normalOrder.deliveryAddress.addressLine1,
          addressLine2: normalOrder.deliveryAddress.addressLine2 || '',
          city: normalOrder.deliveryAddress.city,
          state: normalOrder.deliveryAddress.state,
          pincode: normalOrder.deliveryAddress.pincode,
          country: normalOrder.deliveryAddress.country || 'India'
        },
        paymentMethod: 'WALLET',
        autoPayFirstInstallment: true
      };

      console.log('\n📝 Creating installment order...');

      // Create installment order
      const createResult = await makeRequest(
        'POST',
        '/api/installments/admin/orders/create-for-user',
        installmentOrderData,
        adminToken
      );

      if (createResult.statusCode === 201 || createResult.statusCode === 200) {
        console.log('✅ Installment order created successfully!');

        const newOrder = createResult.data.data.order;
        console.log(`   New Order ID: ${newOrder._id}`);
        console.log(`   Order Number: ${newOrder.orderId}`);
        console.log(`   Status: ${newOrder.status}`);

        // Mark all payments as paid if configured
        if (CONFIG.markAllPaid) {
          console.log('\n💳 Marking all payments as paid...');

          const markPaidResult = await makeRequest(
            'POST',
            `/api/installments/admin/orders/${newOrder._id}/mark-all-paid`,
            {
              note: `Migration from normal order ${normalOrder._id}. All payments marked as completed.`
            },
            adminToken
          );

          if (markPaidResult.statusCode === 200) {
            console.log('✅ All payments marked as paid!');
            console.log(`   Payments marked: ${markPaidResult.data.data.paymentsMarked}`);
          } else {
            console.log('⚠️  Failed to mark all payments as paid');
            console.log('   Response:', JSON.stringify(markPaidResult.data, null, 2));
          }
        }

        successCount++;
      } else {
        console.log('❌ Failed to create installment order');
        console.log('   Status:', createResult.statusCode);
        console.log('   Error:', createResult.data.message || 'Unknown error');
        console.log('   Details:', JSON.stringify(createResult.data, null, 2));
        failCount++;
      }
    }

    // Final Summary
    console.log(`\n\n${'='.repeat(70)}`);
    console.log('MIGRATION SUMMARY');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total Normal Orders: ${userOrders.length}`);
    console.log(`Successfully Migrated: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`All Payments Marked: ${CONFIG.markAllPaid ? 'Yes' : 'No'}`);
    console.log('='.repeat(70));

    if (successCount > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Verify the new installment orders in the admin panel');
      console.log('   2. Inform the frontend team to use correct API endpoints');
      console.log('   3. Consider deleting the old normal orders if migration is confirmed');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
