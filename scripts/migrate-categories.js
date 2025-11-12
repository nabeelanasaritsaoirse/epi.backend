// MongoDB Migration Script
// Run this to migrate existing products to use new category format

// Usage: mongo epi_backend scripts/migrate-categories.js
// Or in a Node.js script:
// node -e "require('./scripts/migrate-categories.js').migrateProducts();"

const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

/**
 * STEP 1: Create a mapping of old category names to new ObjectIds
 * This should be populated after creating categories in the database
 */
const categoryMapping = {
  // Example: "Electronics": ObjectId("507f1f77bcf86cd799439011"),
  // "Mobile Phones": ObjectId("507f1f77bcf86cd799439012"),
};

const subcategoryMapping = {
  // Example: "Mobile Phones": ObjectId("507f1f77bcf86cd799439012"),
  // "Laptops": ObjectId("507f1f77bcf86cd799439013"),
};

/**
 * Helper function to get all categories mapping
 */
async function buildCategoryMapping() {
  try {
    const categories = await Category.find({});
    const mapping = {};

    categories.forEach(cat => {
      mapping[cat.name] = cat._id;
    });

    return mapping;
  } catch (error) {
    console.error('Error building category mapping:', error);
    throw error;
  }
}

/**
 * Migrate products from old format to new format
 * Old format: category: { main: "Electronics", sub: "Mobile Phones" }
 * New format: category: { mainCategoryId: ObjectId, mainCategoryName: "Electronics", ... }
 */
async function migrateProducts() {
  try {
    console.log('Starting product migration...');

    // Build category mapping
    const categoryMap = await buildCategoryMapping();
    console.log('Category mapping built:', categoryMap);

    // Find all products with old format
    const products = await Product.find({
      'category.main': { $exists: true },
      'category.mainCategoryId': { $exists: false }
    });

    console.log(`Found ${products.length} products to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const mainCategoryName = product.category.main;
        const subCategoryName = product.category.sub;

        // Find main category
        const mainCategoryId = categoryMap[mainCategoryName];
        if (!mainCategoryId) {
          console.warn(`⚠️  Main category not found for: ${mainCategoryName} (Product: ${product.productId})`);
          errorCount++;
          continue;
        }

        // Find sub category if exists
        let subCategoryId = null;
        if (subCategoryName) {
          subCategoryId = categoryMap[subCategoryName];
          if (!subCategoryId) {
            console.warn(`⚠️  Sub category not found for: ${subCategoryName} (Product: ${product.productId})`);
          }
        }

        // Update product
        product.category = {
          mainCategoryId,
          mainCategoryName,
          subCategoryId: subCategoryId || null,
          subCategoryName: subCategoryName || null
        };

        await product.save();
        console.log(`✅ Migrated: ${product.productId} (${product.name})`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating product ${product.productId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`Total: ${migratedCount + errorCount}`);

    return {
      success: true,
      migratedCount,
      errorCount,
      totalProcessed: migratedCount + errorCount
    };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Verify migration was successful
 */
async function verifyMigration() {
  try {
    console.log('\n=== Verifying Migration ===');

    // Check if old format still exists
    const oldFormatProducts = await Product.find({
      'category.main': { $exists: true },
      'category.mainCategoryId': { $exists: false }
    });

    console.log(`Products with old format: ${oldFormatProducts.length}`);

    // Check if new format exists
    const newFormatProducts = await Product.find({
      'category.mainCategoryId': { $exists: true }
    });

    console.log(`Products with new format: ${newFormatProducts.length}`);

    // Show sample of new format
    if (newFormatProducts.length > 0) {
      console.log('\nSample migrated product:');
      console.log(JSON.stringify(newFormatProducts[0].category, null, 2));
    }

    return {
      oldFormatCount: oldFormatProducts.length,
      newFormatCount: newFormatProducts.length
    };
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}

/**
 * Rollback migration (optional)
 * WARNING: This will revert products back to old format
 */
async function rollbackMigration() {
  try {
    console.log('Starting rollback...');

    const products = await Product.find({
      'category.mainCategoryId': { $exists: true }
    });

    console.log(`Found ${products.length} products to rollback`);

    let rolledBackCount = 0;

    for (const product of products) {
      try {
        product.category = {
          main: product.category.mainCategoryName,
          sub: product.category.subCategoryName || undefined
        };

        await product.save();
        rolledBackCount++;
      } catch (error) {
        console.error(`Error rolling back product ${product.productId}:`, error.message);
      }
    }

    console.log(`✅ Rolled back ${rolledBackCount} products`);
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

/**
 * Check products without categories
 */
async function findProductsWithoutCategories() {
  try {
    console.log('\nChecking products without categories...');

    const productsWithoutCat = await Product.find({
      $or: [
        { 'category': { $exists: false } },
        { 'category.main': { $exists: false }, 'category.mainCategoryId': { $exists: false } }
      ]
    });

    console.log(`Found ${productsWithoutCat.length} products without categories`);

    if (productsWithoutCat.length > 0) {
      console.log('\nProducts without categories:');
      productsWithoutCat.slice(0, 5).forEach(p => {
        console.log(`- ${p.productId}: ${p.name}`);
      });

      if (productsWithoutCat.length > 5) {
        console.log(`... and ${productsWithoutCat.length - 5} more`);
      }
    }

    return productsWithoutCat.length;
  } catch (error) {
    console.error('Error checking products:', error);
    throw error;
  }
}

// Export functions for use in other files
module.exports = {
  migrateProducts,
  verifyMigration,
  rollbackMigration,
  findProductsWithoutCategories,
  buildCategoryMapping
};

/**
 * MIGRATION INSTRUCTIONS
 * 
 * 1. Create categories first:
 *    POST /api/categories - Create main categories
 *    POST /api/categories - Create subcategories
 * 
 * 2. Run this migration:
 *    Option A (in Node.js):
 *    node
 *    > const { migrateProducts } = require('./scripts/migrate-categories.js');
 *    > migrateProducts();
 * 
 *    Option B (command line):
 *    node scripts/run-migration.js
 * 
 * 3. Verify:
 *    > const { verifyMigration } = require('./scripts/migrate-categories.js');
 *    > verifyMigration();
 * 
 * 4. If needed, rollback:
 *    > const { rollbackMigration } = require('./scripts/migrate-categories.js');
 *    > rollbackMigration();
 */
