const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';

async function checkVivaanAutopay() {
  try {
    console.log('=== Checking Autopay for vivaanp410@gmail.com ===\n');

    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    const adminLogin = await axios.post(`${BASE_URL}/api/auth/admin-login`, {
      email: 'admin@epi.com',
      password: '@Saoirse123'
    });

    const adminToken = adminLogin.data.data?.accessToken;
    console.log('✅ Admin logged in\n');

    // Step 2: Get user details
    console.log('Step 2: Finding user...');
    const usersResponse = await axios.get(`${BASE_URL}/api/sales/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const users = usersResponse.data.data?.users || [];
    const targetUser = users.find(u => u.email === 'vivaanp410@gmail.com');

    if (!targetUser) {
      console.log('❌ User not found with email: vivaanp410@gmail.com');

      // Search for similar users
      const similarUsers = users.filter(u =>
        u.email?.toLowerCase().includes('vivaan') ||
        u.name?.toLowerCase().includes('vivaan')
      );

      if (similarUsers.length > 0) {
        console.log('\n=== Similar users found ===');
        similarUsers.forEach((u, idx) => {
          console.log(`${idx + 1}. ${u.name} (${u.email})`);
        });
      }
      return;
    }

    console.log('✅ User found!');
    console.log('\n=== User Details ===');
    console.log('User ID:', targetUser._id);
    console.log('Name:', targetUser.name);
    console.log('Email:', targetUser.email);
    console.log('Phone:', targetUser.phoneNumber || 'Not provided');
    console.log('Wallet Balance:', targetUser.wallet?.balance || 0);
    console.log('');

    // Step 3: Check autopay settings
    console.log('=== Autopay Settings (User-Level) ===');
    if (targetUser.autopaySettings) {
      console.log('Enabled:', targetUser.autopaySettings.enabled ? '✅ YES' : '❌ NO');
      console.log('Time Preference:', targetUser.autopaySettings.timePreference || 'MORNING_6AM');
      console.log('Minimum Balance Lock:', targetUser.autopaySettings.minimumBalanceLock || 0);
      console.log('Low Balance Threshold:', targetUser.autopaySettings.lowBalanceThreshold || 500);
      console.log('Send Daily Reminder:', targetUser.autopaySettings.sendDailyReminder !== false ? 'YES' : 'NO');
      console.log('Reminder Hours Before:', targetUser.autopaySettings.reminderHoursBefore || 1);
      console.log('');

      // Show time in IST
      const timePreference = targetUser.autopaySettings.timePreference || 'MORNING_6AM';
      console.log('⏰ Autopay Deduction Time (IST):');
      if (timePreference === 'MORNING_6AM') {
        console.log('   6:00 AM IST (India Time)');
      } else if (timePreference === 'AFTERNOON_12PM') {
        console.log('   12:00 PM IST (India Time)');
      } else if (timePreference === 'EVENING_6PM') {
        console.log('   6:00 PM IST (India Time)');
      }
      console.log('');
    } else {
      console.log('❌ No autopay settings found');
      console.log('');
    }

    // Step 4: Check user's orders
    console.log('=== User Orders ===');
    try {
      const ordersResponse = await axios.get(
        `${BASE_URL}/api/sales/users/${targetUser._id}/orders`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      const orders = ordersResponse.data.data?.orders || ordersResponse.data.orders || [];
      console.log(`Total Orders: ${orders.length}\n`);

      if (orders.length > 0) {
        orders.forEach((order, idx) => {
          console.log(`${idx + 1}. Order ID: ${order._id || order.orderId}`);
          console.log(`   Product: ${order.productName || order.product?.name || 'N/A'}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Total Days: ${order.totalDays || 'N/A'}`);
          console.log(`   Paid Installments: ${order.paidInstallments || 0}`);
          console.log(`   Total Paid: ₹${order.totalPaidAmount || 0}`);
          console.log(`   Remaining: ₹${order.remainingAmount || 0}`);
          console.log(`   Order Autopay: ${order.autopay?.enabled ? '✅ ENABLED' : '❌ NOT ENABLED'}`);

          if (order.autopay?.enabled) {
            console.log(`   Autopay Priority: ${order.autopay.priority || 1}`);
            if (order.autopay.pausedUntil) {
              console.log(`   ⚠️  PAUSED until: ${new Date(order.autopay.pausedUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
            }
          }
          console.log('');
        });
      } else {
        console.log('⚠️  User has no orders\n');
      }
    } catch (err) {
      console.log('Error fetching orders:', err.response?.data?.message || err.message);
      console.log('');
    }

    // Step 5: Check wallet transactions
    console.log('=== Recent Wallet Transactions ===');
    console.log('Note: This requires direct database access or specific API endpoint');
    console.log('');

    // Step 6: Analysis
    console.log('=== AUTOPAY STATUS ANALYSIS ===');

    if (!targetUser.autopaySettings?.enabled) {
      console.log('❌ ISSUE: User-level autopay is NOT ENABLED');
      console.log('');
      console.log('Solution:');
      console.log('1. User needs to enable autopay in settings');
      console.log('2. Call: PUT /api/installments/autopay/settings');
      console.log('3. Body: { "enabled": true }');
      console.log('');
    } else {
      console.log('✅ User-level autopay is ENABLED');
      console.log('');
    }

    // Check if any orders have autopay enabled
    const ordersResponse = await axios.get(
      `${BASE_URL}/api/sales/users/${targetUser._id}/orders`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const orders = ordersResponse.data.data?.orders || ordersResponse.data.orders || [];
    const autopayOrders = orders.filter(o => o.autopay?.enabled);

    if (autopayOrders.length === 0 && orders.length > 0) {
      console.log('❌ ISSUE: User has orders but NO order has autopay enabled');
      console.log('');
      console.log('Solution:');
      console.log('1. User needs to enable autopay for each order');
      console.log('2. Call: POST /api/installments/autopay/enable/:orderId');
      console.log('3. Or enable for all orders: POST /api/installments/autopay/enable-all');
      console.log('');
    } else if (autopayOrders.length > 0) {
      console.log(`✅ ${autopayOrders.length} order(s) have autopay enabled`);
      console.log('');
    }

    // Check wallet balance
    const walletBalance = targetUser.wallet?.balance || 0;
    const minimumLock = targetUser.autopaySettings?.minimumBalanceLock || 0;
    const availableBalance = walletBalance - minimumLock;

    console.log('=== WALLET STATUS ===');
    console.log('Total Balance:', `₹${walletBalance}`);
    console.log('Minimum Lock:', `₹${minimumLock}`);
    console.log('Available for Autopay:', `₹${availableBalance}`);

    if (availableBalance <= 0) {
      console.log('');
      console.log('❌ ISSUE: Insufficient balance for autopay!');
      console.log('User needs to add money to wallet');
    }
    console.log('');

    console.log('=== NEXT STEPS ===');
    console.log('1. Check server logs for autopay cron job execution');
    console.log('2. Verify cron job is running at configured times');
    console.log('3. Check payment records for failed transactions');
    console.log('4. Ensure user has sufficient wallet balance');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkVivaanAutopay();
