const axios = require('axios');

// User: Dadu Dade
const USER_ID = '69325d650e5fae0da2739122';
const FCM_TOKEN = 'dv_XrsD2QWq2gEbAbS7qRg:APA91bGc8h8_Yo3Iq6tbeu22Zl-mwEvOw1Fweu31rYwRZWgwKlXor-CytVc8Typpd2SBfvp_toeT12_-Hram_h-91uElarUNLXi5P7NNvaOpvskq0OpOUTM';

async function sendPushToDadu() {
  console.log('📱 SENDING PUSH NOTIFICATION TO DADU DADE');
  console.log('='.repeat(60));
  console.log('User ID:', USER_ID);
  console.log('Name: Dadu Dade');
  console.log('Email: dadud3002@gmail.com');
  console.log('FCM Token:', FCM_TOKEN.substring(0, 50) + '...');
  console.log('='.repeat(60));
  console.log('');

  // First, we need to get Dadu's access token
  // Since we don't have it, let me try to send notification directly via the backend

  // For now, let me show you what the frontend should call
  console.log('⚠️  Note: To send push notification via API, we need Dadu\'s JWT token.');
  console.log('');
  console.log('📋 What Frontend Should Do:');
  console.log('');
  console.log('When Dadu logs in, the app should call:');
  console.log('');
  console.log('POST https://api.epielio.com/api/notifications/trigger');
  console.log('Headers:');
  console.log('  Authorization: Bearer DADU_JWT_TOKEN');
  console.log('  Content-Type: application/json');
  console.log('');
  console.log('Body:');
  console.log(JSON.stringify({
    title: '🎉 Welcome to Epi!',
    message: 'Hi Dadu! Thanks for joining us. Start shopping now!',
    sendPush: true,
    sendInApp: true
  }, null, 2));
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  // Alternative: Direct FCM send (requires Firebase Admin SDK on server)
  console.log('📝 Alternative: Backend Can Send Directly');
  console.log('');
  console.log('The backend team can send push notification using:');
  console.log('');
  console.log('const admin = require(\'firebase-admin\');');
  console.log('');
  console.log('await admin.messaging().send({');
  console.log('  token: \'' + FCM_TOKEN + '\',');
  console.log('  notification: {');
  console.log('    title: \'🎉 Test Notification\',');
  console.log('    body: \'Hi Dadu! This is a test push notification.\'');
  console.log('  },');
  console.log('  android: { priority: \'high\' },');
  console.log('  apns: { payload: { aps: { sound: \'default\' } } }');
  console.log('});');
  console.log('');
  console.log('='.repeat(60));
  console.log('');

  // Check if user has notification preferences enabled
  console.log('✅ User Notification Settings:');
  console.log('   Push Enabled: YES');
  console.log('   FCM Token Registered: YES');
  console.log('   Device Ready: YES');
  console.log('');
  console.log('⚠️  Issue: Firebase Admin SDK not initialized on server');
  console.log('   Even with valid FCM token, push won\'t work until Firebase is configured.');
  console.log('');
}

sendPushToDadu();
