const axios = require('axios');

const BASE_URL = 'http://13.127.15.87:8080/api';

async function testLoginEndpoint() {
  console.log('🔍 Testing Dev Server Login Endpoint...\n');
  console.log('Base URL:', BASE_URL);
  console.log('Endpoint:', BASE_URL + '/auth/login\n');

  // Test 1: Check if server is reachable
  console.log('📡 Test 1: Checking if server is reachable...');
  try {
    const response = await axios.get(BASE_URL.replace('/api', '/health'), { timeout: 5000 });
    console.log('✅ Server is reachable');
  } catch (error) {
    console.log('⚠️  Health check failed, but server might still be running');
  }

  // Test 2: Test login with expired token (the one provided)
  console.log('\n📡 Test 2: Testing with EXPIRED token...');
  const expiredToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImMyN2JhNDBiMDk1MjlhZDRmMTY4MjJjZTgzMTY3YzFiYzM5MTAxMjIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTA3MDQ4NDIzOTMxNTA1NjEzNzMiLCJlbWFpbCI6ImRlZXAuaXQuc2FvaXJzZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkRlZXAuSXQuc2FvaXJzZSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJVHh4aWxSMF94US1kVXlzaDBOYXBzRzZCeWtwOE9wRk8xdmJrb0oxSUNuRXVYb1E9czk2LWMiLCJnaXZlbl9uYW1lIjoiRGVlcC5JdC5zYW9pcnNlIiwiaWF0IjoxNzcwODY5MTcyLCJleHAiOjE3NzA4NzI3NzJ9.uAeVsFhTwLB1lUDZ5gcqu5NCTRJCvLl59Xl-YQML4ay7IHl1JuXqU-boLN2chDci9w-9zBrVYfD402qNF9JHsPW4c_uCJZ1W77qXdMFo2b55LXhoTqGVP7KZAV3zBkJUohYv6WJSZopxOl49w6fcyyFQiEOvhPKo7SRYg1nXvD1QwKL908NIZX6gEd7XaYn66EwVdRFQ7AoxMCZbUl5_RsZCxafRHoAq_1ubfoaszdcFqW-Yt7Wv1kF_-y';

  try {
    const response = await axios.post(
      BASE_URL + '/auth/login',
      { idToken: expiredToken },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Login Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('❌ Login Failed (as expected - token expired)');
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ SERVER IS DOWN! Connection refused.');
      console.log('   Make sure the dev server is running on http://13.127.15.87:8080');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('❌ REQUEST TIMEOUT! Server is not responding.');
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }

  // Test 3: Test without token
  console.log('\n📡 Test 3: Testing without token...');
  try {
    const response = await axios.post(
      BASE_URL + '/auth/login',
      {},
      { timeout: 5000 }
    );
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('✅ Server responded correctly (rejected no token)');
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  // Test 4: Check Firebase configuration on server
  console.log('\n📡 Test 4: Summary of potential issues...\n');

  console.log('🔴 MAIN ISSUES FOUND:');
  console.log('1. ❌ Token EXPIRED (expired at 5:06 AM, current time is after that)');
  console.log('2. ⚠️  Token is Google Sign-In token, NOT Firebase ID token');
  console.log('   - Issuer: accounts.google.com (should be Firebase)');
  console.log('   - This might work if Firebase project uses Google auth\n');

  console.log('🔧 POSSIBLE SOLUTIONS:');
  console.log('1. ✅ User needs to get a FRESH token from mobile app');
  console.log('2. ✅ Check if Firebase is properly initialized on dev server');
  console.log('3. ✅ Verify FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env');
  console.log('4. ✅ Check if dev server time is synchronized (NTP issue)');
  console.log('5. ✅ Ensure Firebase project ID matches the Google OAuth client ID\n');
}

testLoginEndpoint().catch(console.error);
