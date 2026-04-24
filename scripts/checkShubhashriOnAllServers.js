/**
 * Check Shubhashri user on all servers
 */

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const EMAIL = 'shubhashri.it.saoirse@gmail.com';
const PASSWORD = 'Shubha@123';

const servers = [
  { name: 'Production', url: 'http://13.127.15.87:8080' },
  { name: 'Dev (localhost)', url: 'http://localhost:3000' },
  { name: 'Dev (localhost:8080)', url: 'http://localhost:8080' },
];

async function testServer(server) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Testing: ${server.name}`);
  console.log(`🌐 URL: ${server.url}`);
  console.log('='.repeat(80));

  try {
    // Check if server is reachable
    console.log('\n1️⃣ Checking if server is reachable...');
    await axios.get(`${server.url}/`, { timeout: 3000 });
    console.log('✅ Server is reachable');

    // Try login
    console.log('\n2️⃣ Attempting login...');
    const loginRes = await axios.post(`${server.url}/api/auth/admin-login`, {
      email: EMAIL,
      password: PASSWORD
    }, { timeout: 5000 });

    if (loginRes.data.success) {
      console.log('✅ LOGIN SUCCESS!');
      console.log(`   👤 Name: ${loginRes.data.data.name}`);
      console.log(`   📋 Role: ${loginRes.data.data.role}`);
      console.log(`   🆔 ID: ${loginRes.data.data.userId}`);

      const token = loginRes.data.data.accessToken;

      // Test my-opportunities
      console.log('\n3️⃣ Testing my-opportunities API...');
      const oppRes = await axios.get(`${server.url}/api/sales/my-opportunities`, {
        params: { page: 1, limit: 20 },
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const total = oppRes.data.data.pagination.total;
      console.log(`   📊 Total Opportunities: ${total}`);
      if (total > 0) {
        console.log('   🎉 DATA FOUND!');
        console.log(JSON.stringify(oppRes.data.data.opportunities.slice(0, 2), null, 2));
      }

      return { success: true, server: server.name };
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running');
    } else if (error.response && error.response.status === 401) {
      console.log('❌ Login failed: Invalid credentials');
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ Request timeout');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return { success: false, server: server.name };
  }
}

async function checkDatabase() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔍 Checking Local Database');
  console.log('='.repeat(80));

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);

    const User = require('../models/User');

    // Search for user
    console.log(`\n📧 Searching for: ${EMAIL}`);
    const user = await User.findOne({ email: EMAIL });

    if (user) {
      console.log('✅ USER FOUND in database!');
      console.log({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedUserId: user.linkedUserId || 'NOT SET',
        hasPassword: !!user.password,
        referralCode: user.referralCode || 'NOT SET'
      });
    } else {
      console.log('❌ User NOT FOUND in database');

      // Search for similar emails
      console.log('\n🔍 Searching for similar emails...');
      const similar = await User.find({ email: /shubh/i }).select('email name role');
      if (similar.length > 0) {
        console.log(`Found ${similar.length} user(s) with "shubh":`);
        similar.forEach(u => console.log(`   - ${u.email} (${u.name}) - ${u.role}`));
      } else {
        console.log('   No similar users found');
      }

      // List all users
      const totalUsers = await User.countDocuments();
      console.log(`\n📊 Total users in database: ${totalUsers}`);

      if (totalUsers > 0) {
        console.log('\nFirst 5 users:');
        const users = await User.find().select('email name role').limit(5);
        users.forEach(u => console.log(`   - ${u.email} (${u.name}) - ${u.role}`));
      }
    }
  } catch (error) {
    console.log('❌ Database error:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

async function main() {
  console.log('\n🚀 Checking Shubhashri User on All Servers');
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🔐 Password: ${PASSWORD}\n`);

  const results = [];

  // Test all servers
  for (const server of servers) {
    const result = await testServer(server);
    results.push(result);
  }

  // Check database
  await checkDatabase();

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.server}`);
  });

  const working = results.find(r => r.success);
  if (working) {
    console.log(`\n🎉 User found on: ${working.server}`);
  } else {
    console.log('\n⚠️  User not found on any server');
    console.log('\n💡 Possible reasons:');
    console.log('   1. Dev server is not running (start with: npm run dev)');
    console.log('   2. Email or password is incorrect');
    console.log('   3. User exists only in production database');
    console.log('   4. User needs to be created');
  }

  console.log('\n✅ Check complete!\n');
}

main();
