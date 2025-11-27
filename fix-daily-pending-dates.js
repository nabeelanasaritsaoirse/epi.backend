/**
 * Fix payment schedule dates to show pending payments for TODAY
 * This will update some orders to have today's due dates for testing daily-pending API
 */

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://nabeelanasaritsaoirse:JDvSwcDslYk7sVLq@cluster0.cxfzl.mongodb.net/epi?retryWrites=true&w=majority&appName=Cluster0';
const USER_ID = '691d6035962542bf4120f30b';

const InstallmentOrder = require('./models/InstallmentOrder');

async function fixDailyPendingDates() {
  console.log('\n' + '⏰'.repeat(35));
  console.log('   FIXING PAYMENT DUE DATES FOR DAILY-PENDING API');
  console.log('⏰'.repeat(35) + '\n');

  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get ACTIVE orders (these have at least 1 payment done)
    const activeOrders = await InstallmentOrder.find({
      user: USER_ID,
      status: 'ACTIVE'
    }).limit(5);

    console.log(`✅ Found ${activeOrders.length} ACTIVE orders\n`);

    if (activeOrders.length === 0) {
      console.log('❌ No ACTIVE orders found to update');
      process.exit(1);
    }

    console.log('🔧 Updating payment schedules to have TODAY as due date...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    let updatedCount = 0;

    for (const order of activeOrders) {
      console.log(`📝 Order: ${order.orderId}`);
      console.log(`   Current Schedule: ${order.paidInstallments}/${order.totalDays} paid`);

      // Find the next pending installment
      const nextPendingIndex = order.paymentSchedule.findIndex(
        item => item.status === 'PENDING'
      );

      if (nextPendingIndex === -1) {
        console.log(`   ⚠️  No pending installments found`);
        continue;
      }

      // Update the next 2-3 pending installments to have today's date
      const installmentsToUpdate = Math.min(3, order.paymentSchedule.length - nextPendingIndex);

      for (let i = 0; i < installmentsToUpdate; i++) {
        const index = nextPendingIndex + i;
        if (index < order.paymentSchedule.length && order.paymentSchedule[index].status === 'PENDING') {
          // Set due date to today (or yesterday for variety)
          const dueDate = new Date(today);
          if (i > 0) {
            dueDate.setDate(dueDate.getDate() - i); // Some overdue payments
          }

          order.paymentSchedule[index].dueDate = dueDate;
        }
      }

      await order.save();
      updatedCount++;

      console.log(`   ✅ Updated next ${installmentsToUpdate} installments to be due TODAY or OVERDUE`);
      console.log('');
    }

    console.log('─'.repeat(70));
    console.log(`\n✅ Updated ${updatedCount} orders successfully!\n`);

    // Verify by checking daily-pending
    console.log('🔍 Verifying daily-pending API...\n');

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

    console.log(`✅ Orders with pending payments (due today or overdue): ${ordersWithPendingToday.length}`);

    if (ordersWithPendingToday.length > 0) {
      console.log('\n📋 Orders ready for daily-pending API:');
      ordersWithPendingToday.forEach((order, idx) => {
        const pendingCount = order.paymentSchedule.filter(
          item => item.status === 'PENDING' && new Date(item.dueDate) <= new Date()
        ).length;
        console.log(`   ${idx + 1}. ${order.orderId} - ${pendingCount} payment(s) due`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ DAILY-PENDING API IS NOW READY FOR TESTING!\n');
    console.log('Test with:');
    console.log('GET /api/installments/payments/daily-pending\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }
}

fixDailyPendingDates()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
