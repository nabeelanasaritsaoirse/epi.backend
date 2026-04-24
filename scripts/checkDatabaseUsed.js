/**
 * Check which database is being used by the production API
 * This will help identify if orders are being saved to a different database
 */

const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function checkDatabaseUsed() {
  try {
    console.log('\n========================================');
    console.log('🔍 Checking Database Configuration');
    console.log('========================================\n');

    // Step 1: Admin Login
    console.log('1️⃣ Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/adminLogin`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data.success) {
      console.error('❌ Admin login failed:', loginResponse.data.message);
      return;
    }

    const adminToken = loginResponse.data.data.token;
    console.log('✅ Admin logged in successfully\n');

    // Step 2: Try to get all installment orders to see what's in the database
    console.log('2️⃣ Fetching all installment orders from production...');
    const ordersResponse = await axios.get(
      `${BASE_URL}/api/installments/admin/orders/all?limit=10`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    if (ordersResponse.data.success) {
      console.log(`✅ Found ${ordersResponse.data.data.orders.length} orders in database`);
      console.log('\n📋 Recent Orders:');
      ordersResponse.data.data.orders.forEach(order => {
        console.log(`  - ${order.orderId} (${order._id})`);
        console.log(`    User: ${order.user}`);
        console.log(`    Product: ${order.productName}`);
        console.log(`    Status: ${order.status}`);
        console.log(`    Created: ${order.createdAt}`);
        console.log('');
      });
    }

    // Step 3: Check for the specific order
    console.log('\n3️⃣ Looking for order: ORD-20251224-8812');
    const targetOrder = ordersResponse.data.data.orders.find(
      o => o.orderId === 'ORD-20251224-8812'
    );

    if (targetOrder) {
      console.log('✅ Order found in production database!');
      console.log('Order details:', JSON.stringify(targetOrder, null, 2));
    } else {
      console.log('❌ Order NOT found in production database');
      console.log('\n💡 This confirms the order was created in a different environment/database');
    }

    // Step 4: Get user orders
    console.log('\n4️⃣ Checking if the user exists in production database...');
    const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNhYjJhOTZiOTY0NjlkYzc5YWU4ZDYiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NjU2NTE0OCwiZXhwIjoxNzY3MTY5OTQ4fQ.4Q54fDaAptZV9l7aQQgCk9Ft2IepSnlb-X5WyZmdrCI';

    try {
      const userOrdersResponse = await axios.get(
        `${BASE_URL}/api/installments/orders`,
        {
          headers: {
            Authorization: `Bearer ${USER_TOKEN}`
          }
        }
      );

      if (userOrdersResponse.data.success) {
        console.log(`✅ User has ${userOrdersResponse.data.data.orders.length} orders in production`);
        if (userOrdersResponse.data.data.orders.length > 0) {
          console.log('\n📋 User Orders:');
          userOrdersResponse.data.data.orders.forEach(order => {
            console.log(`  - ${order.orderId} (${order._id}) - ${order.status}`);
          });
        }
      }
    } catch (userError) {
      if (userError.response?.status === 401) {
        console.log('❌ User token is invalid or expired in production');
      } else {
        console.log('❌ Error fetching user orders:', userError.message);
      }
    }

    console.log('\n========================================');
    console.log('📊 Summary:');
    console.log('========================================');
    console.log('The order ORD-20251224-8812 was likely created in:');
    console.log('  - Local development database (mongodb://localhost:27017/your_database)');
    console.log('\nBut you are trying to process payment on:');
    console.log('  - Production database (https://api.epielio.com)');
    console.log('\n💡 Solution: Create a NEW order on production before processing payment');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkDatabaseUsed();
