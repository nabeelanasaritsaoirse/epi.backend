const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const USER_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function main() {
  console.log('\n' + '🔍'.repeat(40));
  console.log('   TESTING DAILY-PENDING API ENDPOINT');
  console.log('🔍'.repeat(40) + '\n');

  // Test 1: Check existing installment orders
  console.log('📋 TEST 1: Checking existing installment orders...\n');

  try {
    const ordersRes = await api.get('/api/installments/orders');
    const orders = ordersRes.data.data?.orders || ordersRes.data.orders || [];

    console.log(`✅ Found ${orders.length} installment orders\n`);

    if (orders.length > 0) {
      console.log('Existing orders:');
      orders.forEach((order, idx) => {
        console.log(`${idx + 1}. ${order.productName} - ${order.orderId}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Progress: ${order.paidInstallments}/${order.totalInstallments}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No installment orders found');
      console.log('   This user has only used the OLD order system (/api/orders)');
      console.log('   The daily-pending API only works with NEW installment orders\n');
    }
  } catch (error) {
    console.log('❌ Error:', error.response?.data?.message || error.message);
  }

  // Test 2: Check daily pending payments
  console.log('='.repeat(70));
  console.log('📋 TEST 2: Checking daily pending payments...\n');

  try {
    const pendingRes = await api.get('/api/installments/payments/daily-pending');
    const data = pendingRes.data.data || pendingRes.data;

    console.log('✅ Daily Pending Response:');
    console.log(`   Count: ${data.count}`);
    console.log(`   Total Amount: ₹${data.totalAmount}`);

    if (data.payments && data.payments.length > 0) {
      console.log('\n   Pending Payments:');
      data.payments.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.productName}`);
        console.log(`      Order: ${p.orderId}`);
        console.log(`      Installment: #${p.installmentNumber}`);
        console.log(`      Amount: ₹${p.amount}`);
        console.log(`      Due: ${new Date(p.dueDate).toLocaleDateString()}`);
      });
    } else {
      console.log('\n   ℹ️  No payments due today');
    }
  } catch (error) {
    console.log('❌ Error:', error.response?.data?.message || error.message);
  }

  // Show explanation
  console.log('\n' + '='.repeat(70));
  console.log('📊 EXPLANATION\n');
  console.log('Why daily-pending returns no data:\n');
  console.log('1. This user has 6 orders in the OLD system (/api/orders)');
  console.log('2. The daily-pending API only queries the NEW system (/api/installments/orders)');
  console.log('3. The user has 0 orders in the new system\n');
  console.log('Solution:');
  console.log('- Need to create orders using /api/installments/orders endpoint');
  console.log('- However, there\'s a bug preventing order creation (orderId validation)');
  console.log('- The bug is in services/installmentOrderService.js line 304-333');
  console.log('- The orderId field is required but not being set before save\n');
  console.log('='.repeat(70) + '\n');
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
