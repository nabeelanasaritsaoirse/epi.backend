/**
 * Check Database Script
 * Verifies database connection and shows all collections
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  try {
    console.log('🔍 Checking database configuration...\n');

    console.log('MONGO_URI:', process.env.MONGO_URI ?
      process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') :
      'NOT SET');

    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log(`📊 Database name: ${dbName}\n`);

    // List all collections
    console.log('📂 Collections in database:');
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log('   ⚠️  No collections found! Database is empty.\n');
    } else {
      console.log(`   Found ${collections.length} collection(s):\n`);

      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`   - ${collection.name}: ${count} document(s)`);
      }
    }

    // Check if users collection exists
    console.log('\n🔍 Checking users collection specifically...');
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    console.log(`   Total users in User model: ${userCount}`);

    if (userCount === 0) {
      console.log('\n⚠️  No users found in database!');
      console.log('   This could mean:');
      console.log('   1. The database is new and empty');
      console.log('   2. You\'re connecting to the wrong database');
      console.log('   3. The admin login is using a different auth mechanism\n');

      console.log('💡 Suggestions:');
      console.log('   1. Check if you have production vs development databases');
      console.log('   2. Verify MONGO_URI in .env file');
      console.log('   3. Check if admin login creates the user on first login');
      console.log('   4. Run your database seed/migration scripts if you have any\n');
    }

    // Show some sample documents from each collection
    console.log('\n📄 Sample data from each collection:');
    for (const collection of collections) {
      const sample = await db.collection(collection.name).findOne();
      if (sample) {
        console.log(`\n   ${collection.name} (sample document):`);
        console.log('   ', JSON.stringify(sample, null, 2).split('\n').slice(0, 10).join('\n    '));
        if (JSON.stringify(sample).split('\n').length > 10) {
          console.log('   ... (truncated)');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

main().catch(console.error);
