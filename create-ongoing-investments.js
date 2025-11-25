const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const USER_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';
const USER_ID = '691d6035962542bf4120f30b';
const REFERRAL_CODE = '49E59B3B';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('\n' + '💼'.repeat(35));
  console.log('   CREATING ONGOING INVESTMENT ORDERS');
  console.log('💼'.repeat(35));
  console.log(`\nUser ID: ${USER_ID}`);
  console.log(`Referral Code: ${REFERRAL_CODE}\n`);

  // Get available products
  console.log('📦 Fetching available products...');
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
  } catch (error) {
    console.log('❌ Error fetching products:', error.response?.data?.message);
    process.exit(1);
  }

  if (products.length < 3) {
    console.log('⚠️ Not enough products available');
    process.exit(1);
  }

  // Sort by price to get variety
  products.sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

  const ordersData = [];

  // ==========================================
  // ORDER 1: Small Investment (30% paid)
  // ==========================================
  console.log('📋 CREATING ORDER 1: Small Investment...\n');

  const product1 = products[0];
  const price1 = product1.pricing.finalPrice;
  const dailyAmount1 = Math.max(50, Math.ceil(price1 / 15));
  const totalDays1 = Math.ceil(price1 / dailyAmount1);
  const emisToPay1 = Math.ceil(totalDays1 * 0.3); // Pay 30%

  console.log(`Product: ${product1.name}`);
  console.log(`Price: ₹${price1}`);
  console.log(`Plan: ₹${dailyAmount1}/day for ${totalDays1} days`);
  console.log(`EMIs to pay: ${emisToPay1}/${totalDays1} (30%)\n`);

  try {
    const order1Res = await api.post('/api/orders', {
      productId: product1._id,
      paymentOption: 'daily',
      paymentDetails: {
        dailyAmount: dailyAmount1,
        totalDays: totalDays1
      },
      deliveryAddress: {
        addressLine1: '111 Investment Street, Tower B',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400002',
        phone: '9876543220'
      }
    });

    const order1Id = order1Res.data.order._id;
    const tx1Id = order1Res.data.payment?.transaction_id;

    console.log(`✅ Order 1 created: ${order1Id}`);

    // Pay first EMI
    await api.post(`/api/orders/${order1Id}/verify-payment`, {
      razorpay_payment_id: 'pay_inv1_1_' + Date.now(),
      razorpay_signature: 'sig_inv1_1_' + Date.now(),
      transaction_id: tx1Id
    });
    console.log(`   💳 EMI 1/${totalDays1} paid`);
    await sleep(500);

    // Pay remaining EMIs
    for (let i = 2; i <= emisToPay1; i++) {
      const payRes = await api.post(`/api/orders/${order1Id}/create-payment`, {
        paymentAmount: dailyAmount1
      });

      await api.post(`/api/orders/${order1Id}/verify-payment`, {
        razorpay_payment_id: `pay_inv1_${i}_` + Date.now(),
        razorpay_signature: `sig_inv1_${i}_` + Date.now(),
        transaction_id: payRes.data.transaction_id
      });

      console.log(`   💳 EMI ${i}/${totalDays1} paid`);
      await sleep(500);
    }

    const totalPaid1 = dailyAmount1 * emisToPay1;
    const remaining1 = price1 - totalPaid1;

    ordersData.push({
      orderNumber: 1,
      orderId: order1Id,
      product: product1.name,
      totalAmount: price1,
      dailyAmount: dailyAmount1,
      totalDays: totalDays1,
      emisPaid: emisToPay1,
      totalPaid: totalPaid1,
      remaining: remaining1,
      progress: Math.round((totalPaid1 / price1) * 100)
    });

    console.log(`✅ Order 1 Status: ${emisToPay1}/${totalDays1} EMIs paid (${Math.round((totalPaid1 / price1) * 100)}%)\n`);

  } catch (error) {
    console.log('❌ Order 1 Error:', error.response?.data?.message || error.message);
  }

  await sleep(1000);

  // ==========================================
  // ORDER 2: Medium Investment (50% paid)
  // ==========================================
  if (products.length > 1) {
    console.log('📋 CREATING ORDER 2: Medium Investment...\n');

    const product2 = products[1];
    const price2 = product2.pricing.finalPrice;
    const dailyAmount2 = Math.max(50, Math.ceil(price2 / 20));
    const totalDays2 = Math.ceil(price2 / dailyAmount2);
    const emisToPay2 = Math.ceil(totalDays2 * 0.5); // Pay 50%

    console.log(`Product: ${product2.name}`);
    console.log(`Price: ₹${price2}`);
    console.log(`Plan: ₹${dailyAmount2}/day for ${totalDays2} days`);
    console.log(`EMIs to pay: ${emisToPay2}/${totalDays2} (50%)\n`);

    try {
      const order2Res = await api.post('/api/orders', {
        productId: product2._id,
        paymentOption: 'daily',
        paymentDetails: {
          dailyAmount: dailyAmount2,
          totalDays: totalDays2
        },
        deliveryAddress: {
          addressLine1: '222 Investment Avenue, Suite 5',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001',
          phone: '9876543221'
        }
      });

      const order2Id = order2Res.data.order._id;
      const tx2Id = order2Res.data.payment?.transaction_id;

      console.log(`✅ Order 2 created: ${order2Id}`);

      // Pay first EMI
      await api.post(`/api/orders/${order2Id}/verify-payment`, {
        razorpay_payment_id: 'pay_inv2_1_' + Date.now(),
        razorpay_signature: 'sig_inv2_1_' + Date.now(),
        transaction_id: tx2Id
      });
      console.log(`   💳 EMI 1/${totalDays2} paid`);
      await sleep(500);

      // Pay remaining EMIs
      for (let i = 2; i <= emisToPay2; i++) {
        const payRes = await api.post(`/api/orders/${order2Id}/create-payment`, {
          paymentAmount: dailyAmount2
        });

        await api.post(`/api/orders/${order2Id}/verify-payment`, {
          razorpay_payment_id: `pay_inv2_${i}_` + Date.now(),
          razorpay_signature: `sig_inv2_${i}_` + Date.now(),
          transaction_id: payRes.data.transaction_id
        });

        console.log(`   💳 EMI ${i}/${totalDays2} paid`);
        await sleep(500);
      }

      const totalPaid2 = dailyAmount2 * emisToPay2;
      const remaining2 = price2 - totalPaid2;

      ordersData.push({
        orderNumber: 2,
        orderId: order2Id,
        product: product2.name,
        totalAmount: price2,
        dailyAmount: dailyAmount2,
        totalDays: totalDays2,
        emisPaid: emisToPay2,
        totalPaid: totalPaid2,
        remaining: remaining2,
        progress: Math.round((totalPaid2 / price2) * 100)
      });

      console.log(`✅ Order 2 Status: ${emisToPay2}/${totalDays2} EMIs paid (${Math.round((totalPaid2 / price2) * 100)}%)\n`);

    } catch (error) {
      console.log('❌ Order 2 Error:', error.response?.data?.message || error.message);
    }
  }

  await sleep(1000);

  // ==========================================
  // ORDER 3: Large Investment (20% paid)
  // ==========================================
  if (products.length > 2) {
    console.log('📋 CREATING ORDER 3: Large Investment...\n');

    const product3 = products[2];
    const price3 = product3.pricing.finalPrice;
    const dailyAmount3 = Math.max(50, Math.ceil(price3 / 30));
    const totalDays3 = Math.ceil(price3 / dailyAmount3);
    const emisToPay3 = Math.ceil(totalDays3 * 0.2); // Pay 20%

    console.log(`Product: ${product3.name}`);
    console.log(`Price: ₹${price3}`);
    console.log(`Plan: ₹${dailyAmount3}/day for ${totalDays3} days`);
    console.log(`EMIs to pay: ${emisToPay3}/${totalDays3} (20%)\n`);

    try {
      const order3Res = await api.post('/api/orders', {
        productId: product3._id,
        paymentOption: 'daily',
        paymentDetails: {
          dailyAmount: dailyAmount3,
          totalDays: totalDays3
        },
        deliveryAddress: {
          addressLine1: '333 Investment Plaza, Floor 10',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560002',
          phone: '9876543222'
        }
      });

      const order3Id = order3Res.data.order._id;
      const tx3Id = order3Res.data.payment?.transaction_id;

      console.log(`✅ Order 3 created: ${order3Id}`);

      // Pay first EMI
      await api.post(`/api/orders/${order3Id}/verify-payment`, {
        razorpay_payment_id: 'pay_inv3_1_' + Date.now(),
        razorpay_signature: 'sig_inv3_1_' + Date.now(),
        transaction_id: tx3Id
      });
      console.log(`   💳 EMI 1/${totalDays3} paid`);
      await sleep(500);

      // Pay remaining EMIs
      for (let i = 2; i <= emisToPay3; i++) {
        const payRes = await api.post(`/api/orders/${order3Id}/create-payment`, {
          paymentAmount: dailyAmount3
        });

        await api.post(`/api/orders/${order3Id}/verify-payment`, {
          razorpay_payment_id: `pay_inv3_${i}_` + Date.now(),
          razorpay_signature: `sig_inv3_${i}_` + Date.now(),
          transaction_id: payRes.data.transaction_id
        });

        console.log(`   💳 EMI ${i}/${totalDays3} paid`);
        await sleep(500);
      }

      const totalPaid3 = dailyAmount3 * emisToPay3;
      const remaining3 = price3 - totalPaid3;

      ordersData.push({
        orderNumber: 3,
        orderId: order3Id,
        product: product3.name,
        totalAmount: price3,
        dailyAmount: dailyAmount3,
        totalDays: totalDays3,
        emisPaid: emisToPay3,
        totalPaid: totalPaid3,
        remaining: remaining3,
        progress: Math.round((totalPaid3 / price3) * 100)
      });

      console.log(`✅ Order 3 Status: ${emisToPay3}/${totalDays3} EMIs paid (${Math.round((totalPaid3 / price3) * 100)}%)\n`);

    } catch (error) {
      console.log('❌ Order 3 Error:', error.response?.data?.message || error.message);
    }
  }

  // ==========================================
  // GET FINAL STATUS
  // ==========================================
  console.log('\n📊 Fetching final status...\n');

  try {
    const ordersRes = await api.get('/api/orders/user/history');
    const txRes = await api.get('/api/wallet/transactions');

    console.log('='.repeat(70));
    console.log('📊 ONGOING INVESTMENTS SUMMARY');
    console.log('='.repeat(70));

    console.log('\n📋 All Orders:');
    ordersRes.data.orders?.forEach((order, idx) => {
      const progress = order.totalPaid && order.orderAmount
        ? Math.round((order.totalPaid / order.orderAmount) * 100)
        : 0;

      console.log(`${idx + 1}. ${order.product?.name}`);
      console.log(`   Amount: ₹${order.orderAmount} | Paid: ₹${order.totalPaid || 0} | Progress: ${progress}%`);
      console.log(`   Status: ${order.orderStatus} | Payment: ${order.paymentStatus}`);
    });

    console.log('\n💰 Financial Summary:');
    console.log(`Total Transactions: ${txRes.data.summary?.total || 0}`);
    console.log(`Total Spent: ₹${txRes.data.summary?.totalSpent || 0}`);
    console.log(`Total EMI Payments: ${txRes.data.summary?.emiPayments || 0}`);

    console.log('\n📈 Investment Progress:');
    ordersData.forEach(order => {
      console.log(`\nOrder ${order.orderNumber}: ${order.product}`);
      console.log(`  Total: ₹${order.totalAmount}`);
      console.log(`  Paid: ₹${order.totalPaid} (${order.progress}%)`);
      console.log(`  Remaining: ₹${order.remaining}`);
      console.log(`  EMIs: ${order.emisPaid}/${order.totalDays}`);
      console.log(`  Daily: ₹${order.dailyAmount}`);
    });

    // Calculate totals
    const totalInvestment = ordersData.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = ordersData.reduce((sum, o) => sum + o.totalPaid, 0);
    const totalRemaining = ordersData.reduce((sum, o) => sum + o.remaining, 0);
    const overallProgress = totalInvestment > 0 ? Math.round((totalPaid / totalInvestment) * 100) : 0;

    console.log('\n💼 Overall Investment Summary:');
    console.log(`Total Investment: ₹${totalInvestment}`);
    console.log(`Total Paid: ₹${totalPaid}`);
    console.log(`Total Remaining: ₹${totalRemaining}`);
    console.log(`Overall Progress: ${overallProgress}%`);

    console.log('\n💸 Referral Commission:');
    const totalCommission = totalPaid * 0.2;
    console.log(`Commission Rate: 20%`);
    console.log(`Total Commission Earned: ₹${totalCommission}`);
    console.log(`Referrer (Code ${REFERRAL_CODE}) earned: ₹${totalCommission}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ All ongoing investments created successfully!');
    console.log('='.repeat(70));

  } catch (error) {
    console.log('⚠️ Could not fetch final status');
  }

  console.log('\n');
}

main().then(() => {
  console.log('✅ Script completed!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
