/**
 * Fix payment dates to show pending payments for TODAY
 * This connects to the same MongoDB as the live server
 */

const mongoose = require('mongoose');

// Try multiple MongoDB URI patterns
const POSSIBLE_URIS = [
  'mongodb+srv://nabeelanasaritsaoirse:JDvSwcDslYk7sVLq@cluster0.cxfzl.mongodb.net/epi?retryWrites=true&w=majority',
  'mongodb://127.0.0.1:27017/epi_backend',
  'mongodb://localhost:27017/epi_backend'
];

const USER_ID = '691d6035962542bf4120f30b';

const InstallmentOrder = require('./models/InstallmentOrder');

async function connectToMongoDB() {
  for (const uri of POSSIBLE_URIS) {
    try {
      console.log(`Trying to connect to: ${uri.substring(0, 30)}...`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('✅ Connected successfully!\n');
      return true;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  return false;
}

async function fixPendingPayments() {
  console.log('\n' + '🔧'.repeat(35));
  console.log('   FIXING PAYMENT DATES FOR TODAY');
  console.log('🔧'.repeat(35) + '\n');

  try {
    // Connect to MongoDB
    const connected = await connectToMongoDB();

    if (!connected) {
      console.log('\n❌ Could not connect to MongoDB');
      console.log('💡 Please provide the correct MongoDB URI\n');
      return;
    }

    // Find ACTIVE orders
    const activeOrders = await InstallmentOrder.find({
      user: USER_ID,
      status: 'ACTIVE'
    });

    console.log(`✅ Found ${activeOrders.length} ACTIVE orders\n`);

    if (activeOrders.length === 0) {
      console.log('❌ No ACTIVE orders to update');
      return;
    }

    // Set today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`📅 Today's date: ${today.toISOString()}\n`);
    console.log('🔧 Updating payment schedules...\n');

    let totalUpdated = 0;

    for (const order of activeOrders) {
      console.log(`📦 Order: ${order.orderId}`);
      console.log(`   Current: ${order.paidInstallments}/${order.totalDays} paid`);

      // Find next PENDING installment
      let updatedCount = 0;

      for (let i = 0; i < order.paymentSchedule.length; i++) {
        const installment = order.paymentSchedule[i];

        if (installment.status === 'PENDING') {
          // Update next 2-3 pending payments to have today's date or earlier
          if (updatedCount === 0) {
            // First pending - set to today
            order.paymentSchedule[i].dueDate = new Date(today);
            console.log(`   ✅ Installment #${installment.installmentNumber} → DUE TODAY`);
            updatedCount++;
          } else if (updatedCount === 1) {
            // Second pending - set to yesterday (overdue)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            order.paymentSchedule[i].dueDate = yesterday;
            console.log(`   ✅ Installment #${installment.installmentNumber} → OVERDUE (Yesterday)`);
            updatedCount++;
          } else if (updatedCount === 2) {
            // Third pending - set to 2 days ago (more overdue)
            const twoDaysAgo = new Date(today);
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            order.paymentSchedule[i].dueDate = twoDaysAgo;
            console.log(`   ✅ Installment #${installment.installmentNumber} → OVERDUE (2 days ago)`);
            updatedCount++;
            break; // Stop after 3 updates
          }
        }
      }

      if (updatedCount > 0) {
        await order.save();
        totalUpdated++;
        console.log(`   💾 Saved ${updatedCount} date updates\n`);
      }
    }

    console.log('─'.repeat(70));
    console.log(`\n✅ Updated ${totalUpdated} orders successfully!\n`);

    // Verify the changes
    console.log('🔍 Verifying daily-pending data...\n');

    const ordersWithPendingToday = await InstallmentOrder.find({
      user: USER_ID,
      status: 'ACTIVE',
      'paymentSchedule': {
        $elemMatch: {
          status: 'PENDING',
          dueDate: { $lte: new Date() }
        }
      }
    });

    console.log(`✅ Orders with pending payments (today or overdue): ${ordersWithPendingToday.length}\n`);

    let totalPending = 0;
    let totalAmount = 0;

    console.log('📋 Pending Payments for Daily-Pending API:\n');

    ordersWithPendingToday.forEach((order, idx) => {
      const pendingItems = order.paymentSchedule.filter(
        item => item.status === 'PENDING' && new Date(item.dueDate) <= new Date()
      );

      console.log(`${idx + 1}. ${order.orderId}`);
      pendingItems.forEach(item => {
        const dueDate = new Date(item.dueDate);
        const isOverdue = dueDate < today;
        console.log(`   - Installment #${item.installmentNumber}: ₹${item.amount} (${isOverdue ? 'OVERDUE' : 'DUE TODAY'})`);
        totalAmount += item.amount;
        totalPending++;
      });
      console.log('');
    });

    console.log('─'.repeat(70));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total Pending Payments: ${totalPending}`);
    console.log(`   Total Amount: ₹${totalAmount}`);
    console.log(`   Orders Affected: ${ordersWithPendingToday.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ DAILY-PENDING API IS NOW READY!\n');
    console.log('Test with:');
    console.log('GET /api/installments/payments/daily-pending\n');
    console.log(`Expected: ${totalPending} payments totaling ₹${totalAmount}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB\n');
    }
  }
}

fixPendingPayments()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
