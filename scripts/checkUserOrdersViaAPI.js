/**
 * Check User Orders via Live API
 * Phone: 8897193576
 * Using Admin API endpoints
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
    console.log('🔍 Checking User Orders via Live API');
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
    console.log('✅ Admin logged in successfully');
    console.log(`Token: ${adminToken.substring(0, 30)}...`);
    console.log();

    // Step 2: Get User by Phone
    console.log('🔍 Step 2: Finding user by phone...');
    const userSearchResult = await makeRequest(
      'GET',
      `/api/admin/users?search=${USER_PHONE}`,
      null,
      adminToken
    );

    if (userSearchResult.statusCode !== 200) {
      console.log('❌ User search failed');
      console.log('Response:', JSON.stringify(userSearchResult.data, null, 2));
      return;
    }

    const users = userSearchResult.data.data.users;
    if (!users || users.length === 0) {
      console.log('❌ User not found with phone:', USER_PHONE);
      return;
    }

    const user = users[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log();

    // Step 3: Get Normal Orders
    console.log('📦 Step 3: Checking NORMAL Orders...');
    const normalOrdersResult = await makeRequest(
      'GET',
      `/api/admin/orders?userId=${user._id}`,
      null,
      adminToken
    );

    if (normalOrdersResult.statusCode === 200) {
      const normalOrders = normalOrdersResult.data.data.orders || [];
      console.log(`✅ Found ${normalOrders.length} normal order(s)\n`);

      if (normalOrders.length > 0) {
        normalOrders.forEach((order, index) => {
          console.log(`--- Normal Order ${index + 1} ---`);
          console.log(`Order ID: ${order._id}`);
          console.log(`Order Number: ${order.orderId || 'N/A'}`);
          console.log(`Created At: ${order.createdAt}`);
          console.log(`Status: ${order.status}`);
          console.log(`Payment Status: ${order.paymentStatus}`);
          console.log(`Total Amount: ₹${order.totalAmount}`);
          console.log(`Items Count: ${order.items?.length || 0}`);

          if (order.items && order.items.length > 0) {
            console.log('\n📦 Order Items:');
            order.items.forEach((item, i) => {
              console.log(`  ${i + 1}. Product ID: ${item.product || item.productId}`);
              console.log(`     Name: ${item.name}`);
              console.log(`     Quantity: ${item.quantity}`);
              console.log(`     Price: ₹${item.price}`);
              console.log(`     Total: ₹${(item.quantity * item.price).toFixed(2)}`);
              if (item.variant) {
                console.log(`     Variant: ${JSON.stringify(item.variant)}`);
              }
            });
          }

          if (order.shippingAddress) {
            console.log('\n📍 Shipping Address:');
            console.log(`   Name: ${order.shippingAddress.fullName || order.shippingAddress.name}`);
            console.log(`   Phone: ${order.shippingAddress.phone}`);
            console.log(`   Address: ${order.shippingAddress.address}`);
            console.log(`   City: ${order.shippingAddress.city}`);
            console.log(`   State: ${order.shippingAddress.state}`);
            console.log(`   Pincode: ${order.shippingAddress.pincode}`);
            console.log(`   Country: ${order.shippingAddress.country}`);
          }

          console.log('\n' + '-'.repeat(60) + '\n');
        });

        // Show the most recent order in detail
        console.log('\n🎯 MOST RECENT NORMAL ORDER (for migration):');
        console.log('='.repeat(70));
        console.log(JSON.stringify(normalOrders[0], null, 2));
        console.log('='.repeat(70) + '\n');
      }
    } else {
      console.log('⚠️  Failed to fetch normal orders');
      console.log('Response:', JSON.stringify(normalOrdersResult.data, null, 2));
    }

    // Step 4: Get Installment Orders
    console.log('\n💳 Step 4: Checking INSTALLMENT Orders...');
    const installmentOrdersResult = await makeRequest(
      'GET',
      `/api/admin/installment-orders?userId=${user._id}`,
      null,
      adminToken
    );

    if (installmentOrdersResult.statusCode === 200) {
      const installmentOrders = installmentOrdersResult.data.data.orders || [];
      console.log(`✅ Found ${installmentOrders.length} installment order(s)\n`);

      if (installmentOrders.length > 0) {
        installmentOrders.forEach((order, index) => {
          console.log(`--- Installment Order ${index + 1} ---`);
          console.log(`Order ID: ${order._id}`);
          console.log(`Order Number: ${order.orderId || 'N/A'}`);
          console.log(`Created At: ${order.createdAt}`);
          console.log(`Status: ${order.status}`);
          console.log(`Total Amount: ₹${order.totalAmount}`);
          console.log(`Items Count: ${order.items?.length || 0}`);
          console.log(`Total Days: ${order.totalDays}`);
          console.log(`Paid Installments: ${order.paidInstallments}/${order.totalDays}`);
          console.log();
        });
      }
    } else {
      console.log('⚠️  Failed to fetch installment orders');
      console.log('Response:', JSON.stringify(installmentOrdersResult.data, null, 2));
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Check Complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
