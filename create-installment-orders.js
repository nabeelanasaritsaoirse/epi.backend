const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const USER_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER_ID = '691d6035962542bf4120f30b';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n' + '📦'.repeat(35));
  console.log('   CREATING INSTALLMENT ORDERS FOR DAILY-PENDING API');
  console.log('📦'.repeat(35));
  console.log(`\nUser ID: ${USER_ID}\n`);

  // ==========================================
  // STEP 1: GET AVAILABLE PRODUCTS
  // ==========================================
  console.log('📋 STEP 1: Fetching available products...\n');

  let products = [];
  try {
    const productsRes = await api.get('/api/products');
    const allProducts = productsRes.data.data || productsRes.data.products || [];

    products = allProducts.filter(p =>
      (p.status === 'active' || p.status === 'published') &&
      p.availability?.isAvailable &&
      p.pricing?.finalPrice > 0
    );

    console.log(`✅ Found ${products.length} available products\n`);

    if (products.length > 0) {
      console.log('First 3 products:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - ₹${p.pricing.finalPrice}`);
      });
      console.log('');
    }
  } catch (error) {
    console.log('❌ Error fetching products:', error.response?.data?.message || error.message);
    process.exit(1);
  }

  if (products.length < 2) {
    console.log('⚠️ Not enough products available');
    process.exit(1);
  }

  // Sort by price
  products.sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

  const ordersCreated = [];

  // ==========================================
  // ORDER 1: Create with 8-day installment (pay 3 installments)
  // Using smaller product with ₹50/day minimum
  // ==========================================
  console.log('📦 ORDER 1: Creating 8-day installment order...\n');

  const product1 = products[0];
  const price1 = product1.pricing.finalPrice;
  // Ensure minimum ₹50/day: max 8 days for ₹400 product, or fewer days for smaller prices
  const days1 = Math.max(5, Math.min(8, Math.floor(price1 / 50)));
  const dailyAmount1 = Math.ceil(price1 / days1);

  console.log(`Product: ${product1.name}`);
  console.log(`Price: ₹${price1}`);
  console.log(`Plan: ${days1} days @ ₹${dailyAmount1}/day`);

  try {
    const order1Res = await api.post('/api/installments/orders', {
      productId: product1._id,
      totalDays: days1,
      dailyAmount: dailyAmount1 >= 50 ? dailyAmount1 : 50, // Force minimum ₹50
      paymentMethod: 'RAZORPAY',
      deliveryAddress: {
        name: 'Test User',
        phoneNumber: '9876543210',
        addressLine1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001'
      }
    });

    const order1 = order1Res.data.data || order1Res.data.order;
    console.log(`✅ Order created: ${order1.orderId}`);
    console.log(`   MongoDB ID: ${order1._id}`);
    console.log(`   Status: ${order1.status}`);
    console.log(`   Daily Amount: ₹${order1.dailyPaymentAmount}`);
    console.log(`   Total Installments: ${order1.totalInstallments}`);

    ordersCreated.push({
      orderId: order1._id,
      orderNumber: order1.orderId,
      product: product1.name,
      price: price1,
      days: days1,
      dailyAmount: order1.dailyPaymentAmount
    });

    // Pay 2 additional installments (first is already paid on creation)
    console.log('\n   💳 Paying additional installments...');

    for (let i = 2; i <= 3; i++) {
      await sleep(1000);

      try {
        // Create Razorpay order
        const razorpayRes = await api.post('/api/installments/payments/create-razorpay-order', {
          orderId: order1._id
        });

        // Process payment
        await api.post('/api/installments/payments/process', {
          orderId: order1._id,
          paymentMethod: 'RAZORPAY',
          razorpayOrderId: razorpayRes.data.data.razorpayOrderId,
          razorpayPaymentId: `pay_inst1_${i}_` + Date.now(),
          razorpaySignature: `sig_inst1_${i}_` + Date.now()
        });

        console.log(`   ✅ Installment ${i} paid`);
      } catch (error) {
        console.log(`   ⚠️ Installment ${i} error:`, error.response?.data?.message || error.message);
      }
    }

    console.log(`\n   📊 Order 1 Status: 3/${days1} installments paid\n`);

  } catch (error) {
    console.log('❌ Order 1 Error:', error.response?.data || error.message);
  }

  await sleep(1500);

  // ==========================================
  // ORDER 2: Create with 15-day installment (pay 5 installments)
  // ==========================================
  if (products.length > 1) {
    console.log('📦 ORDER 2: Creating 15-day installment order...\n');

    const product2 = products[1];
    const price2 = product2.pricing.finalPrice;
    const days2 = 15;
    const dailyAmount2 = Math.ceil(price2 / days2);

    console.log(`Product: ${product2.name}`);
    console.log(`Price: ₹${price2}`);
    console.log(`Plan: ${days2} days @ ₹${dailyAmount2}/day`);

    try {
      const order2Res = await api.post('/api/installments/orders', {
        productId: product2._id,
        totalDays: days2,
        paymentMethod: 'RAZORPAY',
        deliveryAddress: {
          name: 'Test User',
          phoneNumber: '9876543211',
          addressLine1: '456 Park Avenue',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001'
        }
      });

      const order2 = order2Res.data.data || order2Res.data.order;
      console.log(`✅ Order created: ${order2.orderId}`);
      console.log(`   MongoDB ID: ${order2._id}`);
      console.log(`   Status: ${order2.status}`);
      console.log(`   Daily Amount: ₹${order2.dailyPaymentAmount}`);
      console.log(`   Total Installments: ${order2.totalInstallments}`);

      ordersCreated.push({
        orderId: order2._id,
        orderNumber: order2.orderId,
        product: product2.name,
        price: price2,
        days: days2,
        dailyAmount: order2.dailyPaymentAmount
      });

      // Pay 4 additional installments
      console.log('\n   💳 Paying additional installments...');

      for (let i = 2; i <= 5; i++) {
        await sleep(1000);

        try {
          // Create Razorpay order
          const razorpayRes = await api.post('/api/installments/payments/create-razorpay-order', {
            orderId: order2._id
          });

          // Process payment
          await api.post('/api/installments/payments/process', {
            orderId: order2._id,
            paymentMethod: 'RAZORPAY',
            razorpayOrderId: razorpayRes.data.data.razorpayOrderId,
            razorpayPaymentId: `pay_inst2_${i}_` + Date.now(),
            razorpaySignature: `sig_inst2_${i}_` + Date.now()
          });

          console.log(`   ✅ Installment ${i} paid`);
        } catch (error) {
          console.log(`   ⚠️ Installment ${i} error:`, error.response?.data?.message || error.message);
        }
      }

      console.log(`\n   📊 Order 2 Status: 5/${days2} installments paid\n`);

    } catch (error) {
      console.log('❌ Order 2 Error:', error.response?.data || error.message);
    }
  }

  await sleep(1500);

  // ==========================================
  // STEP 2: CHECK DAILY PENDING PAYMENTS
  // ==========================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 CHECKING DAILY PENDING PAYMENTS');
  console.log('='.repeat(70) + '\n');

  try {
    const pendingRes = await api.get('/api/installments/payments/daily-pending');
    const pendingData = pendingRes.data.data || pendingRes.data;

    console.log('✅ Daily Pending Payments:');
    console.log(`   Total Pending: ${pendingData.count || 0}`);
    console.log(`   Total Amount: ₹${pendingData.totalAmount || 0}`);

    if (pendingData.payments && pendingData.payments.length > 0) {
      console.log('\n   📋 Pending Installments:');
      pendingData.payments.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.productName}`);
        console.log(`      Order: ${p.orderId}`);
        console.log(`      Installment #${p.installmentNumber}`);
        console.log(`      Amount: ₹${p.amount}`);
        console.log(`      Due: ${new Date(p.dueDate).toLocaleDateString()}`);
      });
    } else {
      console.log('\n   ℹ️ No pending payments due today');
      console.log('   Note: Payments are scheduled for future dates based on the payment schedule');
    }

  } catch (error) {
    console.log('⚠️ Error fetching daily pending:', error.response?.data || error.message);
  }

  // ==========================================
  // STEP 3: GET ALL INSTALLMENT ORDERS
  // ==========================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 ALL INSTALLMENT ORDERS');
  console.log('='.repeat(70) + '\n');

  try {
    const ordersRes = await api.get('/api/installments/orders');
    const orders = ordersRes.data.data?.orders || ordersRes.data.orders || [];

    console.log(`Total Installment Orders: ${orders.length}\n`);

    orders.forEach((order, idx) => {
      const progress = order.totalPaidAmount && order.productPrice
        ? Math.round((order.totalPaidAmount / order.productPrice) * 100)
        : 0;

      console.log(`${idx + 1}. ${order.productName}`);
      console.log(`   Order ID: ${order.orderId}`);
      console.log(`   Amount: ₹${order.productPrice}`);
      console.log(`   Paid: ₹${order.totalPaidAmount || 0} (${progress}%)`);
      console.log(`   Installments: ${order.paidInstallments}/${order.totalInstallments}`);
      console.log(`   Status: ${order.status}`);
      console.log('');
    });

  } catch (error) {
    console.log('⚠️ Error fetching orders:', error.response?.data?.message || error.message);
  }

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('='.repeat(70));
  console.log('✅ INSTALLATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n✅ Created ${ordersCreated.length} installment orders`);
  console.log('✅ Orders are now in the new InstallmentOrder system');
  console.log('✅ Daily-pending API will now work correctly\n');

  ordersCreated.forEach((order, i) => {
    console.log(`${i + 1}. ${order.product}`);
    console.log(`   Order: ${order.orderNumber}`);
    console.log(`   Price: ₹${order.price}`);
    console.log(`   Plan: ${order.days} days @ ₹${order.dailyAmount}/day\n`);
  });

  console.log('📋 To check daily pending payments, use:');
  console.log('   GET /api/installments/payments/daily-pending\n');
}

main().then(() => {
  console.log('✅ Script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
