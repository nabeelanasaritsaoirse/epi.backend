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

// Ensure Firebase initializes only once
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });

      console.log('✅ Firebase Admin SDK initialized successfully');
    } else {
      console.warn('⚠️  Firebase Admin SDK NOT initialized');
      console.warn('⚠️  Push notifications will be disabled');
      console.warn('⚠️  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }
  } catch (error) {
    console.warn('⚠️  Firebase Admin SDK initialization failed');
    console.warn(`   Error: ${error.message}`);
  }
}

module.exports = { admin };
