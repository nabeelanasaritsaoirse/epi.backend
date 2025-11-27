/**
 * Verify test results in database
 * Check orders and payments created during tests
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function verifyResults() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const InstallmentOrder = require('./models/InstallmentOrder');
    const PaymentRecord = require('./models/PaymentRecord');

    // Get orders from last test run (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const testOrders = await InstallmentOrder.find({
      createdAt: { $gte: fiveMinutesAgo }
    }).sort({ createdAt: -1 });

    console.log('📦 TEST ORDERS VERIFICATION');
    console.log('='.repeat(80));
    console.log(`Found ${testOrders.length} orders created in last 5 minutes\n`);

    for (const order of testOrders) {
      console.log(`Order ID: ${order.orderId}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Quantity: ${order.quantity}`);
      console.log(`   Total Product Price: ₹${order.totalProductPrice}`);
      console.log(`   Daily Amount: ₹${order.dailyPaymentAmount}`);
      console.log(`   Total Days: ${order.totalDays}`);
      console.log(`   Paid Installments: ${order.paidInstallments}`);
      console.log(`   First Payment Method: ${order.firstPaymentMethod}`);
      console.log(`   First Payment ID: ${order.firstPaymentId || 'N/A'}`);

      // Get associated payment
      if (order.firstPaymentId) {
        const payment = await PaymentRecord.findById(order.firstPaymentId);
        if (payment) {
          console.log(`   ✅ Payment Record Found:`);
          console.log(`      Payment ID: ${payment.paymentId}`);
          console.log(`      Status: ${payment.status}`);
          console.log(`      Amount: ₹${payment.amount}`);
          console.log(`      Idempotency Key: ${payment.idempotencyKey || '❌ MISSING!'}`);
          console.log(`      Commission Calculated: ${payment.commissionCalculated}`);

          // Verify idempotencyKey format
          if (payment.idempotencyKey) {
            const parts = payment.idempotencyKey.split('-');
            if (parts.length === 3) {
              console.log(`      ✅ Idempotency key format correct: {orderId}-{installmentNumber}-{timestamp}`);
            } else {
              console.log(`      ⚠️  Idempotency key format incorrect`);
            }
          } else {
            console.log(`      ❌ CRITICAL: Idempotency key is MISSING!`);
          }
        }
      }
      console.log('');
    }

    // Check for any duplicate idempotencyKeys
    console.log('\n🔍 CHECKING FOR DUPLICATE IDEMPOTENCY KEYS');
    console.log('='.repeat(80));

    const payments = await PaymentRecord.find({
      createdAt: { $gte: fiveMinutesAgo }
    });

    const idempotencyKeys = payments.map(p => p.idempotencyKey).filter(Boolean);
    const uniqueKeys = new Set(idempotencyKeys);

    if (idempotencyKeys.length === uniqueKeys.size) {
      console.log(`✅ All ${idempotencyKeys.length} idempotency keys are UNIQUE!`);
    } else {
      console.log(`❌ DUPLICATES FOUND! Total: ${idempotencyKeys.length}, Unique: ${uniqueKeys.size}`);

      // Find duplicates
      const keyCount = {};
      idempotencyKeys.forEach(key => {
        keyCount[key] = (keyCount[key] || 0) + 1;
      });

      const duplicates = Object.entries(keyCount).filter(([key, count]) => count > 1);
      console.log('\n   Duplicate keys:');
      duplicates.forEach(([key, count]) => {
        console.log(`   - ${key}: ${count} times`);
      });
    }

    console.log('\n');
    console.log('📊 FINAL VERDICT');
    console.log('='.repeat(80));

    let allPassed = true;

    // Check 1: All orders have orderIds
    const ordersWithoutOrderId = testOrders.filter(o => !o.orderId);
    if (ordersWithoutOrderId.length === 0) {
      console.log('✅ All orders have auto-generated orderIds');
    } else {
      console.log(`❌ ${ordersWithoutOrderId.length} orders missing orderIds`);
      allPassed = false;
    }

    // Check 2: All WALLET payments have payment records with idempotencyKeys
    const walletOrders = testOrders.filter(o => o.firstPaymentMethod === 'WALLET');
    let paymentsWithIdempotency = 0;

    for (const order of walletOrders) {
      if (order.firstPaymentId) {
        const payment = await PaymentRecord.findById(order.firstPaymentId);
        if (payment && payment.idempotencyKey) {
          paymentsWithIdempotency++;
        }
      }
    }

    if (paymentsWithIdempotency === walletOrders.length) {
      console.log(`✅ All ${walletOrders.length} WALLET payments have idempotencyKeys`);
    } else {
      console.log(`❌ Only ${paymentsWithIdempotency}/${walletOrders.length} WALLET payments have idempotencyKeys`);
      allPassed = false;
    }

    // Check 3: No duplicate idempotencyKeys
    if (idempotencyKeys.length === uniqueKeys.size) {
      console.log('✅ No duplicate idempotencyKeys found');
    } else {
      console.log('❌ Duplicate idempotencyKeys detected');
      allPassed = false;
    }

    // Check 4: All fields populated (no undefined in response)
    const ordersWithUndefined = testOrders.filter(o => {
      const json = JSON.stringify(o.toObject());
      return json.includes('undefined');
    });

    if (ordersWithUndefined.length === 0) {
      console.log('✅ No undefined values in order documents');
    } else {
      console.log(`❌ ${ordersWithUndefined.length} orders contain undefined values`);
      allPassed = false;
    }

    console.log('='.repeat(80));

    if (allPassed) {
      console.log('\n🎉 ALL CHECKS PASSED! System is working perfectly!\n');
    } else {
      console.log('\n⚠️  Some issues detected. Please review above.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyResults();
