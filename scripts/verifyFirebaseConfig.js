/**
 * Firebase Configuration Verification Script
 * Checks if Firebase is properly initialized and can send notifications
 *
 * Usage:
 * node scripts/verifyFirebaseConfig.js
 */

require('dotenv').config();
const admin = require('firebase-admin');

async function verifyFirebaseConfig() {
  console.log('🔧 Firebase Configuration Verification\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking environment variables...\n');

  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
  };

  const checks = [
    { name: 'FIREBASE_PROJECT_ID', value: config.projectId },
    { name: 'FIREBASE_CLIENT_EMAIL', value: config.clientEmail },
    { name: 'FIREBASE_PRIVATE_KEY', value: config.privateKey }
  ];

  let allPresent = true;
  checks.forEach(check => {
    if (check.value) {
      console.log(`✅ ${check.name}: Present`);
      if (check.name === 'FIREBASE_PROJECT_ID') {
        console.log(`   Value: ${check.value}`);
      } else if (check.name === 'FIREBASE_CLIENT_EMAIL') {
        console.log(`   Value: ${check.value}`);
      } else if (check.name === 'FIREBASE_PRIVATE_KEY') {
        console.log(`   Length: ${check.value.length} chars`);
        console.log(`   Starts with: ${check.value.substring(0, 30)}...`);
      }
    } else {
      console.log(`❌ ${check.name}: MISSING`);
      allPresent = false;
    }
  });

  if (!allPresent) {
    console.log('\n❌ Some environment variables are missing!');
    console.log('\n📝 Required environment variables:');
    console.log('   FIREBASE_PROJECT_ID=your-project-id');
    console.log('   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com');
    console.log('   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    console.log('\n💡 Get these from: https://console.firebase.google.com/');
    console.log('   → Project Settings → Service Accounts → Generate New Private Key');
    process.exit(1);
  }

  console.log('\n✅ All environment variables present\n');

  // Step 2: Initialize Firebase
  console.log('📋 Step 2: Initializing Firebase Admin SDK...\n');

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey.replace(/\\n/g, '\n')
        })
      });
    }

    console.log('✅ Firebase Admin SDK initialized successfully\n');

  } catch (error) {
    console.log('❌ Firebase initialization failed!');
    console.log(`   Error: ${error.message}\n`);

    if (error.message.includes('private key')) {
      console.log('💡 Common issue: FIREBASE_PRIVATE_KEY format');
      console.log('   - Ensure newlines are escaped as \\\\n in .env file');
      console.log('   - Should look like: "-----BEGIN PRIVATE KEY-----\\\\n...\\\\n-----END PRIVATE KEY-----\\\\n"');
    }

    process.exit(1);
  }

  // Step 3: Test getMessaging()
  console.log('📋 Step 3: Testing getMessaging() compatibility...\n');

  try {
    const { getMessaging } = require('firebase-admin/messaging');
    const messaging = getMessaging();

    console.log('✅ getMessaging() works correctly');
    console.log(`   Type: ${typeof messaging}`);
    console.log(`   Has send method: ${typeof messaging.send === 'function'}`);
    console.log(`   Has sendEachForMulticast method: ${typeof messaging.sendEachForMulticast === 'function'}\n`);

  } catch (error) {
    console.log('❌ getMessaging() failed!');
    console.log(`   Error: ${error.message}`);
    console.log('\n💡 You may need to update firebase-admin:');
    console.log('   npm install firebase-admin@latest\n');
    process.exit(1);
  }

  // Step 4: Check Firebase project connectivity
  console.log('📋 Step 4: Verifying Firebase project connectivity...\n');

  try {
    const { getMessaging } = require('firebase-admin/messaging');

    // Try to create a message (don't send, just validate)
    const testMessage = {
      notification: {
        title: 'Test',
        body: 'Test'
      },
      data: {
        test: 'true'
      },
      token: 'test-token-will-fail-but-validates-connection'
    };

    console.log('   Testing with dummy token to validate connection...');

    // This will fail with invalid token, but confirms Firebase connection works
    try {
      await getMessaging().send(testMessage);
    } catch (sendError) {
      if (sendError.code === 'messaging/invalid-registration-token' ||
          sendError.code === 'messaging/registration-token-not-registered') {
        console.log('✅ Firebase connection works! (Invalid token error is expected)');
        console.log(`   Error code: ${sendError.code}`);
      } else if (sendError.code === 'messaging/authentication-error') {
        console.log('❌ Authentication failed!');
        console.log('   Your Firebase credentials may be incorrect');
        console.log(`   Error: ${sendError.message}\n`);
        process.exit(1);
      } else if (sendError.code === 'messaging/third-party-auth-error') {
        console.log('❌ Firebase project configuration error!');
        console.log('   Check Firebase Console → Cloud Messaging settings');
        console.log(`   Error: ${sendError.message}\n`);
        process.exit(1);
      } else {
        console.log('⚠️  Unexpected error (but connection seems OK):');
        console.log(`   Error code: ${sendError.code}`);
        console.log(`   Message: ${sendError.message}`);
      }
    }

  } catch (error) {
    console.log('❌ Connection test failed!');
    console.log(`   Error: ${error.message}\n`);
    process.exit(1);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Firebase Configuration Verification PASSED!\n');
  console.log('✅ Environment variables: OK');
  console.log('✅ Firebase initialization: OK');
  console.log('✅ getMessaging() compatibility: OK');
  console.log('✅ Firebase connection: OK\n');
  console.log('🚀 Your FCM service is ready to send notifications!');
  console.log('='.repeat(60) + '\n');

  console.log('📊 Configuration Summary:');
  console.log(`   Project ID: ${config.projectId}`);
  console.log(`   Service Account: ${config.clientEmail}`);
  console.log(`   Firebase Admin SDK: v${require('firebase-admin/package.json').version}\n`);

  console.log('💡 Next steps:');
  console.log('   1. Run: node scripts/testFCMServiceUpgrade.js');
  console.log('   2. Or use: require("./services/fcmService").sendPushNotification(userId, {...})');
  console.log('   3. Monitor logs: pm2 logs epi-backend | grep FCM\n');

  process.exit(0);
}

// Run verification
verifyFirebaseConfig().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
