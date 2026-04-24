/**
 * Cleanup old buggy skip dates and test new implementation
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlYzU2NzkyZDU2NWE1YThmZGQ5YjciLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDc5MDYyNywiZXhwIjoxNzcxMzk1NDI3fQ.fWyHVhynWVVTwq1lmvJE4zasPqF30JOP-4xxrT1NaTI';
const ORDER_ID = 'ORD-20260103-9576';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🧹 Cleanup Old Buggy Skip Dates & Test New Implementation');
  console.log('='.repeat(70));

  try {
    // Step 1: Get current skip dates
    console.log('\n📋 Step 1: Checking current skip dates...');
    const statusRes = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const orders = statusRes.data.data?.orders || [];
    const order = orders.find(o => o.orderId === ORDER_ID);

    if (!order || !order.autopay?.skipDates) {
      console.log('   No skip dates found');
      return;
    }

    const currentDates = order.autopay.skipDates;
    console.log(`   Found ${currentDates.length} skip dates:`);

    // Categorize dates by format
    const oldBuggyDates = [];
    const newCorrectDates = [];

    currentDates.forEach(dateStr => {
      const d = new Date(dateStr);
      const hours = d.getUTCHours();
      const minutes = d.getUTCMinutes();

      const formatted = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC`;

      if (hours === 18 && minutes === 30) {
        oldBuggyDates.push({ raw: dateStr, formatted, isBuggy: true });
        console.log(`   🐛 OLD (buggy): ${formatted}`);
      } else if (hours === 0 && minutes === 0) {
        newCorrectDates.push({ raw: dateStr, formatted, isBuggy: false });
        console.log(`   ✅ NEW (fixed): ${formatted}`);
      } else {
        console.log(`   ⚠️  UNKNOWN: ${formatted}`);
      }
    });

    // Step 2: Delete ALL old buggy dates (they have wrong timezone)
    if (oldBuggyDates.length > 0) {
      console.log(`\n🧹 Step 2: Deleting ${oldBuggyDates.length} old buggy dates...`);

      for (const dateInfo of oldBuggyDates) {
        const d = new Date(dateInfo.raw);
        // The old dates need to be sent in the OLD format for deletion
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

        try {
          await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
            headers,
            data: { date: dateStr }
          });
          console.log(`   ✅ Deleted: ${dateStr}`);
        } catch (error) {
          console.log(`   ❌ Failed to delete: ${dateStr}`);
        }

        await sleep(200);  // Small delay between requests
      }
    }

    // Step 3: Delete ALL new dates too (for clean test)
    if (newCorrectDates.length > 0) {
      console.log(`\n🧹 Step 3: Deleting ${newCorrectDates.length} new dates (for clean test)...`);

      for (const dateInfo of newCorrectDates) {
        const d = new Date(dateInfo.raw);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

        try {
          await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
            headers,
            data: { date: dateStr }
          });
          console.log(`   ✅ Deleted: ${dateStr}`);
        } catch (error) {
          console.log(`   ❌ Failed: ${dateStr}`);
        }

        await sleep(200);
      }
    }

    // Step 4: Verify all deleted
    console.log('\n📋 Step 4: Verifying cleanup...');
    await sleep(1000);

    const verifyRes = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const verifyOrders = verifyRes.data.data?.orders || [];
    const verifyOrder = verifyOrders.find(o => o.orderId === ORDER_ID);

    const remainingCount = verifyOrder.autopay?.skipDates?.length || 0;

    if (remainingCount === 0) {
      console.log('   ✅ All skip dates cleared successfully!');
    } else {
      console.log(`   ⚠️  Still has ${remainingCount} dates`);
      verifyOrder.autopay.skipDates.forEach(d => {
        const date = new Date(d);
        console.log(`      - ${date.toISOString()}`);
      });
    }

    // Step 5: Run NEW tests
    console.log('\n\n🧪 Step 5: Testing NEW Implementation');
    console.log('='.repeat(70));

    // Test 1: Add Feb 15 - should store as Feb 15 at 00:00 UTC
    console.log('\n✅ TEST 1: Add Feb 15 (timezone test)');
    const addRes1 = await axios.post(
      `${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`,
      { dates: ['2026-02-15'] },
      { headers }
    );

    const addedDate = addRes1.data.data.skipDates[0];
    const d = new Date(addedDate);
    console.log(`   Stored as: ${d.toISOString()}`);

    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      console.log('   ✅ PASS: Stored at midnight UTC (Feb 15 stays Feb 15!)');
    } else {
      console.log('   ❌ FAIL: Wrong timezone');
    }

    // Test 2: Fetch and verify persistence
    await sleep(1000);
    console.log('\n✅ TEST 2: Fetch and verify persistence');
    const fetchRes = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const fetchOrders = fetchRes.data.data?.orders || [];
    const fetchOrder = fetchOrders.find(o => o.orderId === ORDER_ID);

    const hasFeb15 = fetchOrder.autopay.skipDates.some(d => {
      const date = new Date(d);
      return date.getUTCFullYear() === 2026 &&
             date.getUTCMonth() === 1 &&
             date.getUTCDate() === 15;
    });

    if (hasFeb15) {
      console.log('   ✅ PASS: Feb 15 persisted correctly');
    } else {
      console.log('   ❌ FAIL: Feb 15 not found');
    }

    // Test 3: Delete Feb 15
    console.log('\n✅ TEST 3: Delete Feb 15 (persistence test)');
    await axios.delete(`${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`, {
      headers,
      data: { date: '2026-02-15' }
    });

    await sleep(1000);

    const deleteVerifyRes = await axios.get(`${BASE_URL}/installments/autopay/status`, { headers });
    const deleteVerifyOrders = deleteVerifyRes.data.data?.orders || [];
    const deleteVerifyOrder = deleteVerifyOrders.find(o => o.orderId === ORDER_ID);

    const stillHasFeb15 = deleteVerifyOrder.autopay.skipDates.some(d => {
      const date = new Date(d);
      return date.getUTCFullYear() === 2026 &&
             date.getUTCMonth() === 1 &&
             date.getUTCDate() === 15;
    });

    if (!stillHasFeb15) {
      console.log('   ✅ PASS: Feb 15 deleted successfully (no ghost date!)');
    } else {
      console.log('   ❌ FAIL: Ghost date - Feb 15 still exists');
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 TESTS COMPLETE!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
  }
}

main();
