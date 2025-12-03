/**
 * Quick Live API Test
 * Tests if the receipt fix is working on production
 */

const https = require('https');

// REPLACE THIS WITH YOUR ACTUAL JWT TOKEN
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE';

if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.log('❌ Please set JWT_TOKEN in the script first!');
  console.log('Get your token by logging in to the app');
  process.exit(1);
}

console.log('🚀 Testing Live API: https://api.epielio.com');
console.log('━'.repeat(50));

const postData = JSON.stringify({ amount: 100 });

const options = {
  hostname: 'api.epielio.com',
  port: 443,
  path: '/api/wallet/add-money',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Length': postData.length
  }
};

const req = https.request(options, (res) => {
  let body = '';

  console.log(`Status Code: ${res.statusCode}`);
  console.log('');

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log('Response:');
      console.log(JSON.stringify(response, null, 2));
      console.log('');
      console.log('━'.repeat(50));

      if (response.success && response.order_id) {
        console.log('✅ SUCCESS! Add Money API is working!');
        console.log(`Order ID: ${response.order_id}`);
        console.log(`Amount: ₹${response.amount / 100}`);
        console.log(`Transaction ID: ${response.transaction_id}`);
        console.log('');
        console.log('✅ Receipt fix is deployed correctly!');
      } else if (response.message === 'Server error') {
        console.log('❌ FAILED! Still getting server error');
        console.log('');
        console.log('Possible issues:');
        console.log('1. Code not deployed yet (run: git pull origin nishant)');
        console.log('2. PM2 not restarted (run: pm2 restart epi-backend)');
        console.log('3. Old receipt code still active');
        console.log('');
        console.log('Check PM2 logs: pm2 logs epi-backend --err --lines 50');
      } else {
        console.log('⚠️  Unexpected response');
        console.log('Error:', response.message || 'Unknown error');
      }
    } catch (e) {
      console.log('❌ Failed to parse response');
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();
