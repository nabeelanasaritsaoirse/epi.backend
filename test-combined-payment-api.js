/**
 * Test Script for Combined Daily Payment API
 *
 * Tests the new combined payment functionality that allows
 * users to pay multiple orders' daily installments in one transaction.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api/installments';
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE'; // Replace with valid token

// Test data
const testConfig = {
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

/**
 * Step 1: Get daily pending payments
 */
async function getDailyPendingPayments() {
  console.log('\n📋 Step 1: Getting daily pending payments...\n');

  try {
    const response = await axios.get(
      `${BASE_URL}/payments/daily-pending`,
      testConfig
    );

    console.log('✅ Success!');
    console.log(`   Count: ${response.data.data.count}`);
    console.log(`   Total Amount: ₹${response.data.data.totalAmount}`);
    console.log('\n   Pending Payments:');

    response.data.data.payments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.orderId} - ${payment.productName}`);
      console.log(`      Amount: ₹${payment.amount}, Installment: #${payment.installmentNumber}`);
    });

    return response.data.data.payments.map(p => p.orderId);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 2: Create combined Razorpay order
 */
async function createCombinedRazorpayOrder(selectedOrders) {
  console.log('\n💳 Step 2: Creating combined Razorpay order...\n');

  try {
    const response = await axios.post(
      `${BASE_URL}/payments/create-combined-razorpay`,
      { selectedOrders },
      testConfig
    );

    console.log('✅ Success!');
    console.log(`   Razorpay Order ID: ${response.data.data.razorpayOrderId}`);
    console.log(`   Total Amount: ₹${response.data.data.totalAmount}`);
    console.log(`   Order Count: ${response.data.data.orderCount}`);
    console.log('\n   Orders included:');

    response.data.data.orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.orderId} - ${order.productName} (₹${order.dailyAmount}/day)`);
    });

    return response.data.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Step 3: Process combined payment (Wallet)
 */
async function processCombinedPaymentWallet(selectedOrders) {
  console.log('\n💰 Step 3: Processing combined payment via WALLET...\n');

  try {
    const response = await axios.post(
      `${BASE_URL}/payments/pay-daily-selected`,
      {
        selectedOrders,
        paymentMethod: 'WALLET'
      },
      testConfig
    );

    console.log('✅ Success!');
    console.log(`   Message: ${response.data.message}`);
    console.log(`   Orders Processed: ${response.data.data.ordersProcessed}`);
    console.log(`   Total Amount: ₹${response.data.data.totalAmount}`);
    console.log('\n   Payment Details:');

    response.data.data.payments.forEach((payment, index) => {
      console.log(`   ${index + 1}. ${payment.orderId}`);
      console.log(`      Payment ID: ${payment.paymentId}`);
      console.log(`      Amount: ₹${payment.amount}`);
      console.log(`      Installment: #${payment.installmentNumber}`);
      console.log(`      Order Status: ${payment.orderStatus}`);
    });

    if (response.data.data.commissions && response.data.data.commissions.length > 0) {
      console.log('\n   💸 Commissions Credited:');
      response.data.data.commissions.forEach((comm, index) => {
        console.log(`   ${index + 1}. Order ${comm.orderId}: ₹${comm.commissionAmount}`);
      });
    }

    return response.data.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Testing Combined Daily Payment API');
  console.log('=====================================\n');

  try {
    // Test 1: Get pending payments
    const pendingOrders = await getDailyPendingPayments();

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('\n⚠️  No pending payments found. Please create some test orders first.');
      return;
    }

    // Select first 2-3 orders for testing
    const selectedOrders = pendingOrders.slice(0, Math.min(3, pendingOrders.length));
    console.log(`\n📌 Selected ${selectedOrders.length} orders for testing: ${selectedOrders.join(', ')}`);

    // Test 2: Create combined Razorpay order
    await createCombinedRazorpayOrder(selectedOrders);

    // Test 3: Process combined payment via Wallet
    // Note: This will actually process the payment!
    // Comment out if you don't want to make real payments

    console.log('\n⚠️  Skipping actual payment processing in test mode.');
    console.log('   To test payment processing, uncomment the line below:');
    console.log('   await processCombinedPaymentWallet(selectedOrders);');

    // await processCombinedPaymentWallet(selectedOrders);

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📚 API Summary:');
    console.log('   1. GET  /api/installments/payments/daily-pending');
    console.log('   2. POST /api/installments/payments/create-combined-razorpay');
    console.log('   3. POST /api/installments/payments/pay-daily-selected');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run tests
if (ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
  console.log('⚠️  Please set ACCESS_TOKEN in the script before running tests!');
  console.log('\n📝 How to get access token:');
  console.log('   1. Login via POST /api/auth/login');
  console.log('   2. Copy the accessToken from response');
  console.log('   3. Replace YOUR_ACCESS_TOKEN_HERE with actual token\n');
} else {
  runTests();
}
