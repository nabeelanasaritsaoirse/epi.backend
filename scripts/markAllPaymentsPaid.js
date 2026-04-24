/**
 * Mark All Payments as Paid for User's Order
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Order ID from previous script
const ORDER_ID = '694f765dee396ed3b23748e6'; // Update this with actual order ID

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
    console.log('💰 Marking All Payments as Paid');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`Order ID: ${ORDER_ID}`);
    console.log('='.repeat(70) + '\n');

    // Step 1: Admin Login
    console.log('🔐 Step 1: Admin Login...');
    const loginResult = await makeRequest('POST', '/api/admin-auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (loginResult.statusCode !== 200) {
      console.log('❌ Admin login failed');
      return;
    }

    adminToken = loginResult.data.data.accessToken;
    console.log('✅ Admin logged in successfully\n');

    // Step 2: Mark all payments as paid
    console.log('💸 Step 2: Marking all payments as paid...');
    const markAllPaidResult = await makeRequest(
      'POST',
      `/api/installments/admin/orders/${ORDER_ID}/mark-all-paid`,
      {
        note: 'All payments marked as paid by admin - Order migrated from normal API to installment API'
      },
      adminToken
    );

    console.log(`Response Status: ${markAllPaidResult.statusCode}`);

    if (markAllPaidResult.statusCode === 200) {
      console.log('\n🎉 SUCCESS! All payments marked as paid!\n');

      const data = markAllPaidResult.data.data;
      const order = data.order;

      console.log('📋 ORDER SUMMARY:');
      console.log('='.repeat(70));
      console.log(`Order ID: ${order._id}`);
      console.log(`Order Number: ${order.orderId}`);
      console.log(`Status: ${order.status}`);
      console.log(`Total Amount: ₹${order.totalAmount}`);
      console.log(`Paid Installments: ${order.paidInstallments}/${order.totalDays}`);
      console.log(`Total Paid: ₹${order.totalPaidAmount}`);
      console.log(`\n📊 Payment Stats:`);
      console.log(`   Payments Marked: ${data.paymentsMarked}`);
      console.log(`   Total Pending: ${data.totalPending}`);

      console.log('\n✅ Order is now COMPLETED!');
      console.log('✅ User received the product (virtually marked as paid)');
      console.log('✅ Commission credited to referrer');
      console.log('='.repeat(70));

    } else {
      console.log('\n❌ FAILED to mark all payments as paid');
      console.log('Response:', JSON.stringify(markAllPaidResult.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
