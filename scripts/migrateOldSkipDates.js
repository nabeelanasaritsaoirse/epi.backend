/**
 * Migration Script: Fix old skip dates with timezone bug
 *
 * This script finds all skip dates stored with the OLD bug (18:30 UTC)
 * and either removes them or converts them to the NEW format (00:00 UTC)
 */

const mongoose = require('mongoose');
const InstallmentOrder = require('../models/InstallmentOrder');
require('dotenv').config();

async function migrateSkipDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');

    console.log('🔍 Finding orders with skip dates...');
    const orders = await InstallmentOrder.find({
      'autopay.skipDates.0': { $exists: true }  // Has at least one skip date
    });

    console.log(`Found ${orders.length} orders with skip dates`);
    console.log('');

    let totalFixed = 0;
    let totalRemoved = 0;

    for (const order of orders) {
      if (!order.autopay?.skipDates?.length) continue;

      console.log(`📦 Order: ${order.orderId}`);
      console.log(`   Current skip dates: ${order.autopay.skipDates.length}`);

      const oldDates = [];
      const newDates = [];

      order.autopay.skipDates.forEach(dateObj => {
        const d = new Date(dateObj);
        const hours = d.getUTCHours();
        const minutes = d.getUTCMinutes();

        if (hours === 18 && minutes === 30) {
          oldDates.push(dateObj);
        } else if (hours === 0 && minutes === 0) {
          newDates.push(dateObj);
        }
      });

      if (oldDates.length > 0) {
        console.log(`   🐛 Found ${oldDates.length} old buggy dates`);

        // Option 1: Remove all old dates (recommended - clean slate)
        order.autopay.skipDates = newDates;
        totalRemoved += oldDates.length;

        /* Option 2: Convert to new format (if you want to preserve the dates)
        const convertedDates = oldDates.map(d => {
          const date = new Date(d);
          // The date at 18:30 UTC is actually the NEXT day at 00:00 IST
          // So add 5.5 hours to get the correct date
          date.setUTCHours(date.getUTCHours() + 5);
          date.setUTCMinutes(date.getUTCMinutes() + 30);
          // Now set to midnight UTC
          return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        });

        order.autopay.skipDates = [...newDates, ...convertedDates];
        totalFixed += oldDates.length;
        */

        order.markModified('autopay.skipDates');
        await order.save();

        console.log(`   ✅ Cleaned up - removed ${oldDates.length} old dates`);
        console.log(`   📊 Remaining: ${order.autopay.skipDates.length} dates`);
      } else {
        console.log(`   ✅ No old dates - already using new format`);
      }

      console.log('');
    }

    console.log('='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total orders processed: ${orders.length}`);
    console.log(`Old buggy dates removed: ${totalRemoved}`);
    console.log(`Dates converted: ${totalFixed}`);
    console.log('');
    console.log('✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration
console.log('🚀 Starting Skip Dates Migration');
console.log('='.repeat(60));
console.log('');

migrateSkipDates();
