const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
require('dotenv').config();

async function getProductionData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to Production MongoDB\n');

    // Find a real user (not admin)
    console.log('🔍 Finding real users...');
    const users = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id name email phoneNumber wallet.balance referredBy');

    if (users.length > 0) {
      console.log(`\n✅ Found ${users.length} users:\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. User ID: ${user._id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phoneNumber || 'N/A'}`);
        console.log(`   Wallet: ₹${user.wallet?.balance || 0}`);
        console.log(`   Has Referrer: ${user.referredBy ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('❌ No users found in production!');
    }

    // Find real products with variants
    console.log('\n🔍 Finding products with variants...');
    const productsWithVariants = await Product.find({
      'variants.0': { $exists: true },
      'availability.isAvailable': true
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id name pricing variants');

    if (productsWithVariants.length > 0) {
      console.log(`\n✅ Found ${productsWithVariants.length} products with variants:\n`);
      productsWithVariants.forEach((product, index) => {
        console.log(`${index + 1}. Product ID: ${product._id}`);
        console.log(`   Name: ${product.name}`);
        console.log(`   Price: ₹${product.pricing?.finalPrice || product.pricing?.regularPrice || 0}`);
        console.log(`   Variants (${product.variants.length}):`);
        product.variants.slice(0, 3).forEach(v => {
          console.log(`     - ${v.variantId}: ₹${v.salePrice || v.price} (Active: ${v.isActive})`);
        });
        console.log('');
      });
    }

    // Find products without variants
    console.log('\n🔍 Finding products without variants...');
    const productsNoVariants = await Product.find({
      $or: [
        { variants: { $exists: false } },
        { variants: { $size: 0 } }
      ],
      'availability.isAvailable': true
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id name pricing');

    if (productsNoVariants.length > 0) {
      console.log(`\n✅ Found ${productsNoVariants.length} products without variants:\n`);
      productsNoVariants.forEach((product, index) => {
        console.log(`${index + 1}. Product ID: ${product._id}`);
        console.log(`   Name: ${product.name}`);
        console.log(`   Price: ₹${product.pricing?.finalPrice || product.pricing?.regularPrice || 0}`);
        console.log('');
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRODUCTION DATABASE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Users Found: ${users.length}`);
    console.log(`Products with Variants: ${productsWithVariants.length}`);
    console.log(`Products without Variants: ${productsNoVariants.length}`);
    console.log('='.repeat(60) + '\n');

    if (users.length > 0 && (productsWithVariants.length > 0 || productsNoVariants.length > 0)) {
      console.log('✅ You can use these IDs for testing!\n');
      console.log('Example test case:');
      console.log('------------------');
      console.log(`User ID: ${users[0]._id}`);
      if (productsWithVariants.length > 0) {
        console.log(`Product ID: ${productsWithVariants[0]._id}`);
        console.log(`Variant ID: ${productsWithVariants[0].variants[0].variantId}`);
      } else if (productsNoVariants.length > 0) {
        console.log(`Product ID: ${productsNoVariants[0]._id}`);
        console.log('Variant ID: (not needed)');
      }
      console.log('');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

getProductionData();
