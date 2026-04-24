const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc2NDgyODA2NCwiZXhwIjoxNzY3NDIwMDY0fQ.SS1PvvVA9tk9Euy7t-fPVyxaVnn96GIbeTHcbfX3fEc';

async function sendPush() {
  console.log('📱 Sending Test Push Notification to Your Device...');
  console.log('');

  try {
    const res = await axios.post('https://api.epielio.com/api/notifications/trigger', {
      title: '🎉 Test Push Notification!',
      message: 'Hi! This is a test push notification. If you see this on your device, push notifications are working!',
      sendPush: true,
      sendInApp: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ SUCCESS! Notification sent!');
    console.log('');
    console.log('Response:', JSON.stringify(res.data, null, 2));
    console.log('');
    console.log('📱 Check your device now!');
    console.log('');

    if (res.data.data?.sentPush && !res.data.data?.pushResult) {
      console.log('⚠️  Note: sentPush is true but pushResult is null');
      console.log('   This means Firebase is not initialized on server.');
      console.log('   You will see in-app notification but NOT push notification.');
    }

  } catch (e) {
    console.log('❌ Error:', JSON.stringify(e.response?.data || e.message, null, 2));
  }
}

sendPush();
