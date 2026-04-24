const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
require('dotenv').config();

async function testProductAndUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check product
    const productId = '693d045cce6a542332a5e311';
    const product = await Product.findById(productId);

    if (!product) {
      console.log('❌ Product not found');
    } else {
      console.log('\n✅ Product found:', product.name);
      console.log('Price:', product.pricing?.finalPrice || product.pricing?.regularPrice);

      if (product.variants && product.variants.length > 0) {
        console.log('\n📦 Variants:');
        product.variants.forEach(v => {
          console.log(`  - ${v.variantId}: ₹${v.salePrice || v.price} (Active: ${v.isActive})`);
        });

        const variant = product.variants.find(v => v.variantId === 'VAR49277885200');
        if (variant) {
          console.log('\n✅ Requested variant found:', variant.variantId);
          console.log('   Price:', variant.salePrice || variant.price);
          console.log('   Active:', variant.isActive);
        } else {
          console.log('\n❌ Requested variant VAR49277885200 NOT found');
        }
      } else {
        console.log('No variants available');
      }
    }

    // Check user
    const userId = '693ab2a96b96469dc79ae8d6';
    const user = await User.findById(userId);

    if (!user) {
      console.log('\n❌ User not found');
    } else {
      console.log('\n✅ User found:', user.name);
      console.log('Email:', user.email);
      console.log('Wallet balance:', user.wallet?.balance || 0);
      console.log('Referred by:', user.referredBy || 'None');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testProductAndUser();
