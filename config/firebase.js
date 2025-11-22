/**
 * Firebase Admin SDK Configuration
 *
 * Setup Instructions:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate New Private Key" and download JSON
 * 3. Set these environment variables on your server:
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_CLIENT_EMAIL
 *    - FIREBASE_PRIVATE_KEY (make sure to preserve newlines)
 *
 * The app will work without Firebase, but push notifications will be disabled
 */

const admin = require('firebase-admin');

let firebaseInitialized = false;

try {
  // Check if Firebase is already initialized to prevent duplicate initialization
  if (admin.apps.length === 0) {
    // Initialize using environment variables only
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle private key with preserved newlines
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });

      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      throw new Error('Firebase environment variables not set');
    }
  } else {
    // Firebase is already initialized
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK already initialized');
  }

} catch (error) {
  console.warn('⚠️  Firebase Admin SDK NOT initialized');
  console.warn('⚠️  Push notifications will be disabled');
  console.warn('⚠️  To enable push notifications:');
  console.warn('   Set these environment variables:');
  console.warn('   - FIREBASE_PROJECT_ID');
  console.warn('   - FIREBASE_CLIENT_EMAIL');
  console.warn('   - FIREBASE_PRIVATE_KEY');
  console.warn('');
  console.warn(`   Error: ${error.message}`);
}

module.exports = {
  admin,
  firebaseInitialized
};
