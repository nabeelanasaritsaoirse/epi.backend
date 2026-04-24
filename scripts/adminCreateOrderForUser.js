/**
 * Admin Create Installment Order for User
 *
 * This script demonstrates how an admin can create an installment order
 * on behalf of a user and automatically mark the first payment as done.
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// User details (from previous order)
const USER_ID = '694a453ef1deff8edfdd194b'; // User: P SURESH BABU (8897193576)

// Order details - You need to provide an ACTIVE product
const ORDER_DATA = {
  userId: USER_ID,
  productId: '693babf155ab8ac6ec1cb7fb', // Mee Mee Premium Steel Feeding Bottle (Note: This is marked as deleted)
  totalDays: 5,
  shippingAddress: {
    fullName: 'Punagani Suresh Babu',
    phone: '8897193576',
    addressLine1: 'Balaji venture',
    addressLine2: '',
    city: 'Darsi',
    state: 'Andhra Pradesh',
    pincode: '523247',
    country: 'India'
  },
  paymentMethod: 'WALLET',
  autoPayFirstInstallment: true // Auto mark first payment as done
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
    console.log('🚀 Admin: Creating Installment Order for User');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`User ID: ${USER_ID}`);
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

    // Step 2: Create Order for User
    console.log('📦 Step 2: Creating installment order for user...');
    console.log('Order Details:');
    console.log(JSON.stringify(ORDER_DATA, null, 2));
    console.log();

    const createOrderResult = await makeRequest(
      'POST',
      '/api/installments/admin/orders/create-for-user',
      ORDER_DATA,
      adminToken
    );

    console.log(`Response Status: ${createOrderResult.statusCode}`);
    console.log('Response Data:', JSON.stringify(createOrderResult.data, null, 2));

    if (createOrderResult.statusCode === 201 || createOrderResult.statusCode === 200) {
      console.log('\n✅ SUCCESS! Order created successfully!');

      const order = createOrderResult.data.data.order;
      const firstPayment = createOrderResult.data.data.firstPayment;

      console.log('\n📋 Order Summary:');
      console.log(`   Order ID: ${order._id}`);
      console.log(`   Order Number: ${order.orderId}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total Amount: ₹${order.totalAmount}`);
      console.log(`   Daily Amount: ₹${order.dailyInstallmentAmount}`);
      console.log(`   Total Days: ${order.totalDays}`);
      console.log(`   Paid Installments: ${order.paidInstallments}/${order.totalDays}`);

      if (firstPayment) {
        console.log('\n💳 First Payment:');
        console.log(`   Payment ID: ${firstPayment._id}`);
        console.log(`   Amount: ₹${firstPayment.amount}`);
        console.log(`   Status: ${firstPayment.status}`);
        console.log(`   Payment Method: ${firstPayment.paymentMethod}`);
      }

      console.log('\n📝 Note:', createOrderResult.data.data.note);

    } else {
      console.log('\n❌ Failed to create order');
      console.log('Error:', createOrderResult.data.message || 'Unknown error');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Script Complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
