/**
 * Migrate Normal Order to Installment Order
 * User Phone: 8897193576
 *
 * This script will:
 * 1. Check existing installment orders for this user
 * 2. Create a new installment order with the same details as the normal order
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// User details from normal order
const USER_ID = '694a453ef1deff8edfdd194b';
const USER_PHONE = '8897193576';
const PRODUCT_ID = '693babf155ab8ac6ec1cb7fb';

// Order details
const ORDER_DETAILS = {
  productId: '693babf155ab8ac6ec1cb7fb',
  totalAmount: 460,
  dailyAmount: 92,
  totalDays: 5,
  deliveryAddress: {
    name: "Punagani Suresh Babu",
    phoneNumber: "8897193576",
    addressLine1: "Balaji venture",
    addressLine2: "",
    city: "Darsi",
    state: "Andhra Pradesh",
    pincode: "523247",
    country: "India"
  },
  referredBy: "694a3d8ff1deff8edfdce8b0"
};

let adminToken = null;
let userToken = null;

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
    console.log('🚀 Migrating Normal Order to Installment Order');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Product ID: ${PRODUCT_ID}`);
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

    // Step 2: Check existing installment orders for this user
    console.log('🔍 Step 2: Checking existing installment orders...');
    const installmentOrdersResult = await makeRequest(
      'GET',
      `/api/installments/admin/orders/all?userId=${USER_ID}`,
      null,
      adminToken
    );

    if (installmentOrdersResult.statusCode === 200) {
      const orders = installmentOrdersResult.data.data.orders || [];
      console.log(`✅ Found ${orders.length} existing installment order(s) for this user\n`);

      if (orders.length > 0) {
        console.log('📋 Existing Installment Orders:');
        orders.forEach((order, idx) => {
          console.log(`   ${idx + 1}. Order ID: ${order._id}`);
          console.log(`      Created: ${order.createdAt}`);
          console.log(`      Status: ${order.status}`);
          console.log(`      Amount: ₹${order.totalAmount}`);
        });
        console.log();
      }
    } else {
      console.log('⚠️  Could not fetch existing installment orders');
      console.log('Response:', JSON.stringify(installmentOrdersResult.data, null, 2));
    }

    // Step 3: Check the product details
    console.log('📦 Step 3: Fetching product details...');
    const productResult = await makeRequest(
      'GET',
      `/api/products/${PRODUCT_ID}`,
      null,
      adminToken
    );

    if (productResult.statusCode !== 200) {
      console.log('⚠️  Product may be deleted or unavailable');
      console.log('Response:', JSON.stringify(productResult.data, null, 2));
      console.log('\n⚠️  NOTE: The product is marked as deleted in the normal order.');
      console.log('You may need to restore the product or use a different product ID.');
    } else {
      const product = productResult.data.data || productResult.data;
      console.log('✅ Product found:');
      console.log(`   Name: ${product.name}`);
      console.log(`   Price: ₹${product.pricing?.finalPrice || 0}`);
      console.log(`   Status: ${product.status}`);
      console.log(`   Deleted: ${product.isDeleted}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📝 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`\nUser Details:`);
    console.log(`   User ID: ${USER_ID}`);
    console.log(`   Phone: ${USER_PHONE}`);
    console.log(`   Name: ${ORDER_DETAILS.deliveryAddress.name}`);

    console.log(`\nOrder Details to Migrate:`);
    console.log(`   Product ID: ${ORDER_DETAILS.productId}`);
    console.log(`   Total Amount: ₹${ORDER_DETAILS.totalAmount}`);
    console.log(`   Daily Amount: ₹${ORDER_DETAILS.dailyAmount}`);
    console.log(`   Total Days: ${ORDER_DETAILS.totalDays}`);
    console.log(`   Delivery Address:`);
    console.log(`      ${ORDER_DETAILS.deliveryAddress.name}`);
    console.log(`      ${ORDER_DETAILS.deliveryAddress.addressLine1}`);
    console.log(`      ${ORDER_DETAILS.deliveryAddress.city}, ${ORDER_DETAILS.deliveryAddress.state} - ${ORDER_DETAILS.deliveryAddress.pincode}`);

    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('1. The product (693babf155ab8ac6ec1cb7fb) is marked as DELETED');
    console.log('2. You may need to either:');
    console.log('   a) Restore the product first');
    console.log('   b) Or use a different active product for testing');
    console.log('\n3. To create the installment order, we need:');
    console.log('   - User to be logged in (user token)');
    console.log('   - OR an admin endpoint to create orders on behalf of users');

    console.log('\n📋 NEXT STEPS:');
    console.log('1. Check if there\'s an admin endpoint to create installment orders');
    console.log('2. If not, we need to get the user\'s auth token');
    console.log('3. Or we can directly insert into the database using a backend script');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
