/**
 * Create diverse test orders with WALLET payment method
 * Then attempt to make payments to create ACTIVE and COMPLETED orders
 *
 * Note: This requires the user to have wallet balance.
 * If wallet balance is insufficient, orders will fail to create.
 */

const axios = require('axios');

const BASE_URL = 'http://65.0.64.8:5000';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Delivery addresses
const ADDRESSES = [
  {
    name: 'Rahul Verma',
    phoneNumber: '9123456780',
    addressLine1: '12 Residency Road',
    addressLine2: 'Near Cubbon Park',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001'
  },
  {
    name: 'Meera Jain',
    phoneNumber: '9123456781',
    addressLine1: '45 Marine Drive',
    addressLine2: 'Opposite Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  },
  {
    name: 'Sanjay Gupta',
    phoneNumber: '9123456782',
    addressLine1: '78 Rajpath',
    addressLine2: 'Near India Gate',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001'
  }
];

async function createOrderWithWallet(productId, config, addressIndex) {
  const address = ADDRESSES[addressIndex % ADDRESSES.length];

  const orderData = {
    productId: productId,
    quantity: config.quantity || 1,
    totalDays: config.totalDays,
    dailyAmount: config.dailyAmount,
    paymentMethod: 'WALLET',  // Using WALLET to auto-complete first payment
    deliveryAddress: address
  };

  try {
    const response = await api.post('/api/installments/orders', orderData);
    return {
      success: true,
      order: response.data.data.order,
      firstPayment: response.data.data.firstPayment,
      config: config
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.response?.data?.message || error.message,
      config: config
    };
  }
}

async function makePayment(orderId) {
  try {
    const response = await api.post('/api/installments/payments/process', {
      orderId: orderId,
      paymentMethod: 'WALLET'
    });

    return {
      success: true,
      payment: response.data.data.payment,
      order: response.data.data.order
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

async function main() {
  console.log('\n' + '🎯'.repeat(35));
  console.log('   CREATE DIVERSE TEST ORDERS WITH WALLET');
  console.log('🎯'.repeat(35) + '\n');

  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`💳 Payment Method: WALLET\n`);

  // Get products
  console.log('📋 Step 1: Fetching products...\n');

  let products = [];
  try {
    const productsRes = await api.get('/api/products');
    const allProducts = productsRes.data.data || productsRes.data.products || [];

    products = allProducts.filter(p =>
      (p.status === 'active' || p.status === 'published') &&
      p.availability?.isAvailable &&
      p.pricing?.finalPrice > 0
    );

    console.log(`✅ Found ${products.length} products\n`);
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    process.exit(1);
  }

  if (products.length === 0) {
    console.error('❌ No products available');
    process.exit(1);
  }

  products.sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

  console.log('─'.repeat(70));
  console.log('\n📦 Step 2: Creating orders with WALLET payment...\n');

  // Order configurations - designed to create diverse statuses
  const orderConfigs = [
    // Will be ACTIVE after first payment
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 10,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 10)),
      paymentsToMake: 0, // Just first payment (auto-completed)
      description: 'ACTIVE - 10 days, 1/10 paid'
    },
    // Will make 50% payments
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 20,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 20)),
      paymentsToMake: 9, // Total 10/20 (50%)
      description: 'ACTIVE - 20 days, 10/20 paid (50%)'
    },
    // Will make 80% payments
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 15,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 15)),
      paymentsToMake: 11, // Total 12/15 (80%)
      description: 'ACTIVE - 15 days, 12/15 paid (80%)'
    },
    // Will complete all payments
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 5,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 5)),
      paymentsToMake: 4, // Total 5/5 (100%)
      description: 'COMPLETED - 5 days, all paid'
    },
    // Will complete all payments
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 8,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 8)),
      paymentsToMake: 7, // Total 8/8 (100%)
      description: 'COMPLETED - 8 days, all paid'
    }
  ];

  const createdOrders = [];
  const failedOrders = [];

  for (let i = 0; i < orderConfigs.length; i++) {
    const config = orderConfigs[i];
    const product = products[config.productIndex];

    console.log(`[${i + 1}/${orderConfigs.length}] Creating: ${config.description}`);
    console.log(`   Product: ${product.name} (₹${product.pricing.finalPrice})`);
    console.log(`   Plan: ${config.totalDays} days @ ₹${config.dailyAmount}/day`);

    const result = await createOrderWithWallet(product._id, config, i);

    if (result.success) {
      console.log(`   ✅ Order Created: ${result.order.orderId}`);
      console.log(`      Status: ${result.order.status}`);
      console.log(`      First Payment: ₹${result.firstPayment?.amount || 0} - ${result.firstPayment?.status || 'N/A'}`);

      createdOrders.push({
        ...result,
        paymentsToMake: config.paymentsToMake
      });
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      failedOrders.push(result);
    }

    console.log('');
    await sleep(1500);
  }

  if (createdOrders.length === 0) {
    console.log('\n❌ No orders created successfully. Check wallet balance.');
    console.log('💡 User may need wallet balance to create orders with WALLET payment method.\n');
    process.exit(1);
  }

  console.log('─'.repeat(70));
  console.log(`\n💳 Step 3: Making additional payments to create diverse order statuses...\n`);

  for (let i = 0; i < createdOrders.length; i++) {
    const orderInfo = createdOrders[i];
    const paymentsNeeded = orderInfo.paymentsToMake;

    if (paymentsNeeded === 0) {
      console.log(`[${i + 1}] ${orderInfo.order.orderId} - Skipping (no additional payments needed)`);
      continue;
    }

    console.log(`[${i + 1}] ${orderInfo.order.orderId} - Making ${paymentsNeeded} additional payments...`);

    let successCount = 0;
    for (let j = 0; j < paymentsNeeded; j++) {
      await sleep(1200); // Wait between payments (one per day rule)

      const paymentResult = await makePayment(orderInfo.order.orderId);

      if (paymentResult.success) {
        successCount++;
        const progress = paymentResult.order.paidInstallments;
        const total = paymentResult.order.totalDays;
        console.log(`   ✅ Payment ${j + 2}/${paymentsNeeded + 1} - Progress: ${progress}/${total}`);
      } else {
        if (paymentResult.error.includes('already made a payment')) {
          console.log(`   ⏸️  Stopped: One payment per day limit reached`);
          break;
        } else {
          console.log(`   ❌ Payment failed: ${paymentResult.error}`);
          break;
        }
      }
    }

    console.log(`   📊 Completed ${successCount}/${paymentsNeeded} additional payments\n`);
  }

  console.log('─'.repeat(70));
  console.log('\n📊 FINAL SUMMARY\n');

  try {
    const ordersRes = await api.get('/api/installments/orders');
    const allOrders = ordersRes.data.data?.orders || [];

    const statusCount = allOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`Total Orders: ${allOrders.length}`);
    console.log(`   PENDING: ${statusCount.PENDING || 0}`);
    console.log(`   ACTIVE: ${statusCount.ACTIVE || 0}`);
    console.log(`   COMPLETED: ${statusCount.COMPLETED || 0}`);
    console.log(`   CANCELLED: ${statusCount.CANCELLED || 0}`);

    console.log('\n📝 Order Details:');
    allOrders.slice(0, 15).forEach((order, idx) => {
      const progress = Math.round((order.paidInstallments / order.totalDays) * 100);
      console.log(`   ${idx + 1}. ${order.orderId} - ${order.status} - ${order.paidInstallments}/${order.totalDays} (${progress}%)`);
    });

  } catch (error) {
    console.log('⚠️ Could not fetch final order summary');
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ TEST DATA CREATION COMPLETE!\n');
  console.log('📱 Developer can now test all API endpoints with diverse order statuses!\n');
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
