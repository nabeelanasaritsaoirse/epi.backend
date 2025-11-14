// Generate Firebase custom token for testing
// Run: node get-custom-token.js <email>

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

  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: firebaseProjectId,
      client_email: firebaseClientEmail,
      private_key: firebasePrivateKey,
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

async function generateCustomToken(email) {
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
        console.log(`✅ User created: ${user.uid}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: Test@123456\n`);
      } else {
        throw error;
      }
    }

    // Generate custom token
    const customToken = await admin.auth().createCustomToken(user.uid);

    console.log('=' .repeat(80));
    console.log('\n🔐 CUSTOM TOKEN:\n');
    console.log(customToken);
    console.log('\n' + '=' .repeat(80));
    console.log('\n📝 How to use this token:\n');
    console.log('1. In your mobile app/frontend, use Firebase signInWithCustomToken():');
    console.log('\n   JavaScript/React Native:');
    console.log('   -------------------------');
    console.log('   import { getAuth, signInWithCustomToken } from "firebase/auth";');
    console.log('   ');
    console.log('   const auth = getAuth();');
    console.log(`   signInWithCustomToken(auth, "${customToken}")`);
    console.log('     .then((userCredential) => {');
    console.log('       // Get ID token');
    console.log('       return userCredential.user.getIdToken();');
    console.log('     })');
    console.log('     .then((idToken) => {');
    console.log('       // Use this idToken to call your login API');
    console.log('       console.log("ID Token:", idToken);');
    console.log('     });');
    console.log('\n2. Then use the ID token to call your login endpoint:');
    console.log('\n   POST http://localhost:5000/api/auth/login');
    console.log('   Content-Type: application/json');
    console.log('   ');
    console.log('   {');
    console.log('     "idToken": "<id-token-from-above>"');
    console.log('   }');
    console.log('\n' + '=' .repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'test@example.com';
console.log('🚀 Firebase Custom Token Generator');
console.log('=' .repeat(80) + '\n');

generateCustomToken(email);
