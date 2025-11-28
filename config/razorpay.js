const Razorpay = require('razorpay');
require('dotenv').config();

// Initialize Razorpay with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ,
  key_secret: process.env.RAZORPAY_KEY_SECRET 
});

// Log warning if using fallback credentials
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  WARNING: Razorpay credentials not found in environment variables. Using fallback values.');
  console.warn('⚠️  Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file for production.');
}

module.exports = razorpay; 