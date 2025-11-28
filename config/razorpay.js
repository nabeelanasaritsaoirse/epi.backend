const Razorpay = require('razorpay');
require('dotenv').config();

// Check if Razorpay credentials are available
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ ERROR: Razorpay credentials not found!');
  console.error('❌ Please add the following to your .env file:');
  console.error('   RAZORPAY_KEY_ID=your_razorpay_key_id');
  console.error('   RAZORPAY_KEY_SECRET=your_razorpay_key_secret');
  console.error('');
  console.error('⚠️  Server will start but Razorpay payments will NOT work!');
  console.error('');

  // Export a mock Razorpay instance to prevent crashes
  module.exports = {
    orders: {
      create: () => {
        throw new Error('Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env file');
      }
    }
  };
} else {
  // Initialize Razorpay with environment variables
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  console.log('✅ Razorpay initialized successfully');

  module.exports = razorpay;
} 