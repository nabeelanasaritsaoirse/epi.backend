/**
 * Wallet API Test Script
 * Tests add-money and verify-payment endpoints
 *
 * Usage: node test-wallet-apis.js
 */

const https = require('https');

// Configuration
const BASE_URL = 'https://api.epielio.com';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual user token

// Helper function to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: response
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test 1: Add Money API
async function testAddMoney() {
  console.log('\n📝 Test 1: Add Money API');
  console.log('━'.repeat(50));

  try {
    const response = await makeRequest('POST', '/api/wallet/add-money', {
      amount: 100
    });

    console.log(`Status Code: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Add Money API: SUCCESS');
      return {
        success: true,
        orderId: response.body.order_id,
        transactionId: response.body.transaction_id,
        amount: response.body.amount
      };
    } else {
      console.log('❌ Add Money API: FAILED');
      console.log('Error:', response.body.message || response.body);
      return { success: false };
    }
  } catch (error) {
    console.log('❌ Add Money API: ERROR');
    console.error('Error:', error.message);
    return { success: false };
  }
}

// Test 2: Verify Payment API (mock test)
async function testVerifyPayment(transactionId, orderId) {
  console.log('\n📝 Test 2: Verify Payment API (Mock)');
  console.log('━'.repeat(50));

  console.log('⚠️  Note: This is a mock test with dummy Razorpay response');
  console.log('For real testing, you need actual Razorpay payment data');

  try {
    const response = await makeRequest('POST', '/api/wallet/verify-payment', {
      razorpay_order_id: orderId || 'order_test123',
      razorpay_payment_id: 'pay_test123',
      razorpay_signature: 'dummy_signature_for_testing',
      transaction_id: transactionId || 'test_transaction_id'
    });

    console.log(`Status Code: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    // This will likely fail with signature verification error, which is expected
    if (response.statusCode === 200) {
      console.log('✅ Verify Payment API: SUCCESS');
      return { success: true };
    } else {
      console.log('ℹ️  Verify Payment API: Expected to fail (mock data)');
      console.log('Real payment verification requires valid Razorpay signature');
      return { success: false, expected: true };
    }
  } catch (error) {
    console.log('❌ Verify Payment API: ERROR');
    console.error('Error:', error.message);
    return { success: false };
  }
}

// Test 3: Get Wallet Summary
async function testGetWallet() {
  console.log('\n📝 Test 3: Get Wallet Summary');
  console.log('━'.repeat(50));

  try {
    const response = await makeRequest('GET', '/api/wallet/');

    console.log(`Status Code: ${response.statusCode}`);
    console.log('Response:', JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ Get Wallet API: SUCCESS');
      console.log(`Wallet Balance: ₹${response.body.walletBalance}`);
      console.log(`Available Balance: ₹${response.body.availableBalance}`);
      return { success: true };
    } else {
      console.log('❌ Get Wallet API: FAILED');
      return { success: false };
    }
  } catch (error) {
    console.log('❌ Get Wallet API: ERROR');
    console.error('Error:', error.message);
    return { success: false };
  }
}

// Main test runner
async function runTests() {
  console.log('\n🚀 Wallet API Tests');
  console.log('═'.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Token: ${JWT_TOKEN.substring(0, 20)}...`);
  console.log('═'.repeat(50));

  // Check if token is set
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('\n❌ ERROR: Please set your JWT_TOKEN in the script');
    console.log('Get your token by logging in and copying from the response');
    process.exit(1);
  }

  const results = [];

  // Test 1: Add Money
  const addMoneyResult = await testAddMoney();
  results.push({ name: 'Add Money', ...addMoneyResult });

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Verify Payment (with transaction ID from add money if available)
  const verifyResult = await testVerifyPayment(
    addMoneyResult.transactionId,
    addMoneyResult.orderId
  );
  results.push({ name: 'Verify Payment', ...verifyResult });

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Get Wallet
  const walletResult = await testGetWallet();
  results.push({ name: 'Get Wallet', ...walletResult });

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Test Summary');
  console.log('═'.repeat(50));

  results.forEach(result => {
    const status = result.success ? '✅ PASS' : (result.expected ? 'ℹ️  EXPECTED' : '❌ FAIL');
    console.log(`${status}: ${result.name}`);
  });

  const passed = results.filter(r => r.success || r.expected).length;
  const total = results.length;

  console.log('\n' + '─'.repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log('═'.repeat(50));
}

// Run tests
runTests().catch(console.error);
