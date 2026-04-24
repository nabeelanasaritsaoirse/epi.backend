const mongoose = require('mongoose');
const InstallmentOrder = require('../models/InstallmentOrder');
require('dotenv').config();

async function checkSkipDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const orderId = 'ORD-20260102-8B28';

    const order = await InstallmentOrder.findOne({ orderId });

    if (!order) {
      console.log('Order not found');
      return;
    }

    console.log('\n=== ORDER DETAILS ===');
    console.log('Order ID:', order.orderId);
    console.log('User ID:', order.user);
    console.log('\n=== AUTOPAY SKIP DATES ===');

    if (!order.autopay?.skipDates || order.autopay.skipDates.length === 0) {
      console.log('No skip dates found');
    } else {
      console.log('Skip dates count:', order.autopay.skipDates.length);
      console.log('\nSkip dates (raw from DB):');
      order.autopay.skipDates.forEach((date, index) => {
        console.log(`${index + 1}. ${date}`);
        console.log(`   ISO String: ${date.toISOString()}`);
        console.log(`   UTC: ${date.toUTCString()}`);
        console.log(`   Local: ${date.toLocaleString()}`);
        console.log(`   Date only: ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
        console.log('');
      });
    }

    console.log('\n=== RAW AUTOPAY OBJECT ===');
    console.log(JSON.stringify(order.autopay, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkSkipDates();
