/**
 * Script to seed test installment orders directly into the database
 * This creates orders with various statuses (PENDING, ACTIVE, COMPLETED) for testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Load models
const InstallmentOrder = require('./models/InstallmentOrder');
const PaymentRecord = require('./models/PaymentRecord');
const Product = require('./models/Product');
const User = require('./models/User');

const USER_ID = '691d6035962542bf4120f30b';  // The developer's user ID

// Sample delivery addresses
const DELIVERY_ADDRESSES = [
  {
    name: 'Rajesh Kumar',
    phoneNumber: '9876543210',
    addressLine1: '123 MG Road',
    addressLine2: 'Near Phoenix Mall',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'India'
  },
  {
    name: 'Priya Sharma',
    phoneNumber: '9876543211',
    addressLine1: '456 Brigade Road',
    addressLine2: 'Opposite Metro Station',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    country: 'India'
  },
  {
    name: 'Amit Patel',
    phoneNumber: '9876543212',
    addressLine1: '789 Connaught Place',
    addressLine2: 'Near Central Park',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    country: 'India'
  }
];

function generateOrderId() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
}

function generatePaymentId() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2);
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY-${datePart}-${randomPart}`;
}

function generatePaymentSchedule(totalDays, dailyAmount, startDate) {
  const schedule = [];
  const start = new Date(startDate);

  for (let i = 1; i <= totalDays; i++) {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + (i - 1));

    schedule.push({
      installmentNumber: i,
      dueDate: dueDate,
      amount: dailyAmount,
      status: 'PENDING',
      isCouponBenefit: false,
      paidDate: null,
      paymentId: null
    });
  }

  return schedule;
}

async function createOrderWithPayments(productId, config, userDoc) {
  try {
    const {
      totalDays,
      dailyAmount,
      paidInstallments,
      status,
      deliveryStatus,
      addressIndex
    } = config;

    const product = await Product.findById(productId);
    if (!product) {
      console.log(`❌ Product ${productId} not found`);
      return null;
    }

    const totalProductPrice = product.pricing.finalPrice;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - paidInstallments); // Back-date to simulate progress

    // Create order
    const orderData = {
      orderId: generateOrderId(),
      user: USER_ID,
      product: productId,
      quantity: 1,
      pricePerUnit: totalProductPrice,
      totalProductPrice: totalProductPrice,
      productPrice: totalProductPrice,
      productName: product.name,
      productSnapshot: {
        productId: product.productId || 'PROD-' + product._id,
        name: product.name,
        description: product.description || { short: '', long: '', features: [] },
        pricing: product.pricing,
        images: product.images || [],
        brand: product.brand || '',
        category: product.category || {}
      },
      totalDays: totalDays,
      dailyPaymentAmount: dailyAmount,
      paidInstallments: paidInstallments,
      totalPaidAmount: paidInstallments * dailyAmount,
      remainingAmount: totalProductPrice - (paidInstallments * dailyAmount),
      paymentSchedule: generatePaymentSchedule(totalDays, dailyAmount, startDate),
      status: status,
      deliveryStatus: deliveryStatus,
      deliveryAddress: DELIVERY_ADDRESSES[addressIndex % DELIVERY_ADDRESSES.length],
      firstPaymentMethod: 'WALLET',
      firstPaymentCompletedAt: paidInstallments > 0 ? startDate : null,
      lastPaymentDate: paidInstallments > 0 ? new Date() : null,
      referrer: userDoc.referredBy || null,
      productCommissionPercentage: 10,
      commissionPercentage: 10,
      totalCommissionPaid: paidInstallments * dailyAmount * 0.1,
      createdAt: startDate,
      updatedAt: new Date()
    };

    // If completed, set completion date
    if (status === 'COMPLETED') {
      orderData.completedAt = new Date();
      orderData.remainingAmount = 0;
    }

    const order = new InstallmentOrder(orderData);
    await order.save();

    // Create payment records for paid installments
    const payments = [];
    for (let i = 1; i <= paidInstallments; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setDate(paymentDate.getDate() + (i - 1));

      const paymentData = {
        paymentId: generatePaymentId(),
        order: order._id,
        user: USER_ID,
        amount: dailyAmount,
        installmentNumber: i,
        paymentMethod: 'WALLET',
        status: 'COMPLETED',
        completedAt: paymentDate,
        commissionAmount: dailyAmount * 0.1,
        commissionCreditedToReferrer: userDoc.referredBy ? true : false,
        idempotencyKey: `${order._id}-${i}-${Date.now()}`,
        createdAt: paymentDate,
        updatedAt: paymentDate
      };

      const payment = new PaymentRecord(paymentData);
      await payment.save();
      payments.push(payment);

      // Update payment schedule
      if (order.paymentSchedule[i - 1]) {
        order.paymentSchedule[i - 1].status = 'PAID';
        order.paymentSchedule[i - 1].paidDate = paymentDate;
        order.paymentSchedule[i - 1].paymentId = payment._id;
      }
    }

    // Create first pending payment record if order is PENDING
    if (status === 'PENDING' && paidInstallments === 0) {
      const firstPayment = new PaymentRecord({
        paymentId: generatePaymentId(),
        order: order._id,
        user: USER_ID,
        amount: dailyAmount,
        installmentNumber: 1,
        paymentMethod: 'RAZORPAY',
        status: 'PENDING',
        razorpayOrderId: 'order_test_' + Date.now(),
        idempotencyKey: `${order._id}-1-${Date.now()}`,
        createdAt: new Date()
      });
      await firstPayment.save();
      order.firstPaymentId = firstPayment._id;
    } else if (payments.length > 0) {
      order.firstPaymentId = payments[0]._id;
    }

    await order.save();

    return {
      order,
      payments
    };

  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

async function main() {
  console.log('\n' + '🌱'.repeat(35));
  console.log('   SEEDING TEST INSTALLMENT ORDERS');
  console.log('🌱'.repeat(35) + '\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get user
    const user = await User.findById(USER_ID);
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    console.log(`✅ Found user: ${user.name} (${user.email})\n`);

    // Get available products
    const products = await Product.find({
      status: { $in: ['active', 'published'] },
      'availability.isAvailable': true
    }).limit(10);

    console.log(`✅ Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log('❌ No products available');
      process.exit(1);
    }

    console.log('─'.repeat(70));
    console.log('Creating test orders...\n');

    const ordersToCreate = [
      // PENDING Orders (just created, no payments yet)
      {
        productIndex: 0,
        totalDays: 10,
        dailyAmount: Math.ceil(products[0].pricing.finalPrice / 10),
        paidInstallments: 0,
        status: 'PENDING',
        deliveryStatus: 'PENDING',
        addressIndex: 0,
        description: 'PENDING - No payments yet (10 days)'
      },
      {
        productIndex: 1,
        totalDays: 15,
        dailyAmount: Math.ceil(products[1].pricing.finalPrice / 15),
        paidInstallments: 0,
        status: 'PENDING',
        deliveryStatus: 'PENDING',
        addressIndex: 1,
        description: 'PENDING - No payments yet (15 days)'
      },

      // ACTIVE Orders (with some progress)
      {
        productIndex: 0,
        totalDays: 20,
        dailyAmount: Math.ceil(products[0].pricing.finalPrice / 20),
        paidInstallments: 5,  // 25% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 0,
        description: 'ACTIVE - 5/20 payments (25% complete)'
      },
      {
        productIndex: 1,
        totalDays: 15,
        dailyAmount: Math.ceil(products[1].pricing.finalPrice / 15),
        paidInstallments: 7,  // ~50% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 1,
        description: 'ACTIVE - 7/15 payments (47% complete)'
      },
      {
        productIndex: 2 % products.length,
        totalDays: 30,
        dailyAmount: Math.ceil(products[2 % products.length].pricing.finalPrice / 30),
        paidInstallments: 20,  // ~67% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 2,
        description: 'ACTIVE - 20/30 payments (67% complete)'
      },
      {
        productIndex: 0,
        totalDays: 10,
        dailyAmount: Math.ceil(products[0].pricing.finalPrice / 10),
        paidInstallments: 8,  // 80% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 0,
        description: 'ACTIVE - 8/10 payments (80% complete)'
      },

      // COMPLETED Orders (all payments done)
      {
        productIndex: 1,
        totalDays: 10,
        dailyAmount: Math.ceil(products[1].pricing.finalPrice / 10),
        paidInstallments: 10,  // 100% complete
        status: 'COMPLETED',
        deliveryStatus: 'PENDING',
        addressIndex: 1,
        description: 'COMPLETED - All 10 payments done'
      },
      {
        productIndex: 2 % products.length,
        totalDays: 5,
        dailyAmount: Math.ceil(products[2 % products.length].pricing.finalPrice / 5),
        paidInstallments: 5,  // 100% complete
        status: 'COMPLETED',
        deliveryStatus: 'APPROVED',
        addressIndex: 2,
        description: 'COMPLETED - All 5 payments, delivery approved'
      },
      {
        productIndex: 0,
        totalDays: 8,
        dailyAmount: Math.ceil(products[0].pricing.finalPrice / 8),
        paidInstallments: 8,  // 100% complete
        status: 'COMPLETED',
        deliveryStatus: 'DELIVERED',
        addressIndex: 0,
        description: 'COMPLETED - All 8 payments, delivered'
      },

      // More ACTIVE orders with different progress levels
      {
        productIndex: 1,
        totalDays: 40,
        dailyAmount: Math.ceil(products[1].pricing.finalPrice / 40),
        paidInstallments: 10,  // 25% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 1,
        description: 'ACTIVE - 10/40 payments (25% complete - long plan)'
      },
      {
        productIndex: 0,
        totalDays: 25,
        dailyAmount: Math.ceil(products[0].pricing.finalPrice / 25),
        paidInstallments: 15,  // 60% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 2,
        description: 'ACTIVE - 15/25 payments (60% complete)'
      },
      {
        productIndex: 2 % products.length,
        totalDays: 12,
        dailyAmount: Math.ceil(products[2 % products.length].pricing.finalPrice / 12),
        paidInstallments: 3,  // 25% complete
        status: 'ACTIVE',
        deliveryStatus: 'PENDING',
        addressIndex: 0,
        description: 'ACTIVE - 3/12 payments (25% complete)'
      },

      // One more completed with shipped status
      {
        productIndex: 1,
        totalDays: 7,
        dailyAmount: Math.ceil(products[1].pricing.finalPrice / 7),
        paidInstallments: 7,  // 100% complete
        status: 'COMPLETED',
        deliveryStatus: 'SHIPPED',
        addressIndex: 1,
        description: 'COMPLETED - All 7 payments, shipped'
      }
    ];

    const createdOrders = [];

    for (let i = 0; i < ordersToCreate.length; i++) {
      const config = ordersToCreate[i];
      const productId = products[config.productIndex]._id;

      console.log(`[${i + 1}/${ordersToCreate.length}] Creating: ${config.description}`);

      const result = await createOrderWithPayments(productId, config, user);

      if (result) {
        console.log(`   ✅ Order: ${result.order.orderId}`);
        console.log(`      Product: ${result.order.productName}`);
        console.log(`      Price: ₹${result.order.totalProductPrice}`);
        console.log(`      Progress: ${result.order.paidInstallments}/${result.order.totalDays} (${Math.round((result.order.paidInstallments / result.order.totalDays) * 100)}%)`);
        console.log(`      Status: ${result.order.status} / ${result.order.deliveryStatus}`);
        console.log(`      Payments Created: ${result.payments.length}\n`);

        createdOrders.push(result);
      } else {
        console.log(`   ❌ Failed to create order\n`);
      }

      // Small delay between creations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('─'.repeat(70));
    console.log('\n✅ SEEDING COMPLETE!\n');

    console.log('📊 Summary:');
    console.log(`   Total Orders Created: ${createdOrders.length}`);

    const byStatus = createdOrders.reduce((acc, o) => {
      acc[o.order.status] = (acc[o.order.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`   PENDING: ${byStatus.PENDING || 0}`);
    console.log(`   ACTIVE: ${byStatus.ACTIVE || 0}`);
    console.log(`   COMPLETED: ${byStatus.COMPLETED || 0}`);

    const totalValue = createdOrders.reduce((sum, o) => sum + o.order.totalProductPrice, 0);
    const totalPaid = createdOrders.reduce((sum, o) => sum + o.order.totalPaidAmount, 0);

    console.log(`\n   Total Order Value: ₹${totalValue.toLocaleString('en-IN')}`);
    console.log(`   Total Paid: ₹${totalPaid.toLocaleString('en-IN')}`);
    console.log(`   Total Remaining: ₹${(totalValue - totalPaid).toLocaleString('en-IN')}`);

    console.log('\n📱 Developer can now test:');
    console.log('   GET /api/installments/orders - All orders');
    console.log('   GET /api/installments/orders/stats - Statistics');
    console.log('   GET /api/installments/orders/overall-status - Overall status');
    console.log('   GET /api/installments/payments/daily-pending - Pending payments');
    console.log('   GET /api/installments/orders/:orderId/summary - Order summary');
    console.log('   POST /api/installments/payments/process - Make payment\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }
}

main().catch(console.error);
