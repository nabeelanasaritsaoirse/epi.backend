/**
 * Quick Skip Dates Test - Using Existing Order
 */

const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJlYzU2NzkyZDU2NWE1YThmZGQ5YjciLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDc5MDYyNywiZXhwIjoxNzcxMzk1NDI3fQ.fWyHVhynWVVTwq1lmvJE4zasPqF30JOP-4xxrT1NaTI';
const ORDER_ID = 'ORD-20260103-9576';  // This order exists

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

async function quickTest() {
  console.log('🧪 Quick Test: Add March 1st and check timezone');
  console.log('='.repeat(60));

  try {
    // Add March 1, 2026
    console.log('Adding date: 2026-03-01');
    const addRes = await axios.post(
      `${BASE_URL}/installments/autopay/skip-dates/${ORDER_ID}`,
      { dates: ['2026-03-01'] },
      { headers }
    );

    if (addRes.data.success) {
      const dates = addRes.data.data.skipDates;
      const lastDate = dates[dates.length - 1];
      const formatted = formatDate(lastDate);

      console.log('');
      console.log('📅 Result:');
      console.log(`   Stored as: ${formatted}`);
      console.log(`   Raw: ${lastDate}`);
      console.log('');

      // Check if it's midnight UTC (CORRECT) or 18:30 UTC (OLD BUG)
      const d = new Date(lastDate);
      const hours = d.getUTCHours();
      const minutes = d.getUTCMinutes();

      if (hours === 0 && minutes === 0) {
        console.log('✅ TIMEZONE FIX WORKING! Date stored at midnight UTC');
        console.log('   This means the server code is updated!');
      } else if (hours === 18 && minutes === 30) {
        console.log('❌ OLD BUG STILL PRESENT! Date stored at 18:30 UTC');
        console.log('   This means server needs RESTART to load new code!');
      } else {
        console.log(`⚠️  Unexpected time: ${hours}:${minutes} UTC`);
      }
    } else {
      console.log('❌ Failed:', addRes.data.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

quickTest();
