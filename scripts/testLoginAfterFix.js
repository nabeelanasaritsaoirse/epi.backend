/**
 * Test login after fixing cancel-deletion bug
 */

const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'shubhashri.it.saoirse@gmail.com';
const ADMIN_PASSWORD = 'Shubha@123';
const USER_ID = '6953ba1dad6010200641a51a';
const FRESH_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImMyN2JhNDBiMDk1MjlhZDRmMTY4MjJjZTgzMTY3YzFiYzM5MTAxMjIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTA3MDQ4NDIzOTMxNTA1NjEzNzMiLCJlbWFpbCI6ImRlZXAuaXQuc2FvaXJzZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkRlZXAuSXQuc2FvaXJzZSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJVHh4aWxSMF94US1kVXlzaDBOYXBzRzZCeWtwOE9wRk8xdmJrb0oxSUNuRXVYb1E9czk2LWMiLCJnaXZlbl9uYW1lIjoiRGVlcC5JdC5zYW9pcnNlIiwiaWF0IjoxNzcwODc0NTg0LCJleHAiOjE3NzA4NzgxODR9.K3h4Z9NWgTQYmhTFqINx4eNDBTwwlL7yBlX2QRYdBX08hKvnvG5kRfwaEql42omhNaZRb04sCxdWrjSBp45FxF5GBbnjHt6vrT1mUzpZd9gOVEzit6IqH7hhRcQXzjKa4cV51mOXrL2tOZqzCkmx9bAP_NUnyqHSwiEUZ8eoJdJ7xNW8LxRNFqyjd4suF3ZknJ1cULEx82vjzkQNJdQBRpY0N9zjQmE87nVMRqA4I0JUwFypp54NpZZweF';

async function main() {
  try {
    console.log('🚀 Testing After Fix\n');
    console.log('⚠️  NOTE: Make sure you have RESTARTED the dev server!\n');
    console.log('=' .repeat(60));

    // Step 1: Login as admin
    console.log('\n📍 Step 1: Admin Login...');
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      console.log('❌ Admin login failed:', loginData.message);
      return;
    }
    console.log('✅ Admin logged in');
    const token = loginData.data.accessToken;

    // Step 2: Cancel deletion
    console.log('\n📍 Step 2: Cancelling deletion request...');
    const cancelRes = await fetch(`${BASE_URL}/users/admin/${USER_ID}/cancel-deletion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const cancelData = await cancelRes.json();
    console.log('Response:', cancelData.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', cancelData.message);

    // Step 3: Verify user status
    console.log('\n📍 Step 3: Verifying user status...');
    const userRes = await fetch(`${BASE_URL}/users/${USER_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userData = await userRes.json();

    if (userData.deletionRequest) {
      console.log('Deletion Request Status:', userData.deletionRequest.status);
      console.log('Cancelled At:', userData.deletionRequest.cancelledAt || 'N/A');

      if (userData.deletionRequest.status === 'cancelled') {
        console.log('✅ Status is now CANCELLED!');
      } else {
        console.log('❌ Status is still:', userData.deletionRequest.status);
        console.log('\n⚠️  SERVER WAS NOT RESTARTED! Please restart and try again.');
        return;
      }
    } else {
      console.log('✅ No deletion request found');
    }

    // Step 4: Test user login
    console.log('\n📍 Step 4: Testing user login with Firebase token...');
    const loginUserRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: FRESH_TOKEN })
    });
    const loginUserData = await loginUserRes.json();

    if (loginUserData.success) {
      console.log('\n🎉🎉🎉 SUCCESS! USER CAN LOGIN NOW! 🎉🎉🎉\n');
      console.log('User Details:');
      console.log('  Name:', loginUserData.data.name);
      console.log('  Email:', loginUserData.data.email);
      console.log('  User ID:', loginUserData.data.userId);
      console.log('  ✅ Access Token Generated');
      console.log('  ✅ Refresh Token Generated');
    } else {
      console.log('\n❌ Login still FAILED');
      console.log('Error:', loginUserData.message);
      console.log('Code:', loginUserData.code);

      if (loginUserData.code === 'ACCOUNT_DELETION_PENDING') {
        console.log('\n⚠️  SERVER WAS NOT RESTARTED!');
        console.log('Please restart the dev server and run this script again.');
      }
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();
