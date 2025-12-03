/**
 * Seed Test Products for Installment Order Testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function seedProducts() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const Product = require('./models/Product');

    // Clear existing products (optional - comment out if you want to keep existing data)
    // await Product.deleteMany({});
    // console.log('🗑️  Cleared existing products\n');

    // Test products with different price ranges
    const testProducts = [
      {
        productId: 'PROD-TEST-001',
        name: 'Bouquet',
        description: {
          short: 'Beautiful flower bouquet',
          long: 'Beautiful flower bouquet for testing small installment plans'
        },
        category: {
          mainCategoryId: '507f1f77bcf86cd799439011',
          mainCategoryName: 'Gifts',
          subCategory: 'Flowers'
        },
        brand: 'TestBrand',
        pricing: {
          basePrice: 400,
          finalPrice: 400,
          discount: 0
        },
        availability: {
          isAvailable: true,
          stock: 100
        },
        images: [{ url: 'https://via.placeholder.com/400', altText: 'Bouquet' }],
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011' // Dummy admin ID
      },
      {
        productId: 'PROD-TEST-002',
        name: 'Premium Wireless Headphones',
        description: {
          short: 'High-quality wireless headphones',
          long: 'High-quality wireless headphones for testing medium installment plans'
        },
        category: {
          mainCategoryId: '507f1f77bcf86cd799439011',
          mainCategoryName: 'Electronics',
          subCategory: 'Audio'
        },
        brand: 'TestBrand',
        pricing: {
          basePrice: 4000,
          finalPrice: 4000,
          discount: 0
        },
        availability: {
          isAvailable: true,
          stock: 50
        },
        images: [{ url: 'https://via.placeholder.com/400', altText: 'Headphones' }],
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011'
      },
      {
        productId: 'PROD-TEST-003',
        name: 'Premium Product',
        description: {
          short: 'Mid-range product',
          long: 'Mid-range product for testing'
        },
        category: {
          mainCategoryId: '507f1f77bcf86cd799439011',
          mainCategoryName: 'General',
          subCategory: 'Misc'
        },
        brand: 'TestBrand',
        pricing: {
          basePrice: 4000,
          finalPrice: 4000,
          discount: 0
        },
        availability: {
          isAvailable: true,
          stock: 30
        },
        images: [{ url: 'https://via.placeholder.com/400', altText: 'Product' }],
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011'
      },
      {
        productId: 'PROD-TEST-004',
        name: 'Smartwatch Pro',
        description: {
          short: 'Feature-rich smartwatch',
          long: 'Feature-rich smartwatch for testing'
        },
        category: {
          mainCategoryId: '507f1f77bcf86cd799439011',
          mainCategoryName: 'Electronics',
          subCategory: 'Wearables'
        },
        brand: 'TestBrand',
        pricing: {
          basePrice: 8000,
          finalPrice: 8000,
          discount: 0
        },
        availability: {
          isAvailable: true,
          stock: 25
        },
        images: [{ url: 'https://via.placeholder.com/400', altText: 'Smartwatch' }],
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011'
      },
      {
        productId: 'PROD-TEST-005',
        name: 'Laptop - Budget Edition',
        description: {
          short: 'Affordable laptop',
          long: 'Affordable laptop for everyday use'
        },
        category: {
          mainCategoryId: '507f1f77bcf86cd799439011',
          mainCategoryName: 'Electronics',
          subCategory: 'Computers'
        },
        brand: 'TestBrand',
        pricing: {
          basePrice: 25000,
          finalPrice: 25000,
          discount: 0
        },
        availability: {
          isAvailable: true,
          stock: 15
        },
        images: [{ url: 'https://via.placeholder.com/400', altText: 'Laptop' }],
        status: 'active',
        createdBy: '507f1f77bcf86cd799439011'
      }
    ];

    console.log('📦 Creating test products...\n');

    for (const productData of testProducts) {
      const product = new Product(productData);
      await product.save();
      console.log(`✅ Created: ${product.name} - ₹${product.pricing.finalPrice}`);
    }

    console.log(`\n✅ Successfully seeded ${testProducts.length} products!`);
    console.log('\n📋 Products created:');
    console.log('   1. Bouquet - ₹400 (for 8-day plans)');
    console.log('   2. Premium Wireless Headphones - ₹4,000 (for 15-day plans)');
    console.log('   3. Premium Product - ₹4,000 (for testing)');
    console.log('   4. Smartwatch Pro - ₹8,000 (for 30-day plans)');
    console.log('   5. Laptop - ₹25,000 (for longer plans)');
    console.log('\n🎯 You can now run create-installment-orders.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();
