const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

async function verify() {
  try {
    // 1. Login as admin
    console.log('1. Logging in as admin...');
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data.accessToken;
    console.log('✅ Admin logged in\n');

    const userId = '6953ba1dad6010200641a51a';

    // 2. Try to get user details from different endpoints
    console.log('2. Checking user from different API endpoints...\n');

    // Try sales API
    console.log('--- Sales API ---');
    const salesRes = await fetch(`${BASE_URL}/sales/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const salesData = await salesRes.json();
    const userFromSales = salesData.data?.users?.find(u => u._id === userId || u.userId === userId);
    if (userFromSales) {
      console.log('Found in sales API');
      console.log('deletionRequest:', userFromSales.deletionRequest || 'UNDEFINED/NULL');
      console.log('Full user:', JSON.stringify(userFromSales, null, 2));
    }

    // Try referrals API
    console.log('\n--- Referrals API ---');
    const refRes = await fetch(`${BASE_URL}/admin/referrals/all-users?search=deep.it.saoirse@gmail.com&limit=5`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const refData = await refRes.json();
    const userFromRef = refData.data?.users?.[0];
    if (userFromRef) {
      console.log('Found in referrals API');
      console.log('deletionRequest:', userFromRef.deletionRequest || 'UNDEFINED/NULL');
      console.log('Full user:', JSON.stringify(userFromRef, null, 2));
    }

    // 3. Try to cancel deletion AGAIN to see response
    console.log('\n--- Calling cancel-deletion API again ---');
    const cancelRes = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    const cancelData = await cancelRes.json();
    console.log('Response:', JSON.stringify(cancelData, null, 2));

    // 4. Now try with Firebase token to see what happens
    console.log('\n--- Testing with Firebase ID Token ---');
    const idToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImMyN2JhNDBiMDk1MjlhZDRmMTY4MjJjZTgzMTY3YzFiYzM5MTAxMjIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTA3MDQ4NDIzOTMxNTA1NjEzNzMiLCJlbWFpbCI6ImRlZXAuaXQuc2FvaXJzZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkRlZXAuSXQuc2FvaXJzZSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJVHh4aWxSMF94US1kVXlzaDBOYXBzRzZCeWtwOE9wRk8xdmJrb0oxSUNuRXVYb1E9czk2LWMiLCJnaXZlbl9uYW1lIjoiRGVlcC5JdC5zYW9pcnNlIiwiaWF0IjoxNzcwODY5MTcyLCJleHAiOjE3NzA4NzI3NzJ9.uAeVsFhTwLB1lUDZ5gcqu5NCTRJCvLl59Xl-YQML4ay7IHl1JuXqU-boLN2chDci9w-9zBrVYfD402qNF9JHsPW4c_uCJZ1W77qXdMFo2b55LXhoTqGVP7KZAV3zBkJUohYv6WJSZopxOl49w6fcyyFQiEOvhPKo7SRYg1nXvD1QwKL908NIZX6gEd7XaYn66EwVdRFQ7AoxMCZbUl5_RsZCxafRHoAq_1ubfoaszdcFqW-Yt7Wv1kF_-y';

    const authRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const authData = await authRes.json();
    console.log('Login attempt result:');
    console.log(JSON.stringify(authData, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

verify();
