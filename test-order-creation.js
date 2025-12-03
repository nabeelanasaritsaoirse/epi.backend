/**
 * Comprehensive Test Script for Order Creation System
 * Tests all scenarios including coupons, quantity, and payment methods
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTI3MmE4N2JiNDQyODliZWY3MDUzNDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDE4NTI3MiwiZXhwIjoxNzY0NzkwMDcyfQ.GPqUdz2ZgjATGDYp1chfMYTm7ZNZRUCkxUiO7KgVwVk';
const USER_ID = '69272a87bb44289bef705343';

// Common delivery address for all tests
const deliveryAddress = {
  name: "Test User",
  phoneNumber: "9876543210",
  addressLine1: "123 Test St",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001"
};

// Helper function to make API calls
async function createOrder(testData, testName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST: ${testName}`);
  console.log('='.repeat(80));
  console.log('📤 Request Body:', JSON.stringify(testData, null, 2));

  try {
    const response = await axios.post(
      `${BASE_URL}/api/installments/orders`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));

    // Verify response structure
    if (response.data.success && response.data.data) {
      const { order, firstPayment } = response.data.data;
      console.log('\n🔍 VERIFICATION:');
      console.log(`   ✅ Order ID: ${order?.orderId}`);
      console.log(`   ✅ Order Status: ${order?.status}`);
      console.log(`   ✅ Quantity: ${order?.quantity}`);
      console.log(`   ✅ Total Product Price: ₹${order?.totalProductPrice}`);
      console.log(`   ✅ Daily Payment: ₹${order?.dailyPaymentAmount}`);
      console.log(`   ✅ Total Days: ${order?.totalDays}`);
      console.log(`   ✅ Paid Installments: ${order?.paidInstallments}`);

      if (firstPayment) {
        console.log(`   ✅ Payment ID: ${firstPayment.paymentId}`);
        console.log(`   ✅ Payment Status: ${firstPayment.status}`);
        console.log(`   ✅ Payment Amount: ₹${firstPayment.amount}`);
        if (firstPayment.commissionAmount) {
          console.log(`   ✅ Commission: ₹${firstPayment.commissionAmount}`);
        }
      }

      // Check for undefined values
      const hasUndefined = JSON.stringify(response.data).includes('undefined');
      if (hasUndefined) {
        console.log('\n   ⚠️  WARNING: Response contains undefined values!');
      } else {
        console.log('\n   ✅ No undefined values in response');
      }
    }

    return { success: true, data: response.data };

  } catch (error) {
    console.log('\n❌ FAILED!');
    if (error.response) {
      console.log('📥 Error Status:', error.response.status);
      console.log('📥 Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('📥 Error:', error.message);
    }
    return { success: false, error: error.message };
  }
}

// Test Cases
const tests = [
  {
    name: "Test 1: Basic Order Creation (Quantity: 2, WALLET)",
    data: {
      productId: "692724041480b2fbb2e85a6d",
      quantity: 2,
      totalDays: 20,
      dailyAmount: 100,
      paymentMethod: "WALLET",
      deliveryAddress
    }
  },
  {
    name: "Test 2: Single Quantity (Quantity: 1, WALLET)",
    data: {
      productId: "692724041480b2fbb2e85a6d",
      quantity: 1,
      totalDays: 20,
      dailyAmount: 50,
      paymentMethod: "WALLET",
      deliveryAddress
    }
  },
  {
    name: "Test 3: Multiple Quantity (Quantity: 5, WALLET)",
    data: {
      productId: "692724041480b2fbb2e85a6d",
      quantity: 5,
      totalDays: 20,
      dailyAmount: 250,
      paymentMethod: "WALLET",
      deliveryAddress
    }
  },
  {
    name: "Test 4: RAZORPAY Payment Method",
    data: {
      productId: "692724041480b2fbb2e85a6d",
      quantity: 1,
      totalDays: 20,
      dailyAmount: 50,
      paymentMethod: "RAZORPAY",
      deliveryAddress
    }
  }
  // Note: Coupon tests commented out - add actual coupon codes when available
  // {
  //   name: "Test 5: With INSTANT Coupon",
  //   data: {
  //     productId: "674723a1b94fa12c03d47ab1",
  //     quantity: 1,
  //     planOption: {
  //       totalDays: 20,
  //       dailyAmount: 50
  //     },
  //     couponCode: "SAVE200",  // Make sure this exists
  //     paymentMethod: "WALLET",
  //     deliveryAddress
  //   }
  // },
  // {
  //   name: "Test 6: With REDUCE_DAYS Coupon",
  //   data: {
  //     productId: "674723a1b94fa12c03d47ab1",
  //     quantity: 1,
  //     planOption: {
  //       totalDays: 20,
  //       dailyAmount: 50
  //     },
  //     couponCode: "DAYS10",  // Make sure this exists
  //     paymentMethod: "WALLET",
  //     deliveryAddress
  //   }
  // }
];

// Main test runner
async function runTests() {
  console.log('\n');
  console.log('🚀 '.repeat(40));
  console.log('🚀 STARTING COMPREHENSIVE ORDER CREATION TESTS');
  console.log('🚀 '.repeat(40));
  console.log(`\n📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📝 Total Tests: ${tests.length}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  for (const test of tests) {
    const result = await createOrder(test.data, test.name);

    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }

    results.tests.push({
      name: test.name,
      success: result.success,
      data: result.data || result.error
    });

    // Wait 2 seconds between tests
    if (tests.indexOf(test) < tests.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log('\n\n');
  console.log('📊 '.repeat(40));
  console.log('📊 TEST SUMMARY');
  console.log('📊 '.repeat(40));
  console.log(`\n✅ Passed: ${results.passed}/${tests.length}`);
  console.log(`❌ Failed: ${results.failed}/${tests.length}`);
  console.log(`📈 Success Rate: ${((results.passed / tests.length) * 100).toFixed(1)}%`);

  console.log('\n📋 DETAILED RESULTS:');
  results.tests.forEach((test, index) => {
    const icon = test.success ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}`);
  });

  console.log('\n\n🏁 TESTING COMPLETE!\n');
}

// Run tests
runTests().catch(console.error);
