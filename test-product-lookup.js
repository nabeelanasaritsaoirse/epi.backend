/**
 * Test script to verify product lookup and data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function testProductLookup() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI not found in .env file');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const productId = '693d045cce6a542332a5e311';
    const variantId = 'VAR49277885200';

    console.log('========================================');
    console.log('TESTING PRODUCT LOOKUP');
    console.log('========================================\n');

    // Test 1: Try to find by MongoDB _id
    console.log(`1️⃣ Attempting to find product by _id: ${productId}`);
    let product = null;
    if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
      product = await Product.findById(productId);
      if (product) {
        console.log(`   ✅ Found by _id!`);
      } else {
        console.log(`   ❌ Not found by _id`);
      }
    } else {
      console.log(`   ⚠️  Not a valid MongoDB ObjectId`);
    }

    // Test 2: Try to find by custom productId field
    if (!product) {
      console.log(`\n2️⃣ Attempting to find product by productId field: ${productId}`);
      product = await Product.findOne({ productId: productId });
      if (product) {
        console.log(`   ✅ Found by productId field!`);
      } else {
        console.log(`   ❌ Not found by productId field`);
      }
    }

    if (!product) {
      console.log('\n❌ PRODUCT NOT FOUND!\n');
      console.log('Possible reasons:');
      console.log('1. Product does not exist in the database');
      console.log('2. Product ID is incorrect');
      console.log('3. Database connection is to wrong environment\n');

      // List some products to help debug
      console.log('Here are some products in the database:');
      const sampleProducts = await Product.find().limit(5).select('_id productId name pricing');
      sampleProducts.forEach(p => {
        console.log(`  - _id: ${p._id}, productId: ${p.productId || 'N/A'}, name: ${p.name}`);
      });

      process.exit(1);
    }

    console.log('\n========================================');
    console.log('PRODUCT DETAILS');
    console.log('========================================\n');
    console.log(`Name: ${product.name}`);
    console.log(`MongoDB _id: ${product._id}`);
    console.log(`Custom productId: ${product.productId || 'N/A'}`);
    console.log(`\nPricing:`);
    console.log(`  Regular Price: ₹${product.pricing?.regularPrice || 'N/A'}`);
    console.log(`  Sale Price: ₹${product.pricing?.salePrice || 'N/A'}`);
    console.log(`  Final Price: ₹${product.pricing?.finalPrice || 'N/A'}`);

    const pricePerUnit = product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
    console.log(`  → Will use: ₹${pricePerUnit}`);

    // Test variant lookup
    if (variantId) {
      console.log('\n========================================');
      console.log('VARIANT LOOKUP');
      console.log('========================================\n');
      console.log(`Looking for variant: ${variantId}`);

      if (!product.variants || product.variants.length === 0) {
        console.log('❌ Product has no variants!');
      } else {
        console.log(`Product has ${product.variants.length} variant(s):\n`);
        product.variants.forEach((v, i) => {
          console.log(`  ${i + 1}. variantId: ${v.variantId}`);
          console.log(`     SKU: ${v.sku}`);
          console.log(`     Price: ₹${v.price}`);
          console.log(`     Sale Price: ₹${v.salePrice || 'N/A'}`);
          console.log(`     Active: ${v.isActive}`);
          console.log(`     Stock: ${v.stock}`);
          if (v.attributes) {
            console.log(`     Attributes:`, JSON.stringify(v.attributes));
          }
          console.log('');
        });

        const selectedVariant = product.variants.find(v => v.variantId === variantId);
        if (selectedVariant) {
          console.log(`✅ Found requested variant: ${variantId}`);
          console.log(`   Price: ₹${selectedVariant.salePrice || selectedVariant.price}`);
          console.log(`   Active: ${selectedVariant.isActive}`);
          console.log(`   Stock: ${selectedVariant.stock}`);
        } else {
          console.log(`❌ Requested variant not found: ${variantId}`);
        }
      }
    }

    // Test availability
    console.log('\n========================================');
    console.log('AVAILABILITY CHECK');
    console.log('========================================\n');
    console.log(`Stock Status: ${product.availability?.stockStatus || 'N/A'}`);
    console.log(`Is Available: ${product.availability?.isAvailable ?? 'N/A'}`);

    if (product.availability?.stockStatus === 'out_of_stock' ||
        product.availability?.isAvailable === false) {
      console.log('⚠️  WARNING: Product is marked as unavailable!');
    } else {
      console.log('✅ Product is available for purchase');
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================\n');

    const finalPrice = variantId
      ? (product.variants?.find(v => v.variantId === variantId)?.salePrice ||
         product.variants?.find(v => v.variantId === variantId)?.price || 0)
      : (product.pricing?.finalPrice || product.pricing?.regularPrice || 0);

    console.log(`Product can be used for installment order: ${finalPrice > 0 ? '✅ YES' : '❌ NO (Invalid price)'}`);
    console.log(`Price that will be used: ₹${finalPrice}`);
    console.log(`For 3 items over 20 days:`);
    console.log(`  Total: ₹${finalPrice * 3}`);
    console.log(`  Daily: ₹${Math.ceil((finalPrice * 3) / 20)}`);

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testProductLookup();
