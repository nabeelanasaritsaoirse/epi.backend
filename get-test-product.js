/**
 * Get or create a test product for order creation testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function getTestProduct() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const Product = require('./models/Product');

    // Find any active product
    let product = await Product.findOne({ isActive: true }).sort({ createdAt: -1 });

    if (!product) {
      console.log('❌ No products found. Creating test product...\n');

      product = new Product({
        name: 'Test Product for Installments',
        description: 'This is a test product for testing installment orders',
        price: 1000,
        category: 'Test Category',
        images: ['https://via.placeholder.com/500'],
        stock: 100,
        isActive: true,
        installmentPlans: [
          {
            days: 20,
            dailyAmount: 50,
            isActive: true
          },
          {
            days: 30,
            dailyAmount: 35,
            isActive: true
          }
        ]
      });

      await product.save();
      console.log('✅ Test product created!\n');
    } else {
      console.log('✅ Found existing product\n');
    }

    console.log('📦 Product Details:');
    console.log('='.repeat(80));
    console.log(`   ID: ${product._id}`);
    console.log(`   Name: ${product.name}`);
    console.log(`   Price: ₹${product.price}`);
    console.log(`   Stock: ${product.stock || 'Unlimited'}`);
    console.log(`   Active: ${product.isActive}`);

    if (product.installmentPlans && product.installmentPlans.length > 0) {
      console.log(`\n   💳 Installment Plans:`);
      product.installmentPlans.forEach((plan, idx) => {
        console.log(`      ${idx + 1}. ${plan.days} days @ ₹${plan.dailyAmount}/day (Total: ₹${plan.days * plan.dailyAmount})`);
      });
    }

    console.log('='.repeat(80));
    console.log(`\n✅ Use this Product ID in tests: ${product._id}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

getTestProduct();
