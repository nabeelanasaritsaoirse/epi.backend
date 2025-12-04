/**
 * Test script for Coupon Validation API
 * Run this after starting the server
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

// Helper function to make POST request
function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            body: response
          });
        } catch (e) {
          reject(new Error('Failed to parse response: ' + body));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Test cases
async function runTests() {
  console.log('🧪 Starting Coupon Validation API Tests\n');
  console.log('=' .repeat(60));

  // Test 1: Valid request with all required fields
  console.log('\n📋 Test 1: Valid coupon validation request');
  console.log('-'.repeat(60));
  try {
    const response = await makeRequest('/api/installments/validate-coupon', {
      couponCode: 'SAVE20',
      productId: 'PROD001',
      totalDays: 100,
      dailyAmount: 100,
      quantity: 1
    });

    console.log('Status Code:', response.statusCode);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 || response.statusCode === 404) {
      console.log('✅ Test 1 Passed: API is working correctly');
    } else {
      console.log('❌ Test 1 Failed: Unexpected status code');
    }
  } catch (error) {
    console.log('❌ Test 1 Failed:', error.message);
  }

  // Test 2: Missing required field
  console.log('\n📋 Test 2: Missing required field (should return 400)');
  console.log('-'.repeat(60));
  try {
    const response = await makeRequest('/api/installments/validate-coupon', {
      couponCode: 'SAVE20',
      // Missing productId
      totalDays: 100,
      dailyAmount: 100
    });

    console.log('Status Code:', response.statusCode);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 400) {
      console.log('✅ Test 2 Passed: Validation working correctly');
    } else {
      console.log('❌ Test 2 Failed: Should return 400');
    }
  } catch (error) {
    console.log('❌ Test 2 Failed:', error.message);
  }

  // Test 3: Invalid quantity
  console.log('\n📋 Test 3: Invalid quantity (should return 400)');
  console.log('-'.repeat(60));
  try {
    const response = await makeRequest('/api/installments/validate-coupon', {
      couponCode: 'SAVE20',
      productId: 'PROD001',
      quantity: 15, // Invalid: > 10
      totalDays: 100,
      dailyAmount: 100
    });

    console.log('Status Code:', response.statusCode);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 400) {
      console.log('✅ Test 3 Passed: Quantity validation working');
    } else {
      console.log('❌ Test 3 Failed: Should return 400 for invalid quantity');
    }
  } catch (error) {
    console.log('❌ Test 3 Failed:', error.message);
  }

  // Test 4: With variant
  console.log('\n📋 Test 4: Request with product variant');
  console.log('-'.repeat(60));
  try {
    const response = await makeRequest('/api/installments/validate-coupon', {
      couponCode: 'FREEDAYS10',
      productId: 'PROD001',
      variantId: 'VAR001',
      quantity: 2,
      totalDays: 100,
      dailyAmount: 150
    });

    console.log('Status Code:', response.statusCode);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 || response.statusCode === 404) {
      console.log('✅ Test 4 Passed: Variant support working');
    } else {
      console.log('⚠️  Test 4: Unexpected response');
    }
  } catch (error) {
    console.log('❌ Test 4 Failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!\n');
}

// Run tests
runTests().catch(console.error);
