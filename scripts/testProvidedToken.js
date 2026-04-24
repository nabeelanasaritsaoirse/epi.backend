const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTc0N2QwZWQyZTlkMTI1YmFhZjQ4M2MiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MDcwNTU3NSwiZXhwIjoxNzcxMzEwMzc1fQ.feZD7-Myhkt-ZQpgtKoD3HBaVKICmXIP9fgHAXikhcY';

async function main() {
  try {
    console.log('Testing API with provided token...\n');

    const res = await axios.get(`${BASE_URL}/api/installments/orders`, {
      headers: { 'Authorization': `Bearer ${USER_TOKEN}` },
      params: { status: 'COMPLETED', limit: 10 }
    });

    console.log('✅ Status:', res.status);
    console.log('✅ Success:', res.data.success);
    console.log('✅ Orders Count:', res.data.data.count);
    console.log('✅ Orders:', res.data.data.orders.length);

    if (res.data.data.orders.length > 0) {
      console.log('\n📦 COMPLETED Orders:\n');
      res.data.data.orders.forEach((o, i) => {
        console.log(`${i + 1}. ${o.productName}`);
        console.log(`   Order ID: ${o.orderId}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   Delivery: ${o.deliveryStatus}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No COMPLETED orders found for this user');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

main();
