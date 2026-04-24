/**
 * Check and Migrate User Order from Normal Orders to Installment Orders
 * Phone: 8897193576
 * Using Admin API endpoints
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';
const USER_PHONE = '8897193576';

let adminToken = null;
let userToken = null;
let userId = null;

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
    console.log('🔍 Checking User Orders and Migration Process');
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

    // Step 2: Get user by phone through auth endpoint
    console.log('🔍 Step 2: Finding user by phone...');

    // Try to login as the user (we don't have their password, so we'll use admin endpoints)
    // Let's try the regular orders endpoint with admin token

    // First, let's try to get all normal orders and filter by user
    console.log('   Trying to access normal orders endpoint...');
    const normalOrdersResult = await makeRequest(
      'GET',
      `/api/orders`,
      null,
      adminToken
    );

    console.log(`   Normal orders response: ${normalOrdersResult.statusCode}`);
    if (normalOrdersResult.statusCode === 200) {
      console.log('   Response data keys:', Object.keys(normalOrdersResult.data));
    } else {
      console.log('   Error:', JSON.stringify(normalOrdersResult.data, null, 2));
    }

    // Try installment orders
    console.log('\n   Trying to access installment orders endpoint...');
    const installmentOrdersResult = await makeRequest(
      'GET',
      `/api/installments/admin/orders/all`,
      null,
      adminToken
    );

    console.log(`   Installment orders response: ${installmentOrdersResult.statusCode}`);
    if (installmentOrdersResult.statusCode === 200) {
      console.log('   Response data:', JSON.stringify(installmentOrdersResult.data, null, 2).substring(0, 500));
    } else {
      console.log('   Error:', JSON.stringify(installmentOrdersResult.data, null, 2));
    }

    console.log('\n✅ Initial exploration complete!');
    console.log('\nℹ️  Next steps:');
    console.log('   1. We need to find the correct endpoint to search users by phone');
    console.log('   2. Then get all normal orders for this user');
    console.log('   3. Then create equivalent installment orders');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
