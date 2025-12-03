// Simple test to verify API endpoint is accessible
const http = require('http');

const testData = {
  couponCode: 'SAVE20',
  productId: 'PROD001',
  totalDays: 100,
  dailyAmount: 100,
  quantity: 1
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/installments/validate-coupon',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📡 Testing API endpoint...');
console.log('URL:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('Method:', options.method);
console.log('Body:', testData);
console.log('\n⏳ Sending request...\n');

const req = http.request(options, (res) => {
  let body = '';

  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  console.log('\nResponse Body:');
  console.log('-'.repeat(60));

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      console.log(JSON.stringify(response, null, 2));
      console.log('-'.repeat(60));

      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS: API is working correctly!');
      } else if (res.statusCode === 404) {
        console.log('\n⚠️  Product or Coupon not found (expected in test environment)');
      } else {
        console.log('\n⚠️  Response received with status:', res.statusCode);
      }
    } catch (e) {
      console.log(body);
      console.log('\n❌ Failed to parse JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  console.error('Make sure the server is running on port 3000');
});

req.write(postData);
req.end();
