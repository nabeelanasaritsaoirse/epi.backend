/**
 * Comprehensive Skip Dates API Test Script
 * Tests both timezone fix and persistence fix on LIVE server
 */

const axios = require('axios');

// LIVE SERVER CONFIG
const BASE_URL = 'http://13.127.15.87:8080/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlYzU2NzkyZDU2NWE1YThmZGQ5YjciLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDc5MDYyNywiZXhwIjoxNzcxMzk1NDI3fQ.fWyHVhynWVVTwq1lmvJE4zasPqF30JOP-4xxrT1NaTI';
const ORDER_ID = 'ORD-20260103-9576';  // Updated to existing order

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

// Helper to print test results
function printResult(testName, passed, details = '') {
  const emoji = passed ? '✅' : '❌';
  console.log(`${emoji} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

// Helper to format date for comparison
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('🚀 Starting Skip Dates API Tests on LIVE Server');
  console.log('='
.repeat(60));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Order ID: ${ORDER_ID}`);
  console.log('='.repeat(60));
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // TEST 0: Clear any existing skip dates first
    console.log('📋 TEST 0: Cleanup - Clear existing skip dates');
    console.log('-'.repeat(60));
    try {
      const statusRes = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
      const orders = statusRes.data.data?.orders || [];
      const testOrder = orders.find(o => o.orderId === ORDER_ID);

      if (testOrder && testOrder.autopay?.skipDates?.length > 0) {
        console.log(`   Found ${testOrder.autopay.skipDates.length} existing skip dates. Clearing...`);
        for (const skipDate of testOrder.autopay.skipDates) {
          const dateStr = formatDate(skipDate);
          await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
            headers,
            data: { date: dateStr }
          });
        }
        console.log('   ✅ Cleared all existing skip dates');
      } else {
        console.log('   ✅ No existing skip dates to clear');
      }
    } catch (error) {
      console.log('   ⚠️  Could not clear existing dates (might not exist)');
    }
    console.log('');

    // TEST 1: Add Skip Dates - Timezone Test (Feb 15 should stay Feb 15)
    console.log('📋 TEST 1: ADD Skip Dates - Timezone Fix Test');
    console.log('-'.repeat(60));

    const testDates = ['2026-02-15', '2026-03-20', '2026-04-10'];
    console.log(`   Adding dates: ${testDates.join(', ')}`);

    const addRes = await axios.post(
      `${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`,
      { dates: testDates },
      { headers }
    );

    if (addRes.data.success) {
      const returnedDates = addRes.data.data.skipDates.map(d => formatDate(d));
      console.log(`   Response dates: ${returnedDates.join(', ')}`);

      // Check if Feb 15 is stored correctly (not Feb 16 or Feb 14)
      const hasFeb15 = returnedDates.includes('2026-02-15');
      const hasFeb16 = returnedDates.includes('2026-02-16');
      const hasFeb14 = returnedDates.includes('2026-02-14');

      if (hasFeb15 && !hasFeb16 && !hasFeb14) {
        printResult('TEST 1a: Feb 15 stored correctly (not shifted)', true);
        testsPassed++;
      } else {
        printResult('TEST 1a: Feb 15 stored correctly', false, `Got: ${returnedDates[0]} (Expected: 2026-02-15)`);
        testsFailed++;
      }

      // Check all 3 dates
      const allCorrect = testDates.every(date => returnedDates.includes(date));
      if (allCorrect) {
        printResult('TEST 1b: All dates stored correctly', true);
        testsPassed++;
      } else {
        printResult('TEST 1b: All dates stored correctly', false, `Expected: ${testDates}, Got: ${returnedDates}`);
        testsFailed++;
      }
    } else {
      printResult('TEST 1: Add dates', false, addRes.data.message);
      testsFailed += 2;
    }
    console.log('');

    // TEST 2: Fetch Skip Dates - Persistence Test
    console.log('📋 TEST 2: FETCH Skip Dates - Persistence Test (Immediate)');
    console.log('-'.repeat(60));

    const fetchRes1 = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders1 = fetchRes1.data.data?.orders || [];
    const order1 = orders1.find(o => o.orderId === ORDER_ID);

    if (order1 && order1.autopay?.skipDates) {
      const fetchedDates = order1.autopay.skipDates.map(d => formatDate(d));
      console.log(`   Fetched dates: ${fetchedDates.join(', ')}`);

      const allPersisted = testDates.every(date => fetchedDates.includes(date));
      if (allPersisted && fetchedDates.length === 3) {
        printResult('TEST 2: Dates persisted immediately', true);
        testsPassed++;
      } else {
        printResult('TEST 2: Dates persisted immediately', false, `Expected 3 dates, got ${fetchedDates.length}`);
        testsFailed++;
      }
    } else {
      printResult('TEST 2: Fetch skip dates', false, 'Order not found or no skip dates');
      testsFailed++;
    }
    console.log('');

    // TEST 3: Wait and Fetch Again - Delayed Persistence Test
    console.log('📋 TEST 3: FETCH Skip Dates - Persistence Test (After 3s delay)');
    console.log('-'.repeat(60));
    console.log('   Waiting 3 seconds...');
    await sleep(3000);

    const fetchRes2 = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders2 = fetchRes2.data.data?.orders || [];
    const order2 = orders2.find(o => o.orderId === ORDER_ID);

    if (order2 && order2.autopay?.skipDates) {
      const fetchedDates2 = order2.autopay.skipDates.map(d => formatDate(d));
      const stillPersisted = testDates.every(date => fetchedDates2.includes(date));

      if (stillPersisted && fetchedDates2.length === 3) {
        printResult('TEST 3: Dates still persisted after delay', true);
        testsPassed++;
      } else {
        printResult('TEST 3: Dates still persisted', false, 'Dates disappeared!');
        testsFailed++;
      }
    } else {
      printResult('TEST 3: Delayed persistence', false, 'Dates disappeared');
      testsFailed++;
    }
    console.log('');

    // TEST 4: Delete One Date - Feb 15
    console.log('📋 TEST 4: DELETE Skip Date - Remove Feb 15');
    console.log('-'.repeat(60));

    const deleteRes = await axios.delete(
      `${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`,
      {
        headers,
        data: { date: '2026-02-15' }
      }
    );

    if (deleteRes.data.success) {
      const remainingDates = deleteRes.data.data.skipDates.map(d => formatDate(d));
      console.log(`   Remaining dates: ${remainingDates.join(', ')}`);

      const feb15Removed = !remainingDates.includes('2026-02-15');
      const othersRemain = remainingDates.includes('2026-03-20') && remainingDates.includes('2026-04-10');

      if (feb15Removed && othersRemain && remainingDates.length === 2) {
        printResult('TEST 4: Feb 15 deleted, others remain', true);
        testsPassed++;
      } else {
        printResult('TEST 4: Delete single date', false, `Expected 2 dates without Feb 15, got: ${remainingDates}`);
        testsFailed++;
      }
    } else {
      printResult('TEST 4: Delete date', false, deleteRes.data.message);
      testsFailed++;
    }
    console.log('');

    // TEST 5: Verify Delete Persisted
    console.log('📋 TEST 5: VERIFY Delete Persisted');
    console.log('-'.repeat(60));

    const fetchRes3 = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders3 = fetchRes3.data.data?.orders || [];
    const order3 = orders3.find(o => o.orderId === ORDER_ID);

    if (order3 && order3.autopay?.skipDates) {
      const currentDates = order3.autopay.skipDates.map(d => formatDate(d));
      console.log(`   Current dates: ${currentDates.join(', ')}`);

      const feb15StillGone = !currentDates.includes('2026-02-15');
      const hasCorrectCount = currentDates.length === 2;

      if (feb15StillGone && hasCorrectCount) {
        printResult('TEST 5: Delete persisted (no ghost date)', true);
        testsPassed++;
      } else {
        printResult('TEST 5: Delete persisted', false, 'Feb 15 reappeared (ghost date bug)!');
        testsFailed++;
      }
    } else {
      printResult('TEST 5: Verify delete', false, 'Could not fetch dates');
      testsFailed++;
    }
    console.log('');

    // TEST 6: Delete Remaining Dates
    console.log('📋 TEST 6: DELETE All Remaining Dates');
    console.log('-'.repeat(60));

    await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
      headers,
      data: { date: '2026-03-20' }
    });

    await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
      headers,
      data: { date: '2026-04-10' }
    });

    const fetchRes4 = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders4 = fetchRes4.data.data?.orders || [];
    const order4 = orders4.find(o => o.orderId === ORDER_ID);

    const isEmpty = !order4.autopay?.skipDates || order4.autopay.skipDates.length === 0;

    if (isEmpty) {
      printResult('TEST 6: All dates deleted successfully', true);
      testsPassed++;
    } else {
      printResult('TEST 6: Delete all dates', false, `Still has ${order4.autopay.skipDates.length} dates`);
      testsFailed++;
    }
    console.log('');

    // TEST 7: Add Duplicate Date Test
    console.log('📋 TEST 7: EDGE CASE - Duplicate Date Prevention');
    console.log('-'.repeat(60));

    await axios.post(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
      dates: ['2026-05-15', '2026-05-20']
    }, { headers });

    // Try to add duplicate
    await axios.post(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
      dates: ['2026-05-15', '2026-05-25']
    }, { headers });

    const fetchRes5 = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders5 = fetchRes5.data.data?.orders || [];
    const order5 = orders5.find(o => o.orderId === ORDER_ID);

    if (order5 && order5.autopay?.skipDates) {
      const uniqueDates = [...new Set(order5.autopay.skipDates.map(d => formatDate(d)))];
      const actualCount = order5.autopay.skipDates.length;

      if (actualCount === uniqueDates.length && actualCount === 3) {
        printResult('TEST 7: Duplicate prevention works', true, '3 unique dates (5/15, 5/20, 5/25)');
        testsPassed++;
      } else {
        printResult('TEST 7: Duplicate prevention', false, `Expected 3 unique, got ${actualCount}`);
        testsFailed++;
      }
    } else {
      printResult('TEST 7: Duplicate test', false);
      testsFailed++;
    }
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ TEST FAILED WITH ERROR:');
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('');
      console.error('⚠️  TOKEN EXPIRED! Please get a new token.');
    }
  }

  // Final Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (testsPassed === 8 && testsFailed === 0) {
    console.log('');
    console.log('🎉 ALL TESTS PASSED! Skip dates are working correctly!');
    console.log('');
    console.log('✅ Timezone bug FIXED - Feb 15 stays as Feb 15');
    console.log('✅ Persistence bug FIXED - Deletes work correctly');
    console.log('✅ No ghost dates - Changes persist immediately');
  } else {
    console.log('');
    console.log('⚠️  Some tests failed. Check the details above.');
  }
}

// Run the tests
runTests().catch(console.error);
