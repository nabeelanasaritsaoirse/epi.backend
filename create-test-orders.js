const axios = require('axios');

const BASE_URL = 'http://65.0.64.8:5000';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

// Product IDs from the live system
const PRODUCTS = [
  {
    id: '69241051f747a104fdda4090',
    name: 'Premium Wireless Headphones',
    price: 4000
  },
  {
    id: '69240fddf747a104fdda4084',
    name: 'Premium Wireless Headphones (Variant)',
    price: 4000
  },
  {
    id: '6924976871cd259008fda24a',
    name: 'Bottles',
    price: 400
  },
  {
    id: '69255d93ef4a92e52593cae1',
    name: 'Glasses',
    price: 400
  },
  {
    id: '6926b092ecead7b46043a34b',
    name: 'Tablet',
    price: 18000
  }
];

// Sample delivery addresses
const DELIVERY_ADDRESSES = [
  {
    name: 'John Doe',
    phoneNumber: '9876543210',
    addressLine1: '123 MG Road',
    addressLine2: 'Near City Mall',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  },
  {
    name: 'Jane Smith',
    phoneNumber: '9876543211',
    addressLine1: '456 Brigade Road',
    addressLine2: 'Opposite Metro Station',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001'
  },
  {
    name: 'Raj Kumar',
    phoneNumber: '9876543212',
    addressLine1: '789 Park Street',
    addressLine2: 'Near Park',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001'
  }
];

// Test order configurations
const TEST_ORDERS = [
  {
    productIndex: 0,
    quantity: 1,
    totalDays: 10,
    dailyAmount: 400,
    paymentMethod: 'WALLET',
    description: 'Quick plan - 10 days'
  },
  {
    productIndex: 0,
    quantity: 2,
    totalDays: 20,
    dailyAmount: 400,
    paymentMethod: 'WALLET',
    description: 'Standard plan - 20 days, 2 units'
  },
  {
    productIndex: 1,
    quantity: 1,
    totalDays: 40,
    dailyAmount: 100,
    paymentMethod: 'WALLET',
    description: 'Flexible plan - 40 days'
  },
  {
    productIndex: 2,
    quantity: 3,
    totalDays: 8,
    dailyAmount: 150,
    paymentMethod: 'WALLET',
    description: 'Bottles - 8 days, 3 units'
  },
  {
    productIndex: 2,
    quantity: 1,
    totalDays: 5,
    dailyAmount: 80,
    paymentMethod: 'WALLET',
    description: 'Bottles - 5 days (minimum)'
  },
  {
    productIndex: 3,
    quantity: 2,
    totalDays: 10,
    dailyAmount: 80,
    paymentMethod: 'WALLET',
    description: 'Glasses - 10 days, 2 units'
  },
  {
    productIndex: 3,
    quantity: 1,
    totalDays: 8,
    dailyAmount: 50,
    paymentMethod: 'WALLET',
    description: 'Glasses - 8 days'
  },
  {
    productIndex: 0,
    quantity: 1,
    totalDays: 80,
    dailyAmount: 50,
    paymentMethod: 'WALLET',
    description: 'Extended plan - 80 days'
  },
  {
    productIndex: 1,
    quantity: 1,
    totalDays: 20,
    dailyAmount: 200,
    paymentMethod: 'WALLET',
    description: 'Standard plan - 20 days'
  },
  {
    productIndex: 2,
    quantity: 5,
    totalDays: 20,
    dailyAmount: 100,
    paymentMethod: 'WALLET',
    description: 'Bottles - 20 days, 5 units'
  },
  {
    productIndex: 0,
    quantity: 1,
    totalDays: 15,
    dailyAmount: 267,
    paymentMethod: 'WALLET',
    description: 'Custom plan - 15 days'
  },
  {
    productIndex: 3,
    quantity: 4,
    totalDays: 16,
    dailyAmount: 100,
    paymentMethod: 'WALLET',
    description: 'Glasses - 16 days, 4 units'
  },
  {
    productIndex: 0,
    quantity: 3,
    totalDays: 30,
    dailyAmount: 400,
    paymentMethod: 'WALLET',
    description: 'Headphones - 30 days, 3 units'
  },
  {
    productIndex: 1,
    quantity: 2,
    totalDays: 25,
    dailyAmount: 320,
    paymentMethod: 'WALLET',
    description: 'Headphones - 25 days, 2 units'
  },
  {
    productIndex: 2,
    quantity: 2,
    totalDays: 10,
    dailyAmount: 80,
    paymentMethod: 'WALLET',
    description: 'Bottles - 10 days, 2 units'
  }
];

