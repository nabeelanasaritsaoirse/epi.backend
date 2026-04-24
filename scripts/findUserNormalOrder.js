/**
 * Find User's Normal Order to Migrate
 * Phone: 8897193576
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';
const USER_PHONE = '8897193576';

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
    console.log('🔍 Finding User\'s Normal Order');
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

    // Step 2: Get all normal orders (admin sees all)
    console.log('📦 Step 2: Fetching all normal orders...');
    const ordersResult = await makeRequest(
      'GET',
      `/api/orders`,
      null,
      adminToken
    );

    if (ordersResult.statusCode !== 200) {
      console.log('❌ Failed to fetch normal orders');
      console.log('Response:', JSON.stringify(ordersResult.data, null, 2));
      return;
    }

    const allOrders = ordersResult.data.orders || [];
    console.log(`✅ Retrieved ${allOrders.length} normal orders\n`);

    // Step 3: Find orders with matching phone in delivery address
    console.log('🔍 Step 3: Searching for user by phone number...');
    const userOrders = allOrders.filter(order => {
      const phone = order.deliveryAddress?.phoneNumber;
      return phone === USER_PHONE || phone === `+91${USER_PHONE}`;
    });

    console.log(`✅ Found ${userOrders.length} order(s) for phone ${USER_PHONE}\n`);

    if (userOrders.length === 0) {
      console.log('❌ No orders found for this phone number');
      console.log('\nℹ️  Let me show you a sample of recent orders to help debug:');
      allOrders.slice(0, 5).forEach((order, idx) => {
        console.log(`\n--- Sample Order ${idx + 1} ---`);
        console.log(`Order ID: ${order._id}`);
        console.log(`Phone: ${order.deliveryAddress?.phoneNumber || 'N/A'}`);
        console.log(`Name: ${order.deliveryAddress?.name || 'N/A'}`);
      });
      return;
    }

    // Step 4: Display order details
    userOrders.forEach((order, index) => {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`NORMAL ORDER ${index + 1} - FULL DETAILS`);
      console.log(`${'='.repeat(70)}\n`);

      console.log(`Order ID: ${order._id}`);
      console.log(`User ID: ${order.user || 'N/A'}`);
      console.log(`Created At: ${order.createdAt}`);
      console.log(`Status: ${order.status}`);
      console.log(`Payment Option: ${order.paymentOption}`);
      console.log(`Payment Status: ${order.paymentStatus || 'N/A'}`);

      console.log(`\n📦 Product Details:`);
      console.log(`   Product ID: ${order.product}`);
      console.log(`   Product Name: ${order.productName || 'N/A'}`);
      console.log(`   Quantity: ${order.quantity || 1}`);

      if (order.variantDetails) {
        console.log(`\n🎨 Variant Details:`);
        console.log(`   SKU: ${order.variantDetails.sku || 'N/A'}`);
        console.log(`   Price: ₹${order.variantDetails.price || 0}`);
        if (order.variantDetails.attributes) {
          console.log(`   Attributes:`, JSON.stringify(order.variantDetails.attributes, null, 2));
        }
      }

      console.log(`\n💰 Pricing:`);
      console.log(`   Final Price: ₹${order.finalPrice || order.totalAmount || 0}`);
      console.log(`   Total Amount: ₹${order.totalAmount || 0}`);

      if (order.couponDetails) {
        console.log(`\n🎟️ Coupon Applied:`);
        console.log(`   Code: ${order.couponDetails.code}`);
        console.log(`   Discount: ₹${order.couponDetails.discountAmount}`);
      }

      if (order.paymentDetails) {
        console.log(`\n💳 Payment Details:`);
        if (order.paymentDetails.dailyAmount) {
          console.log(`   Daily Amount: ₹${order.paymentDetails.dailyAmount}`);
        }
        if (order.paymentDetails.totalDays) {
          console.log(`   Total Days: ${order.paymentDetails.totalDays}`);
        }
        if (order.paymentDetails.startDate) {
          console.log(`   Start Date: ${order.paymentDetails.startDate}`);
        }
        console.log(`   Full Details:`, JSON.stringify(order.paymentDetails, null, 2));
      }

      if (order.deliveryAddress) {
        console.log(`\n📍 Delivery Address:`);
        console.log(`   Name: ${order.deliveryAddress.name}`);
        console.log(`   Phone: ${order.deliveryAddress.phoneNumber}`);
        console.log(`   Address: ${order.deliveryAddress.addressLine1}`);
        if (order.deliveryAddress.addressLine2) {
          console.log(`   Address Line 2: ${order.deliveryAddress.addressLine2}`);
        }
        console.log(`   City: ${order.deliveryAddress.city}`);
        console.log(`   State: ${order.deliveryAddress.state}`);
        console.log(`   Pincode: ${order.deliveryAddress.pincode}`);
        console.log(`   Country: ${order.deliveryAddress.country || 'India'}`);
      }

      console.log(`\n🔍 FULL ORDER OBJECT (for migration):`);
      console.log(JSON.stringify(order, null, 2));
    });

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total orders found: ${userOrders.length}`);
    console.log(`Phone number: ${USER_PHONE}`);
    console.log(`\n✅ Ready to create installment orders with the same details!`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
