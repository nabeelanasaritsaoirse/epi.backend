const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//<user>:<password>@'));

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected successfully!\n');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`📂 Database Name: ${dbName}\n`);

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`📊 Total Collections: ${collections.length}\n`);

    if (collections.length > 0) {
      console.log('Collections in database:');
      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`  - ${coll.name}: ${count} documents`);
      }
    } else {
      console.log('❌ No collections found in database!');
    }

    // Check specific collections
    console.log('\n🔍 Checking key collections:');

    const userCount = await db.collection('users').countDocuments();
    console.log(`  Users: ${userCount}`);

    const productCount = await db.collection('products').countDocuments();
    console.log(`  Products: ${productCount}`);

    const orderCount = await db.collection('orders').countDocuments();
    console.log(`  Orders: ${orderCount}`);

    const installmentOrderCount = await db.collection('installmentorders').countDocuments();
    console.log(`  Installment Orders: ${installmentOrderCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
