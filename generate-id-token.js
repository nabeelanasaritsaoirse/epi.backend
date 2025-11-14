// Generate Firebase ID Token directly using Admin SDK
// Run: node generate-id-token.js <email>

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin
try {
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (firebasePrivateKey) {
    firebasePrivateKey = firebasePrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }

  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        project_id: firebaseProjectId,
        client_email: firebaseClientEmail,
        private_key: firebasePrivateKey,
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

async function generateAndTestToken(email) {
  try {
    console.log(`🔍 Looking for user: ${email}`);

    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log(`✅ User found: ${user.uid}\n`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('Creating new user...\n');
        user = await admin.auth().createUser({
          email: email,
          password: 'Test@123456',
          displayName: 'Test User',
          emailVerified: true
        });
        console.log(`✅ User created: ${user.uid}\n`);
      } else {
        throw error;
      }
    }

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(user.uid);
    console.log('🔐 Custom Token:', customToken.substring(0, 50) + '...\n');

    // Get Firebase Web API Key from env or prompt user
    const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;

    if (!firebaseApiKey) {
      console.log('⚠️  FIREBASE_WEB_API_KEY not found in .env file\n');
      console.log('To get your Firebase Web API Key:');
      console.log('1. Go to: https://console.firebase.google.com/');
      console.log('2. Select your project: saoirse-epi');
      console.log('3. Go to Project Settings → General');
      console.log('4. Copy the "Web API Key"');
      console.log('5. Add it to your .env file: FIREBASE_WEB_API_KEY=your-key\n');
      console.log('Then run this script again.\n');
      process.exit(1);
    }

    console.log('🔄 Exchanging custom token for ID token...\n');

    // Exchange custom token for ID token
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        token: customToken,
        returnSecureToken: true
      }
    );

    const idToken = response.data.idToken;
    const refreshToken = response.data.refreshToken;

    console.log('✅ ID Token Generated!\n');
    console.log('=' .repeat(80));
    console.log('\n🔑 ID TOKEN (use this for API testing):\n');
    console.log(idToken);
    console.log('\n' + '=' .repeat(80));
    console.log('\n📝 Now test your login API:\n');
    console.log('POST http://localhost:5000/api/auth/login');
    console.log('Content-Type: application/json\n');
    console.log(JSON.stringify({ idToken }, null, 2));
    console.log('\n' + '=' .repeat(80));
    console.log('\n🧪 Testing login endpoint...\n');

    // Test the login endpoint
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        idToken: idToken
      });

      console.log('✅ LOGIN SUCCESSFUL!\n');
      console.log('Response:');
      console.log(JSON.stringify(loginResponse.data, null, 2));
      console.log('\n' + '=' .repeat(80));
    } catch (loginError) {
      console.log('❌ Login failed:');
      if (loginError.response) {
        console.log(JSON.stringify(loginError.response.data, null, 2));
      } else {
        console.log(loginError.message);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

const email = process.argv[2] || 'test@example.com';
console.log('🚀 Firebase ID Token Generator & Login Tester');
console.log('=' .repeat(80) + '\n');

generateAndTestToken(email);
