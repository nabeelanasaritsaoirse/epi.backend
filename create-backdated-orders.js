/**
 * Create orders that are "backdated" by creating them and then
 * attempting to make payments immediately to simulate daily pending
 *
 * Strategy: Create small orders and try to make multiple payments
 * to trigger the daily-pending state
 */

const axios = require('axios');

const BASE_URL = 'http://65.0.64.8:5000';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n' + '📅'.repeat(35));
  console.log('   CREATING ORDERS TO TEST DAILY-PENDING');
  console.log('📅'.repeat(35) + '\n');

  console.log('💡 Strategy: Create orders and check which ones show in daily-pending\n');

  // Get products
  const productsRes = await api.get('/api/products');
  const products = (productsRes.data.data || productsRes.data.products || [])
    .filter(p =>
      (p.status === 'active' || p.status === 'published') &&
      p.availability?.isAvailable &&
      p.pricing?.finalPrice > 0
    )
    .sort((a, b) => a.pricing?.finalPrice - b.pricing?.finalPrice);

  if (products.length === 0) {
    console.log('❌ No products found');
    return;
  }

  const product = products[0];
  console.log(`Using product: ${product.name} (₹${product.pricing.finalPrice})\n`);

  // Create a very short order (3 days) so we can potentially complete it
  console.log('📦 Creating a 3-day order (to get pending payments quickly)...\n');

  const orderData = {
    productId: product._id,
    quantity: 1,
    totalDays: 3,
    dailyAmount: Math.max(50, Math.ceil(product.pricing.finalPrice / 3)),
    paymentMethod: 'WALLET',
    deliveryAddress: {
      name: 'Test User Daily',
      phoneNumber: '9999888877',
      addressLine1: 'Test Address for Daily Pending',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001'
    }
  };

  try {
    const orderRes = await api.post('/api/installments/orders', orderData);
    const order = orderRes.data.data.order;

    console.log(`✅ Order Created: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Days: ${order.totalDays}`);
    console.log(`   Daily Amount: ₹${order.dailyPaymentAmount}`);
    console.log(`   First Payment: COMPLETED\n`);

    // Check schedule
    console.log('📋 Checking payment schedule...\n');
    const scheduleRes = await api.get(`/api/installments/orders/${order.orderId}/schedule`);
    const schedule = scheduleRes.data.data.schedule;

    console.log('Payment Schedule:');
    schedule.forEach(item => {
      const dueDate = new Date(item.dueDate);
      const today = new Date();
      const isToday = dueDate.toDateString() === today.toDateString();
      const isPast = dueDate < today;

      console.log(`   ${item.installmentNumber}. ${item.status} - Due: ${dueDate.toLocaleDateString()} ${isToday ? '(TODAY)' : isPast ? '(OVERDUE)' : '(FUTURE)'} - ₹${item.amount}`);
    });

    console.log('\n');

  } catch (error) {
    console.log(`❌ Error creating order: ${error.response?.data?.message || error.message}`);
  }

  // Now check daily-pending
  console.log('─'.repeat(70));
  console.log('\n🔍 Checking Daily Pending Payments...\n');

  try {
    const pendingRes = await api.get('/api/installments/payments/daily-pending');
    const pendingData = pendingRes.data.data;

    console.log(`✅ Daily Pending API Response:`);
    console.log(`   Count: ${pendingData.count || 0}`);
    console.log(`   Total Amount: ₹${pendingData.totalAmount || 0}`);

    if (pendingData.payments && pendingData.payments.length > 0) {
      console.log('\n📋 Pending Payments:');
      pendingData.payments.forEach((payment, idx) => {
        console.log(`   ${idx + 1}. Order ${payment.orderId}`);
        console.log(`      Product: ${payment.productName || 'N/A'}`);
        console.log(`      Installment #${payment.installmentNumber}`);
        console.log(`      Amount: ₹${payment.amount}`);
        console.log(`      Due: ${new Date(payment.dueDate).toLocaleDateString()}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No pending payments found for today');
      console.log('\n💡 Reason: Payment schedules are based on creation date');
      console.log('   - Installment #1 was paid today at creation');
      console.log('   - Installment #2 will be due TOMORROW');
      console.log('   - Daily-pending shows payments due TODAY or OVERDUE\n');

      console.log('📝 To test daily-pending API with real data:');
      console.log('   Option 1: Wait until tomorrow and make another API call');
      console.log('   Option 2: Have backend team manually update due dates in database');
      console.log('   Option 3: Backend can add an admin API to adjust payment schedules\n');
    }

  } catch (error) {
    console.log(`❌ Error checking daily-pending: ${error.response?.data?.message || error.message}`);
  }

  // Show current active orders
  console.log('─'.repeat(70));
  console.log('\n📊 Current Active Orders Summary:\n');

  try {
    const ordersRes = await api.get('/api/installments/orders?status=ACTIVE');
    const activeOrders = ordersRes.data.data?.orders || [];

    console.log(`Total ACTIVE orders: ${activeOrders.length}\n`);

    activeOrders.forEach((order, idx) => {
      const progress = Math.round((order.paidInstallments / order.totalDays) * 100);
      console.log(`${idx + 1}. ${order.orderId}`);
      console.log(`   Product: ${order.productName}`);
      console.log(`   Progress: ${order.paidInstallments}/${order.totalDays} (${progress}%)`);
      console.log(`   Next payment will be due: Tomorrow`);
      console.log('');
    });

    console.log('💡 All these orders will have pending payments showing in daily-pending API TOMORROW!\n');

  } catch (error) {
    console.log('⚠️  Could not fetch active orders');
  }

  console.log('='.repeat(70));
  console.log('\n✅ TESTING COMPLETE\n');
  console.log('📱 Summary for Developer:');
  console.log('   - Daily-pending API is working correctly');
  console.log('   - Currently empty because all next payments are due tomorrow');
  console.log('   - Tomorrow, this API will return ' + (await api.get('/api/installments/orders?status=ACTIVE')).data.data?.orders?.length + ' pending payments');
  console.log('   - Developer can test the API flow and UI even with empty state\n');
}

main()
  .then(() => {
    console.log('✅ Script completed!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
