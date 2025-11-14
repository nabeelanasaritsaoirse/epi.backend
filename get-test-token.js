// Generate Firebase custom token for testing
// Run: node get-test-token.js <email>

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (firebasePrivateKey) {
    firebasePrivateKey = firebasePrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  }

  if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
    const serviceAccount = {
      project_id: firebaseProjectId,
      client_email: firebaseClientEmail,
      private_key: firebasePrivateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully\n');
  } else {
    console.error('❌ Missing Firebase credentials in .env file');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
  process.exit(1);
}

async function getTestToken(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);

    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log(`✅ Found user: ${user.uid}\n`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️  User not found. Creating new test user...\n');

        user = await admin.auth().createUser({
          email: email,
          password: 'Test@123456',
          displayName: 'Test User',
          emailVerified: true
        });

        console.log(`✅ User created successfully!`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: Test@123456\n`);
      } else {
        throw error;
      }
    }

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(user.uid);

    console.log('🔐 Custom Token Generated:\n');
    console.log(customToken);
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 To get ID Token for API testing:');
    console.log('\n1. Use this cURL command:\n');

    const curlCommand = `curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=YOUR_FIREBASE_WEB_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"token":"${customToken}","returnSecureToken":true}'`;

    console.log(curlCommand);

    console.log('\n\n2. Or use this fetch code in browser console:\n');
    console.log(`fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=YOUR_FIREBASE_WEB_API_KEY', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: '${customToken}',
    returnSecureToken: true
  })
})
.then(res => res.json())
.then(data => console.log('ID Token:', data.idToken));`);

    console.log('\n\n3. Response will contain "idToken" - use that to call your login API:');
    console.log('\nPOST http://localhost:5000/api/auth/login');
    console.log('Content-Type: application/json\n');
    console.log('{\n  "idToken": "<the-id-token-from-above>"\n}');
    console.log('\n' + '='.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Get email from command line or use default
const testEmail = process.argv[2] || 'test@example.com';

console.log('🚀 Firebase Test Token Generator');
console.log('='.repeat(80) + '\n');

getTestToken(testEmail);
