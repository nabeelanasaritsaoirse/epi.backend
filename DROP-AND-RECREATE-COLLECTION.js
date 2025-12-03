/**
 * NUCLEAR OPTION: Drop and recreate InstallmentOrder collection
 *
 * This will delete all existing installment orders and recreate
 * the collection with the correct schema.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function dropAndRecreate() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/epi_backend');
    console.log('✅ Connected\n');

    const collectionName = 'installmentorders';

    console.log(`⚠️  WARNING: This will DELETE ALL data in '${collectionName}' collection!`);
    console.log('Dropping collection in 3 seconds... Press Ctrl+C to cancel\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await mongoose.connection.db.collection(collectionName).drop();
      console.log(`✅ Collection '${collectionName}' dropped successfully\n`);
    } catch (error) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log(`ℹ️  Collection '${collectionName}' doesn't exist yet\n`);
      } else {
        throw error;
      }
    }

    console.log('✅ Done! The collection will be recreated automatically when you create the first order.');
    console.log('\nNext steps:');
    console.log('1. Restart your server');
    console.log('2. Try creating an installment order\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

dropAndRecreate();
