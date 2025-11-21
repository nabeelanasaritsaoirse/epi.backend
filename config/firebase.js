/**
 * Firebase Admin SDK Configuration
 *
 * Setup Instructions:
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Save the JSON file as 'serviceAccountKey.json' in the root directory
 * 4. Never commit this file to version control (add to .gitignore)
 *
 * The app will work without Firebase, but push notifications will be disabled
 */

const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

try {
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  firebaseInitialized = true;
  console.log('✅ Firebase Admin SDK initialized successfully');

} catch (error) {
  console.warn('⚠️  Firebase Admin SDK NOT initialized');
  console.warn('⚠️  Push notifications will be disabled');
  console.warn('⚠️  To enable push notifications:');
  console.warn('   1. Download serviceAccountKey.json from Firebase Console');
  console.warn('   2. Place it in the root directory of this project');
  console.warn('   3. Restart the server');
  console.warn(`   Error: ${error.message}`);
}

module.exports = {
  admin,
  firebaseInitialized
};
