/**
 * Test Script: Fetch Ongoing Orders (ACTIVE status)
 * This script tests the live API to get all ongoing installment orders
 */

const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

async function testOngoingOrdersAPI() {
  console.log('='.repeat(80));
  console.log('🔍 TESTING ONGOING ORDERS API');
  console.log('='.repeat(80));
  console.log();

  try {
    // Test 1: Get ALL orders
    console.log('📋 Test 1: Fetching ALL orders (no filter)');
    console.log('-'.repeat(80));
    const allOrdersResponse = await axios.get(
      `${BASE_URL}/api/installments/orders`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    console.log(`✅ Success! Total orders found: ${allOrdersResponse.data.data.count}`);
    console.log();

    if (allOrdersResponse.data.data.orders.length > 0) {
      console.log('📊 Orders by Status:');
      const statusCount = {};
      allOrdersResponse.data.data.orders.forEach(order => {
        statusCount[order.status] = (statusCount[order.status] || 0) + 1;
      });
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} order(s)`);
      });
      console.log();
    }

    // Test 2: Get ACTIVE orders only (ongoing orders)
    console.log('📋 Test 2: Fetching ACTIVE orders only (ongoing orders)');
    console.log('-'.repeat(80));
    const activeOrdersResponse = await axios.get(
      `${BASE_URL}/api/installments/orders?status=ACTIVE`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    console.log(`✅ Success! Ongoing orders found: ${activeOrdersResponse.data.data.count}`);
    console.log();

    if (activeOrdersResponse.data.data.orders.length > 0) {
      console.log('📦 ONGOING ORDERS DETAILS:');
      console.log('='.repeat(80));

      activeOrdersResponse.data.data.orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order.orderId}`);
        console.log(`   Product: ${order.productName}`);
        console.log(`   Total Price: ₹${order.totalProductPrice}`);
        console.log(`   Paid Amount: ₹${order.totalPaidAmount}`);
        console.log(`   Remaining: ₹${order.remainingAmount}`);
        console.log(`   Progress: ${order.paidInstallments}/${order.totalDays} days`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Delivery Status: ${order.deliveryStatus}`);

        // Calculate percentage
        const percentage = ((order.totalPaidAmount / order.totalProductPrice) * 100).toFixed(2);
        console.log(`   Completion: ${percentage}%`);

        // Next payment info
        const nextPending = order.paymentSchedule.find(p => p.status === 'PENDING');
        if (nextPending) {
          console.log(`   Next Due: ${new Date(nextPending.dueDate).toLocaleDateString()} - ₹${nextPending.amount}`);
        }
      });
      console.log();
      console.log('='.repeat(80));
    } else {
      console.log('⚠️  No ongoing orders found for this user');
      console.log('   (Orders with first payment done but not completed)');
    }

    // Test 3: Get PENDING orders (first payment not done)
    console.log('\n📋 Test 3: Fetching PENDING orders (first payment not done yet)');
    console.log('-'.repeat(80));
    const pendingOrdersResponse = await axios.get(
      `${BASE_URL}/api/installments/orders?status=PENDING`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    console.log(`✅ Success! Pending orders found: ${pendingOrdersResponse.data.data.count}`);
    console.log();

    // Test 4: Get COMPLETED orders
    console.log('📋 Test 4: Fetching COMPLETED orders');
    console.log('-'.repeat(80));
    const completedOrdersResponse = await axios.get(
      `${BASE_URL}/api/installment-orders?status=COMPLETED`,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    console.log(`✅ Success! Completed orders found: ${completedOrdersResponse.data.data.count}`);
    console.log();

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Orders: ${allOrdersResponse.data.data.count}`);
    console.log(`Ongoing (ACTIVE): ${activeOrdersResponse.data.data.count}`);
    console.log(`Pending (Not Started): ${pendingOrdersResponse.data.data.count}`);
    console.log(`Completed: ${completedOrdersResponse.data.data.count}`);
    console.log();
    console.log('✅ API Endpoint Working: /api/installment-orders?status=ACTIVE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error occurred:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data.message || error.response.data);
      console.error('   Error:', error.response.data.error);
    } else if (error.request) {
      console.error('   No response received from server');
      console.error('   Request:', error.message);
    } else {
      console.error('   Error:', error.message);
    }
  }
}

// Run the test
testOngoingOrdersAPI();
