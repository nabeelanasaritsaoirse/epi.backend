const axios = require('axios');

const BASE_URL = 'https://api.epielio.com';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNjAzNTk2MjU0MmJmNDEyMGYzMGIiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2Mzk1NDU4MywiZXhwIjoxNzY0NTU5MzgzfQ.F-goKWFq0_8QG6yy26W-rjMpiBZqSKVBCzz7QZnDMNI';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function debug() {
  console.log('='.repeat(60));
  console.log('🔍 DEBUG: Checking Products API');
  console.log('='.repeat(60));

  try {
    const res = await api.get('/api/products');
    console.log('Status:', res.status);
    console.log('Response structure:', JSON.stringify(Object.keys(res.data), null, 2));
    console.log('Full response:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUG: Checking Add Money Error');
  console.log('='.repeat(60));

  try {
    const res = await api.post('/api/wallet/add-money', { amount: 5000 });
    console.log('Success:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log('Error Status:', error.response?.status);
    console.log('Error Data:', JSON.stringify(error.response?.data, null, 2));
    console.log('Error Message:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUG: Checking Featured Products');
  console.log('='.repeat(60));

  try {
    const res = await api.get('/api/products/featured/all');
    console.log('Featured products:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUG: List All Routes');
  console.log('='.repeat(60));

  const endpoints = [
    '/api/products',
    '/api/products/featured/all',
    '/api/categories',
    '/api/wallet',
    '/api/orders/user/history',
    '/api/cart/cart',
    '/api/wishlist'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await api.get(endpoint);
      console.log(`✅ ${endpoint}: ${res.status} - ${JSON.stringify(res.data).substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

debug().then(() => {
  console.log('\n✅ Debug completed');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
