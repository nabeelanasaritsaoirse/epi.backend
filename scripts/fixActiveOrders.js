const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// The 3 ACTIVE orders that need to be COMPLETED
const ORDER_IDS = [
  '698ad0c698104dd8464e0148',
  '698ad0c698104dd8464e015d',
  '698ad0c798104dd8464e016b'
];

async function main() {
  try {
    console.log('=== FIXING ACTIVE ORDERS ===\n');

    // Admin login
    const loginRes = await axios.post(`${BASE_URL}/api/admin-auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const ADMIN_TOKEN = loginRes.data.data.accessToken;
    console.log('✅ Admin logged in\n');

    // Mark all payments as paid for each order
    for (let i = 0; i < ORDER_IDS.length; i++) {
      const orderId = ORDER_IDS[i];
      console.log(`[${i + 1}/3] Fixing order ${orderId}...`);

      try {
        const res = await axios.post(
          `${BASE_URL}/api/installments/admin/orders/${orderId}/mark-all-paid`,
          { note: 'Fixing ACTIVE order to COMPLETED' },
          { headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` } }
        );

        if (res.data.success) {
          console.log('   ✅ Marked all payments as PAID (Status: COMPLETED)\n');
        } else {
          console.log('   ❌ Failed:', res.data.message, '\n');
        }
      } catch (error) {
        console.log('   ❌ Error:', error.response?.data?.message || error.message, '\n');
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('=== DONE ===');
    console.log('All 9 orders should now be COMPLETED!');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
