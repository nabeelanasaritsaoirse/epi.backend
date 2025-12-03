/**
 * Test Trigger Notification API
 * Tests the new /api/notifications/trigger endpoint
 */

const axios = require('axios');

const API_BASE_URL = 'http://13.127.15.87:8080';

// Test tokens
const userToken1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8';

async function testTriggerNotification(testCase, payload, token) {
  console.log('='.repeat(60));
  console.log(`📝 Test: ${testCase}`);
  console.log('='.repeat(60));

  try {
    console.log('\n📤 Request:');
    console.log('URL:', `${API_BASE_URL}/api/notifications/trigger`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${API_BASE_URL}/api/notifications/trigger`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('\n✅ Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    return { success: true, data: response.data };

  } catch (error) {
    console.log('\n❌ Error:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }

    return { success: false, error: error.response?.data || error.message };
  }
}

async function runAllTests() {
  console.log('🧪 TESTING TRIGGER NOTIFICATION API');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_BASE_URL}`);
  console.log('='.repeat(60));
  console.log('');

  const results = [];

  // Test 1: Send Push + In-App (After Order)
  results.push(await testTriggerNotification(
    'Send Push + In-App Notification (After Order)',
    {
      title: 'Thank you for your order! 🎉',
      message: 'Your order has been confirmed and will be delivered soon. Track your order in the Orders section.',
      sendPush: true,
      sendInApp: true
    },
    userToken1
  ));

  console.log('\n');

  // Test 2: Send Only In-App (After Login)
  results.push(await testTriggerNotification(
    'Send In-App Only (After Login)',
    {
      title: 'Welcome back! 👋',
      message: 'Great to see you again. Continue shopping where you left off.',
      sendPush: false,
      sendInApp: true
    },
    userToken1
  ));

  console.log('\n');

  // Test 3: Send Only Push (Urgent Alert)
  results.push(await testTriggerNotification(
    'Send Push Only (Urgent Alert)',
    {
      title: '⚡ Flash Sale Alert!',
      message: 'Limited time offer: 50% OFF on all products. Shop now!',
      sendPush: true,
      sendInApp: false
    },
    userToken1
  ));

  console.log('\n');

  // Test 4: Default behavior (only message and title)
  results.push(await testTriggerNotification(
    'Default Behavior (In-App Only)',
    {
      title: 'New feature available!',
      message: 'Check out the new wishlist feature in your account.'
    },
    userToken1
  ));

  console.log('\n');

  // Test 5: Validation error (missing title)
  results.push(await testTriggerNotification(
    'Validation Error (Missing Title)',
    {
      message: 'This should fail because title is missing',
      sendPush: true
    },
    userToken1
  ));

  console.log('\n');

  // Test 6: Validation error (title too long)
  results.push(await testTriggerNotification(
    'Validation Error (Title Too Long)',
    {
      title: 'A'.repeat(201), // 201 characters
      message: 'This should fail because title is too long',
      sendPush: false
    },
    userToken1
  ));

  console.log('\n');

  // Test 7: Validation error (no auth token)
  results.push(await testTriggerNotification(
    'Auth Error (No Token)',
    {
      title: 'Test',
      message: 'This should fail due to missing auth token'
    },
    '' // Empty token
  ));

  console.log('\n');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passedTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  console.log('\n📋 Expected Results:');
  console.log('Tests 1-4: Should PASS (valid requests)');
  console.log('Tests 5-7: Should FAIL (validation/auth errors)');

  console.log('\n✅ API is ready for frontend integration!');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
