/**
 * Fix MongoDB Collection Validator for InstallmentOrder
 *
 * The issue: MongoDB has a collection-level JSON schema validator that enforces
 * orderId as required. This validator persists even after changing the Mongoose schema.
 *
 * This script removes the validator so orders can be created with orderId
 * generated in the service layer.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collectionName = 'installmentorders';

    console.log(`📋 Checking collection: ${collectionName}`);

    // Get current collection info
    const collections = await db.listCollections({ name: collectionName }).toArray();

    if (collections.length === 0) {
      console.log(`ℹ️  Collection '${collectionName}' does not exist yet`);
      console.log('   No action needed - validator will be correct when collection is created\n');
      process.exit(0);
    }

    const collectionInfo = collections[0];
    console.log('Current collection options:', JSON.stringify(collectionInfo.options, null, 2));

    // Check if there's a validator
    if (collectionInfo.options && collectionInfo.options.validator) {
      console.log('\n⚠️  Found JSON schema validator!');
      console.log('Validator:', JSON.stringify(collectionInfo.options.validator, null, 2));

      console.log('\n🔧 Removing validator...');
      await db.command({
        collMod: collectionName,
        validator: {},
        validationLevel: 'off'
      });

      console.log('✅ Validator removed successfully!\n');
    } else {
      console.log('\nℹ️  No validator found on collection');
      console.log('   The issue must be coming from somewhere else\n');
    }

    console.log('✅ Fix completed!');
    console.log('\nNext steps:');
    console.log('1. Restart your Node.js server');
    console.log('2. Try creating an installment order again\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

fix();
