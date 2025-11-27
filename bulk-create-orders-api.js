/**
 * Bulk create test orders via API
 * Creates diverse orders with RAZORPAY payment method to avoid wallet balance issues
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

// Delivery addresses - different for each order
const ADDRESSES = [
  {
    name: 'Rajesh Kumar',
    phoneNumber: '9876543210',
    addressLine1: '123 MG Road, Andheri',
    addressLine2: 'Near Phoenix Mall',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  },
  {
    name: 'Priya Sharma',
    phoneNumber: '8765432109',
    addressLine1: '456 Brigade Road',
    addressLine2: 'Opposite Garuda Mall',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001'
  },
  {
    name: 'Amit Singh',
    phoneNumber: '7654321098',
    addressLine1: '789 Connaught Place',
    addressLine2: 'Near India Gate',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001'
  },
  {
    name: 'Sneha Reddy',
    phoneNumber: '6543210987',
    addressLine1: '321 Park Street',
    addressLine2: 'Near Victoria Memorial',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700016'
  },
  {
    name: 'Vikram Patel',
    phoneNumber: '5432109876',
    addressLine1: '555 Anna Salai',
    addressLine2: 'Near Spencer Plaza',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600002'
  },
  {
    name: 'Anita Desai',
    phoneNumber: '4321098765',
    addressLine1: '888 FC Road',
    addressLine2: 'Near Deccan Gymkhana',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411004'
  },
  {
    name: 'Rohit Joshi',
    phoneNumber: '3210987654',
    addressLine1: '777 CG Road',
    addressLine2: 'Near IIM Ahmedabad',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380009'
  },
  {
    name: 'Kavita Nair',
    phoneNumber: '2109876543',
    addressLine1: '999 Marine Drive',
    addressLine2: 'Near Ernakulam Junction',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682011'
  }
];

async function createOrder(productId, config, addressIndex) {
  const address = ADDRESSES[addressIndex % ADDRESSES.length];

  const orderData = {
    productId: productId,
    quantity: config.quantity || 1,
    totalDays: config.totalDays,
    dailyAmount: config.dailyAmount,
    paymentMethod: 'RAZORPAY',
    deliveryAddress: address
  };

  try {
    const response = await api.post('/api/installments/orders', orderData);
    return {
      success: true,
      order: response.data.data.order,
      config: config
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      config: config
    };
  }
}

async function main() {
  console.log('\n' + '🚀'.repeat(35));
  console.log('   BULK ORDER CREATION VIA API');
  console.log('🚀'.repeat(35) + '\n');

  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👤 User ID: 691d6035962542bf4120f30b\n`);

  // Get available products
  console.log('📋 Step 1: Fetching available products...\n');

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
      console.log('Available products:');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} - ₹${p.pricing.finalPrice}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error fetching products:', error.response?.data?.message || error.message);
    process.exit(1);
  }

  if (products.length < 2) {
    console.error('❌ Not enough products available');
    process.exit(1);
  }

  // Sort by price
  products.sort((a, b) => a.pricing.finalPrice - b.pricing.finalPrice);

  // Define order configurations - diverse plans
  const orderConfigs = [
    // Quick plans (5-10 days)
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 5,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 5)),
      description: '5-day quick plan (minimum duration)'
    },
    {
      productIndex: 0,
      quantity: 2,
      totalDays: 8,
      dailyAmount: Math.max(50, Math.ceil((products[0].pricing.finalPrice * 2) / 8)),
      description: '8-day plan with 2 units'
    },
    {
      productIndex: 1 % products.length,
      quantity: 1,
      totalDays: 10,
      dailyAmount: Math.max(50, Math.ceil(products[1 % products.length].pricing.finalPrice / 10)),
      description: '10-day standard quick plan'
    },

    // Medium plans (15-25 days)
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 15,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 15)),
      description: '15-day medium plan'
    },
    {
      productIndex: 1 % products.length,
      quantity: 3,
      totalDays: 18,
      dailyAmount: Math.max(50, Math.ceil((products[1 % products.length].pricing.finalPrice * 3) / 18)),
      description: '18-day plan with 3 units'
    },
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 20,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 20)),
      description: '20-day standard plan'
    },
    {
      productIndex: 1 % products.length,
      quantity: 2,
      totalDays: 25,
      dailyAmount: Math.max(50, Math.ceil((products[1 % products.length].pricing.finalPrice * 2) / 25)),
      description: '25-day plan with 2 units'
    },

    // Long plans (30-60 days)
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 30,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 30)),
      description: '30-day flexible plan'
    },
    {
      productIndex: 1 % products.length,
      quantity: 1,
      totalDays: 40,
      dailyAmount: Math.max(50, Math.ceil(products[1 % products.length].pricing.finalPrice / 40)),
      description: '40-day extended plan'
    },
    {
      productIndex: 0,
      quantity: 4,
      totalDays: 35,
      dailyAmount: Math.max(50, Math.ceil((products[0].pricing.finalPrice * 4) / 35)),
      description: '35-day plan with 4 units (bulk)'
    },
    {
      productIndex: 1 % products.length,
      quantity: 1,
      totalDays: 50,
      dailyAmount: Math.max(50, Math.ceil(products[1 % products.length].pricing.finalPrice / 50)),
      description: '50-day long-term plan'
    },
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 60,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 60)),
      description: '60-day maximum flexibility plan'
    },

    // Extra diverse plans
    {
      productIndex: 2 % products.length,
      quantity: 5,
      totalDays: 20,
      dailyAmount: Math.max(50, Math.ceil((products[2 % products.length].pricing.finalPrice * 5) / 20)),
      description: '20-day plan with 5 units (bulk order)'
    },
    {
      productIndex: 1 % products.length,
      quantity: 2,
      totalDays: 12,
      dailyAmount: Math.max(50, Math.ceil((products[1 % products.length].pricing.finalPrice * 2) / 12)),
      description: '12-day plan with 2 units'
    },
    {
      productIndex: 0,
      quantity: 1,
      totalDays: 45,
      dailyAmount: Math.max(50, Math.ceil(products[0].pricing.finalPrice / 45)),
      description: '45-day extended flexible plan'
    }
  ];

  console.log('─'.repeat(70));
  console.log(`\n📦 Step 2: Creating ${orderConfigs.length} orders...\n`);

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < orderConfigs.length; i++) {
    const config = orderConfigs[i];
    const productIndex = config.productIndex;
    const product = products[productIndex];

    console.log(`[${i + 1}/${orderConfigs.length}] Creating: ${config.description}`);
    console.log(`   Product: ${product.name} (₹${product.pricing.finalPrice})`);
    console.log(`   Quantity: ${config.quantity}`);
    console.log(`   Plan: ${config.totalDays} days @ ₹${config.dailyAmount}/day`);

    const result = await createOrder(product._id, config, i);

    if (result.success) {
      console.log(`   ✅ Success! Order ID: ${result.order.orderId}`);
      console.log(`      MongoDB ID: ${result.order._id}`);
      console.log(`      Status: ${result.order.status}`);
      console.log(`      Total: ₹${result.order.totalProductPrice}`);
      results.success.push(result);
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      results.failed.push(result);
    }

    console.log('');

    // Delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('─'.repeat(70));
  console.log('\n📊 Summary:\n');
  console.log(`   Total Attempted: ${orderConfigs.length}`);
  console.log(`   ✅ Successful: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}\n`);

  if (results.success.length > 0) {
    const totalValue = results.success.reduce((sum, r) => sum + r.order.totalProductPrice, 0);
    const avgDuration = Math.round(results.success.reduce((sum, r) => sum + r.order.totalDays, 0) / results.success.length);

    console.log(`   Total Order Value: ₹${totalValue.toLocaleString('en-IN')}`);
    console.log(`   Average Duration: ${avgDuration} days`);
    console.log('');

    console.log('   Created Order IDs:');
    results.success.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.order.orderId} - ${r.order.totalDays} days - ₹${r.order.totalProductPrice}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n   Failed Orders:');
    results.failed.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.config.description}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ BULK ORDER CREATION COMPLETE!\n');
  console.log('📱 All orders are in PENDING status (awaiting first Razorpay payment)');
  console.log('📱 Developer can now test all API endpoints with real data:\n');
  console.log('   GET /api/installments/orders - View all orders');
  console.log('   GET /api/installments/orders/:orderId - View specific order');
  console.log('   GET /api/installments/orders/:orderId/summary - Order summary');
  console.log('   GET /api/installments/orders/:orderId/schedule - Payment schedule');
  console.log('   GET /api/installments/orders/stats - Statistics');
  console.log('   GET /api/installments/payments/daily-pending - Pending payments');
  console.log('   POST /api/installments/payments/process - Make payments\n');
}

main()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
