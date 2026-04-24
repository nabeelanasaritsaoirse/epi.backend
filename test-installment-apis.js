/**
 * Test all installment order APIs for the user
 * userId: 6931ad240e5fae0da273804a
 */

const https = require('https');

const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMxYWQyNDBlNWZhZTBkYTI3MzgwNGEiLCJyb2xlIjoidXNlciIsImlhdCI6MTc3MTkyNjU0NywiZXhwIjoxNzcyNTMxMzQ3fQ.wNVUX0TfSV4aY1441aOyH2vW-i78EIoyN1XxkfkeRLI';
const HOST = 'api.epielio.com';

function apiCall(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      path: '/api/installments' + path,
      method: method,
      headers: {
        'Authorization': TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: data.substring(0, 300) }); }
      });
    });

    req.on('error', e => resolve({ status: 0, data: e.message }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ status: 408, data: 'Timeout' }); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function printResult(title, result) {
  console.log('\n' + '='.repeat(60));
  console.log('API: ' + title);
  console.log('Status:', result.status);

  const d = result.data;
  if (typeof d === 'object') {
    if (d.success === false) {
      console.log('SUCCESS: false');
      console.log('Message:', d.message);
    } else if (d.success === true) {
      console.log('SUCCESS: true');
      const data = d.data;
      if (data) {
        // Orders list
        if (data.orders && Array.isArray(data.orders)) {
          console.log('Total Orders:', data.orders.length);
          console.log('Pagination:', JSON.stringify(data.pagination || {}));
          data.orders.forEach((o, i) => {
            console.log(`  [${i+1}] orderId: ${o.orderId} | status: ${o.status} | product: ${o.productName} | totalAmount: ${o.totalAmount}`);
          });
        }
        // Stats
        else if (data.totalOrders !== undefined) {
          console.log('Stats:', JSON.stringify(data));
        }
        // Overall status
        else if (data.totalInvestment !== undefined || data.summary !== undefined) {
          console.log('Overall:', JSON.stringify(data).substring(0, 500));
        }
        // Dashboard overview
        else if (data.activeOrders !== undefined || data.overview !== undefined) {
          console.log('Dashboard:', JSON.stringify(data).substring(0, 600));
        }
        // Payments list
        else if (data.payments && Array.isArray(data.payments)) {
          console.log('Total Payments:', data.payments.length);
          data.payments.slice(0, 3).forEach((p, i) => {
            console.log(`  [${i+1}] ${p._id} | amount: ${p.amount} | status: ${p.status} | date: ${p.dueDate || p.paidAt}`);
          });
        }
        // Autopay settings/status
        else if (data.settings !== undefined || data.enabled !== undefined || data.autopaySettings !== undefined) {
          console.log('Autopay:', JSON.stringify(data).substring(0, 400));
        }
        // Daily pending
        else if (data.pendingPayments !== undefined || data.daily !== undefined) {
          console.log('Daily Pending:', JSON.stringify(data).substring(0, 400));
        }
        // Generic
        else {
          console.log('Data:', JSON.stringify(data).substring(0, 500));
        }
      }
    } else {
      console.log('Response:', JSON.stringify(d).substring(0, 400));
    }
  } else {
    console.log('Response:', String(d).substring(0, 300));
  }
}

async function runTests() {
  console.log('Starting Installment API Tests...');
  console.log('Base URL: https://' + HOST + '/api/installments');
  console.log('User ID: 6931ad240e5fae0da273804a');

  // 1. Get all user orders
  let r = await apiCall('/orders');
  printResult('GET /orders (All user orders)', r);

  // 2. Get order stats
  r = await apiCall('/orders/stats');
  printResult('GET /orders/stats', r);

  // 3. Get overall investment status
  r = await apiCall('/orders/overall-status');
  printResult('GET /orders/overall-status', r);

  // 4. Get dashboard overview
  r = await apiCall('/dashboard/overview');
  printResult('GET /dashboard/overview', r);

  // 5. Get my payments
  r = await apiCall('/payments/my-payments');
  printResult('GET /payments/my-payments', r);

  // 6. Get payment stats
  r = await apiCall('/payments/stats');
  printResult('GET /payments/stats', r);

  // 7. Get daily pending payments
  r = await apiCall('/payments/daily-pending');
  printResult('GET /payments/daily-pending', r);

  // 8. Autopay settings
  r = await apiCall('/autopay/settings');
  printResult('GET /autopay/settings', r);

  // 9. Autopay status
  r = await apiCall('/autopay/status');
  printResult('GET /autopay/status', r);

  // 10. Autopay dashboard
  r = await apiCall('/autopay/dashboard');
  printResult('GET /autopay/dashboard', r);

  // 11. Autopay history
  r = await apiCall('/autopay/history');
  printResult('GET /autopay/history', r);

  // 12. Autopay streak
  r = await apiCall('/autopay/streak');
  printResult('GET /autopay/streak', r);

  // 13. Bulk orders
  r = await apiCall('/orders/my-bulk-orders');
  printResult('GET /orders/my-bulk-orders', r);

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed!');
}

runTests().catch(console.error);
