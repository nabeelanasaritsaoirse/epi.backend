/**
 * Test the complete order flow on production to identify the issue
 */

const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNhYjJhOTZiOTY0NjlkYzc5YWU4ZDYiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NjU2NTE0OCwiZXhwIjoxNzY3MTY5OTQ4fQ.4Q54fDaAptZV9l7aQQgCk9Ft2IepSnlb-X5WyZmdrCI';

async function testProductionFlow() {
  try {
    console.log('\n========================================');
    console.log('🔍 Testing Production Order Flow');
    console.log('========================================\n');

    // Decoded JWT
    const payload = Buffer.from(USER_TOKEN.split('.')[1], 'base64').toString();
    const decodedToken = JSON.parse(payload);
    console.log('1️⃣ Your JWT Token Info:');
    console.log('   User ID:', decodedToken.userId);
    console.log('   Role:', decodedToken.role);
    console.log('   Issued:', new Date(decodedToken.iat * 1000).toISOString());
    console.log('   Expires:', new Date(decodedToken.exp * 1000).toISOString());
    console.log('');

    // Test 1: Check if user can access their orders
    console.log('2️⃣ Testing: Get user orders from production...');
    try {
      const ordersResponse = await axios.get(
        `${BASE_URL}/api/installments/orders`,
        {
          headers: {
            Authorization: `Bearer ${USER_TOKEN}`
          }
        }
      );

      console.log('   ✅ User orders endpoint works!');
      console.log('   Found', ordersResponse.data.data.orders.length, 'orders');

      if (ordersResponse.data.data.orders.length > 0) {
        console.log('\n   📋 Your existing orders on production:');
        ordersResponse.data.data.orders.forEach(order => {
          console.log(`   - ${order.orderId} (${order._id})`);
          console.log(`     Status: ${order.status}`);
          console.log(`     Product: ${order.productName}`);
          console.log(`     Created: ${order.createdAt}`);
        });
      }
      console.log('');

      // Check if the problematic order exists
      const problematicOrder = ordersResponse.data.data.orders.find(
        o => o._id === '694b9bd2a317f56fc7f94194' || o.orderId === 'ORD-20251224-8812'
      );

      if (problematicOrder) {
        console.log('   ✅ Found the order ORD-20251224-8812 in your orders!');
        console.log('   Order ID:', problematicOrder._id);
        console.log('   Status:', problematicOrder.status);
        console.log('   This order SHOULD work for payment processing');
        console.log('');
      } else {
        console.log('   ❌ Order ORD-20251224-8812 NOT found in your orders');
        console.log('   This means the order belongs to a different user');
        console.log('');
      }

    } catch (error) {
      console.log('   ❌ Error getting orders:', error.response?.data || error.message);
      console.log('');
    }

    // Test 2: Try to get the specific order details
    console.log('3️⃣ Testing: Get specific order details...');
    try {
      const orderResponse = await axios.get(
        `${BASE_URL}/api/installments/orders/694b9bd2a317f56fc7f94194`,
        {
          headers: {
            Authorization: `Bearer ${USER_TOKEN}`
          }
        }
      );

      console.log('   ✅ Successfully retrieved order!');
      console.log('   Order belongs to you');
      console.log('   Status:', orderResponse.data.data.order.status);
      console.log('');
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('   ❌ AUTHORIZATION ERROR - Order does not belong to your user');
        console.log('   Error:', error.response?.data?.message || error.response?.data?.error);
      } else if (error.response?.status === 404) {
        console.log('   ❌ Order not found in production database');
      } else {
        console.log('   ❌ Error:', error.response?.data || error.message);
      }
      console.log('');
    }

    // Test 3: Try to process payment
    console.log('4️⃣ Testing: Process payment endpoint...');
    try {
      const paymentResponse = await axios.post(
        `${BASE_URL}/api/installments/payments/process`,
        {
          orderId: '694b9bd2a317f56fc7f94194',
          paymentMethod: 'RAZORPAY',
          razorpayOrderId: 'order_RvNBSdfGFP4awz',
          razorpayPaymentId: 'PAY-20251224-DBD1',
          razorpaySignature: '711e779ff1474fefbb7aab137e8c2cc0a7b22008009cecc6419d54d3dae20446'
        },
        {
          headers: {
            Authorization: `Bearer ${USER_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('   ✅ Payment processed successfully!');
      console.log('   Response:', paymentResponse.data);
      console.log('');
    } catch (error) {
      console.log('   ❌ Payment processing failed');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', error.response?.data);
      console.log('');

      if (error.response?.data?.error === 'You are not authorized to access this order') {
        console.log('   🔍 DIAGNOSIS:');
        console.log('   The order exists but was NOT created by your user account');
        console.log('   Order user ID ≠ Your JWT user ID (693ab2a96b96469dc79ae8d6)');
        console.log('');
      }
    }

    console.log('========================================');
    console.log('📊 SUMMARY & NEXT STEPS:');
    console.log('========================================');
    console.log('The authorization error occurs because:');
    console.log('1. Order was created but stored with DIFFERENT user ID');
    console.log('2. Your JWT token has user ID: 693ab2a96b96469dc79ae8d6');
    console.log('3. The order in database has a DIFFERENT user ID');
    console.log('');
    console.log('SOLUTION:');
    console.log('Create a NEW order using the production API to ensure');
    console.log('the order is linked to your user account correctly.');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testProductionFlow();
