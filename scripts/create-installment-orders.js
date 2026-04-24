/**
 * Create Installment Order for User 8897193576
 *
 * This will create the same order that user created via wrong API
 * in the correct installment API
 */

const https = require('https');

const BASE_URL = 'api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// User details (from normal order)
const USER_ID = '694a453ef1deff8edfdd194b';
const PRODUCT_ID = '693babf155ab8ac6ec1cb7fb'; // Now restored!

// Order data (from normal order)
const ORDER_DATA = {
  userId: USER_ID,
  productId: PRODUCT_ID,
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
  paymentMethod: 'RAZORPAY', // Changed to RAZORPAY since user has no wallet balance
  autoPayFirstInstallment: true // First payment auto mark as done by admin
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
    console.log('🚀 Creating Installment Order for User');
    console.log(`Base URL: https://${BASE_URL}`);
    console.log(`User: Punagani Suresh Babu (${USER_ID})`);
    console.log(`Phone: 8897193576`);
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

    // Step 2: Verify product is active
    console.log('📦 Step 2: Verifying product status...');
    const productResult = await makeRequest(
      'GET',
      `/api/products/${PRODUCT_ID}`,
      null,
      adminToken
    );

    if (productResult.statusCode === 200) {
      const product = productResult.data.data || productResult.data;
      console.log('✅ Product found:');
      console.log(`   Name: ${product.name}`);
      console.log(`   Price: ₹${product.pricing?.finalPrice || 0}`);
      console.log(`   Is Deleted: ${product.isDeleted}`);
      console.log(`   Status: ${product.status}`);

      if (product.isDeleted) {
        console.log('\n❌ ERROR: Product is still deleted!');
        console.log('Please restore the product first.');
        return;
      }
      console.log('   ✅ Product is active and ready for orders\n');
    } else {
      console.log('⚠️  Could not verify product');
      console.log('Proceeding anyway...\n');
    }

    // Step 3: Create installment order
    console.log('📝 Step 3: Creating installment order...');
    console.log('Order Details:');
    console.log(`   Product: Mee Mee Premium Steel Feeding Bottle Silver`);
    console.log(`   Amount: ₹460`);
    console.log(`   Daily Payment: ₹92`);
    console.log(`   Total Days: 5`);
    console.log(`   Payment Method: WALLET`);
    console.log(`   Auto-pay first installment: YES`);
    console.log();

    const createResult = await makeRequest(
      'POST',
      '/api/installments/admin/orders/create-for-user',
      ORDER_DATA,
      adminToken
    );

    console.log(`Response Status: ${createResult.statusCode}`);

    if (createResult.statusCode === 201 || createResult.statusCode === 200) {
      console.log('\n🎉 SUCCESS! Installment order created!\n');

      const order = createResult.data.data.order;
      const firstPayment = createResult.data.data.firstPayment;

      console.log('📋 ORDER DETAILS:');
      console.log('='.repeat(70));
      console.log(`Order ID: ${order._id}`);
      console.log(`Order Number: ${order.orderId}`);
      console.log(`Status: ${order.status}`);
      console.log(`Total Amount: ₹${order.totalAmount}`);
      console.log(`Daily Amount: ₹${order.dailyInstallmentAmount}`);
      console.log(`Total Days: ${order.totalDays}`);
      console.log(`Paid Installments: ${order.paidInstallments}/${order.totalDays}`);
      console.log(`Created By Admin: ${order.createdByAdmin}`);
      console.log(`Created By: ${order.createdByAdminEmail}`);

      if (order.referrer) {
        console.log(`\n💰 COMMISSION INFO:`);
        console.log(`Referrer ID: ${order.referrer}`);
        console.log(`Commission %: ${order.commissionPercentage}%`);
        console.log(`Commission Amount: ₹${(order.dailyInstallmentAmount * order.commissionPercentage / 100).toFixed(2)}`);
      }

      if (firstPayment) {
        console.log(`\n💳 FIRST PAYMENT:`);
        console.log(`Payment ID: ${firstPayment._id}`);
        console.log(`Payment Number: ${firstPayment.paymentId}`);
        console.log(`Amount: ₹${firstPayment.amount}`);
        console.log(`Status: ${firstPayment.status}`);
        console.log(`Payment Method: ${firstPayment.paymentMethod}`);

        if (firstPayment.commissionAmount) {
          console.log(`Commission: ₹${firstPayment.commissionAmount}`);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('✅ Order successfully created in installment system!');
      console.log('✅ First payment marked as completed');
      console.log('✅ Commission credited to referrer (if applicable)');
      console.log('='.repeat(70));

      // Show next steps
      console.log('\n📝 NEXT STEPS:');
      console.log('1. Verify order in admin panel');
      console.log('2. Check if commission was credited to referrer');
      console.log('3. User can continue with remaining payments');
      console.log(`4. Order URL: https://api.epielio.com/api/installments/admin/orders/${order._id}`);

    } else {
      console.log('\n❌ FAILED to create order');
      console.log('Status:', createResult.statusCode);
      console.log('Error:', createResult.data.message || 'Unknown error');
      console.log('\nFull Response:');
      console.log(JSON.stringify(createResult.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

main();
