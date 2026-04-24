const BASE_URL = 'http://13.127.15.87:8080/api';
const ADMIN_EMAIL = 'admin@epi.com';
const ADMIN_PASSWORD = '@Saoirse123';

// Decode JWT token
function decodeJWT(token) {
  const base64Payload = token.split('.')[1];
  const payload = Buffer.from(base64Payload, 'base64').toString();
  return JSON.parse(payload);
}

async function findUser() {
  try {
    const idToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImMyN2JhNDBiMDk1MjlhZDRmMTY4MjJjZTgzMTY3YzFiYzM5MTAxMjIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTA3MDQ4NDIzOTMxNTA1NjEzNzMiLCJlbWFpbCI6ImRlZXAuaXQuc2FvaXJzZUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IkRlZXAuSXQuc2FvaXJzZSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJVHh4aWxSMF94US1kVXlzaDBOYXBzRzZCeWtwOE9wRk8xdmJrb0oxSUNuRXVYb1E9czk2LWMiLCJnaXZlbl9uYW1lIjoiRGVlcC5JdC5zYW9pcnNlIiwiaWF0IjoxNzcwODY5MTcyLCJleHAiOjE3NzA4NzI3NzJ9.uAeVsFhTwLB1lUDZ5gcqu5NCTRJCvLl59Xl-YQML4ay7IHl1JuXqU-boLN2chDci9w-9zBrVYfD402qNF9JHsPW4c_uCJZ1W77qXdMFo2b55LXhoTqGVP7KZAV3zBkJUohYv6WJSZopxOl49w6fcyyFQiEOvhPKo7SRYg1nXvD1QwKL908NIZX6gEd7XaYn66EwVdRFQ7AoxMCZbUl5_RsZCxafRHoAq_1ubfoaszdcFqW-Yt7Wv1kF_-y';

    console.log('=== DECODING FIREBASE TOKEN ===');
    const decoded = decodeJWT(idToken);
    console.log('Firebase UID (sub):', decoded.sub);
    console.log('Email:', decoded.email);
    console.log('Name:', decoded.name);
    console.log('Token issued at:', new Date(decoded.iat * 1000).toISOString());
    console.log('Token expires at:', new Date(decoded.exp * 1000).toISOString());
    console.log('Is expired?', Date.now() > decoded.exp * 1000 ? 'YES - TOKEN EXPIRED!' : 'No');

    const firebaseUid = decoded.sub;

    // Login as admin
    console.log('\n=== LOGGING IN AS ADMIN ===');
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.data.accessToken;
    console.log('✅ Admin logged in\n');

    // Get all users and search for this firebaseUid
    console.log('=== SEARCHING FOR USER BY FIREBASE UID ===');
    console.log(`Looking for firebaseUid: ${firebaseUid}\n`);

    const salesRes = await fetch(`${BASE_URL}/sales/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const salesData = await salesRes.json();
    const allUsers = salesData.data?.users || salesData.users || [];

    console.log(`Total users in system: ${allUsers.length}`);

    // Find users with this email
    const usersWithEmail = allUsers.filter(u => u.email === decoded.email);
    console.log(`\nUsers with email "${decoded.email}": ${usersWithEmail.length}`);

    if (usersWithEmail.length > 0) {
      usersWithEmail.forEach((user, idx) => {
        console.log(`\n--- User #${idx + 1} ---`);
        console.log('User ID:', user._id || user.userId);
        console.log('Name:', user.name);
        console.log('Email:', user.email);
        console.log('FirebaseUid:', user.firebaseUid || 'NOT SET');
        console.log('deletionRequest:', user.deletionRequest || 'NULL');
        if (user.deletionRequest) {
          console.log('  └─ status:', user.deletionRequest.status);
          console.log('  └─ requestedAt:', user.deletionRequest.requestedAt);
        }
      });
    }

    // Now try to cancel deletion using the firebaseUid to find the user
    console.log('\n=== TRYING TO CANCEL FOR USERS WITH THIS EMAIL ===');
    for (const user of usersWithEmail) {
      const userId = user._id || user.userId;
      console.log(`\nCancelling for user ID: ${userId}`);

      const cancelRes = await fetch(`${BASE_URL}/users/admin/${userId}/cancel-deletion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      const cancelData = await cancelRes.json();
      console.log('Result:', cancelData.success ? '✅ SUCCESS' : '❌ FAILED');
      console.log('Message:', cancelData.message);
    }

    // Try login again
    console.log('\n=== TESTING LOGIN AGAIN ===');
    const authRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const authData = await authRes.json();
    console.log('Login result:', authData.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Response:', JSON.stringify(authData, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findUser();
