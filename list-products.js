/**
 * List all available products
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function listProducts() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const Product = require('./models/Product');

    const products = await Product.find({}).limit(10).select('_id productId name price isActive');

    if (products.length === 0) {
      console.log('❌ No products found in database!\n');
      console.log('💡 Please run the seed script or create products first.\n');
    } else {
      console.log(`📦 Found ${products.length} products:\n`);
      console.log('='.repeat(80));

      products.forEach((product, idx) => {
        console.log(`${idx + 1}. ID: ${product._id}`);
        console.log(`   Product ID: ${product.productId || 'N/A'}`);
        console.log(`   Name: ${product.name}`);
        console.log(`   Price: ₹${product.price || 'N/A'}`);
        console.log(`   Active: ${product.isActive}`);
        console.log('');
      });

      console.log('='.repeat(80));
      console.log(`\n✅ Use any of these Product IDs in your tests!\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

listProducts();
