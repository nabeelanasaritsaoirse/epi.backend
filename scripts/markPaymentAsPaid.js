/**
 * Mark First Payment as Paid for User's Order
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Payment details from previous script
const PAYMENT_ID = '694f765dee396ed3b23748e8'; // Update this with actual payment ID
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
    console.log('💳 Marking Payment as Paid');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`Payment ID: ${PAYMENT_ID}`);
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

    // Step 2: Mark payment as paid
    console.log('💰 Step 2: Marking payment as paid...');
    const markPaidResult = await makeRequest(
      'POST',
      `/api/installments/admin/payments/${PAYMENT_ID}/mark-paid`,
      {
        transactionId: 'ADMIN_MANUAL_PAYMENT',
        note: 'First payment marked as paid by admin for migrated order from normal API',
        paymentMethod: 'WALLET'
      },
      adminToken
    );

    console.log(`Response Status: ${markPaidResult.statusCode}`);

    if (markPaidResult.statusCode === 200) {
      console.log('\n✅ SUCCESS! Payment marked as paid!\n');

      const payment = markPaidResult.data.data.payment;
      console.log('📋 PAYMENT DETAILS:');
      console.log('='.repeat(70));
      console.log(`Payment ID: ${payment._id}`);
      console.log(`Payment Number: ${payment.paymentId}`);
      console.log(`Amount: ₹${payment.amount}`);
      console.log(`Status: ${payment.status}`);
      console.log(`Payment Method: ${payment.paymentMethod}`);
      console.log(`Transaction ID: ${payment.transactionId}`);
      console.log(`Paid At: ${payment.paidAt}`);

      if (payment.commissionAmount) {
        console.log(`\n💰 Commission: ₹${payment.commissionAmount}`);
        console.log(`Commission Credited: ${payment.commissionCreditedToReferrer ? '✅ Yes' : '❌ No'}`);
      }

      console.log('\n✅ First payment successfully completed!');
      console.log('✅ Order is now ACTIVE');
      console.log('✅ User can make remaining payments');

    } else {
      console.log('\n❌ FAILED to mark payment as paid');
      console.log('Response:', JSON.stringify(markPaidResult.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