async function createOrder(orderConfig, addressIndex) {
  const product = PRODUCTS[orderConfig.productIndex];
  const address = DELIVERY_ADDRESSES[addressIndex % DELIVERY_ADDRESSES.length];

  const orderData = {
    productId: product.id,
    quantity: orderConfig.quantity,
    totalDays: orderConfig.totalDays,
    dailyAmount: orderConfig.dailyAmount,
    paymentMethod: orderConfig.paymentMethod,
    deliveryAddress: address
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/api/installments/orders`,
      orderData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );

    console.log(`✅ Order Created: ${orderConfig.description}`);
    console.log(`   Order ID: ${response.data.data.order.orderId}`);
    console.log(`   Status: ${response.data.data.order.status}`);
    console.log(`   Total: ₹${response.data.data.order.totalProductPrice}`);
    console.log(`   Paid Installments: ${response.data.data.order.paidInstallments}/${response.data.data.order.totalDays}`);
    console.log('');

    return response.data.data.order;
  } catch (error) {
    console.error(`❌ Failed to create order: ${orderConfig.description}`);
    if (error.response) {
      console.error(`   Error: ${error.response.data.message || error.response.statusText}`);
      console.error(`   Status: ${error.response.status}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    console.log('');
    return null;
  }
}

async function makePayment(orderId, orderIndex) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/installments/payments/process`,
      {
        orderId: orderId,
        paymentMethod: 'WALLET'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );

    console.log(`   💰 Payment processed for ${orderId}`);
    console.log(`      Installment: ${response.data.data.payment.installmentNumber}`);
    console.log(`      Remaining: ₹${response.data.data.order.remainingAmount}`);

    return true;
  } catch (error) {
    if (error.response?.data?.message?.includes('already made a payment')) {
      console.log(`   ⏭️  Already paid today for ${orderId}, skipping...`);
      return false;
    }
    console.error(`   ❌ Payment failed for ${orderId}: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Test Order Creation...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Creating ${TEST_ORDERS.length} orders...\n`);
  console.log('='.repeat(60));
  console.log('');

  const createdOrders = [];

  // Create all orders
  for (let i = 0; i < TEST_ORDERS.length; i++) {
    const order = await createOrder(TEST_ORDERS[i], i);
    if (order) {
      createdOrders.push({
        orderId: order.orderId,
        totalDays: order.totalDays,
        paymentsToMake: 0 // Will be set based on progress
      });
    }
    // Wait a bit between orders
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('='.repeat(60));
  console.log(`\n✅ Created ${createdOrders.length} orders successfully!\n`);

  // Now make some additional payments to create variety
  // Some orders will have progress (ongoing), some will remain with just first payment
  console.log('💰 Making additional payments to simulate progress...\n');
  console.log('='.repeat(60));
  console.log('');

  // Payment patterns to create different order states:
  // - Orders 0-2: Make 50% payments (ongoing, good progress)
  // - Orders 3-5: Make 80% payments (almost complete)
  // - Orders 6-8: Make 100% payments (completed)
  // - Orders 9-14: Keep at 1 payment only (just started)

  for (let i = 0; i < Math.min(9, createdOrders.length); i++) {
    const order = createdOrders[i];
    let paymentsToMake = 0;

    if (i < 3) {
      // 50% progress
      paymentsToMake = Math.floor(order.totalDays * 0.5) - 1; // -1 because first is already paid
    } else if (i < 6) {
      // 80% progress
      paymentsToMake = Math.floor(order.totalDays * 0.8) - 1;
    } else if (i < 9) {
      // 100% complete
      paymentsToMake = order.totalDays - 1;
    }

    if (paymentsToMake > 0) {
      console.log(`📊 Processing ${paymentsToMake} payments for ${order.orderId}...`);

      for (let j = 0; j < paymentsToMake; j++) {
        const success = await makePayment(order.orderId, i);
        if (!success && j > 0) {
          // If payment fails (e.g., one per day limit), stop trying for this order
          console.log(`   ⚠️  Stopping payments for this order (limit reached)`);
          break;
        }
        // Small delay between payments
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('\n🎉 Test Data Generation Complete!\n');
  console.log('📊 Summary:');
  console.log(`   Total Orders Created: ${createdOrders.length}`);
  console.log(`   Completed Orders: ~${Math.min(3, createdOrders.length)} (estimated)`);
  console.log(`   Ongoing Orders: ~${Math.max(0, Math.min(6, createdOrders.length) - 3)} (estimated)`);
  console.log(`   Just Started: ~${Math.max(0, createdOrders.length - 9)} (estimated)`);
  console.log('\n✅ Developer can now test the API endpoints with real data!\n');
}

main().catch(console.error);
