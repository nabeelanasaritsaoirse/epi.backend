# 🔔 Send Push Notification to Nishant

## ✅ User Details Confirmed

- **Email**: nishantprofit1@gmail.com
- **User ID**: 6923f85fd8823e6f88977191
- **Name**: Nishant
- **Device Token**: ✅ Present (dnh2vwOjQlyGpXSe_LBT-h:APA91b...)

## 🚀 Production Server Commands

### Option 1: Copy and Run Test Script (Recommended)

```bash
# On production server
cd /var/www/epi-backend

# Create the test script
cat > send-to-nishant.js << 'EOF'
require('dotenv').config();
const mongoose = require('mongoose');
const { sendPushNotification } = require('./services/fcmService');
const User = require('./models/User');

const TARGET_EMAIL = 'nishantprofit1@gmail.com';

async function main() {
  try {
    console.log('🚀 Sending push notification to Nishant...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: TARGET_EMAIL });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log('  - ID:', user._id);
    console.log('  - Name:', user.name);
    console.log('  - Device Token:', user.deviceToken ? 'Present' : 'Missing');
    console.log();

    if (!user.deviceToken) {
      console.log('❌ No device token');
      process.exit(1);
    }

    console.log('🔔 Sending push notification...\n');

    const result = await sendPushNotification(user._id.toString(), {
      title: '🎉 Test from Server',
      body: 'Testing push notification to Nishant!',
      data: { type: 'TEST' }
    });

    console.log('📊 Result:', JSON.stringify(result, null, 2));

    if (result.success && result.sent > 0) {
      console.log('\n✅ Push sent! Check device!');
    } else {
      console.log('\n⚠️ Push not sent:', result.message || result.error);
    }

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
EOF

# Run it
node send-to-nishant.js
```

### Option 2: Use Node REPL

```bash
# On production server
cd /var/www/epi-backend
node

# Then paste this:
require('dotenv').config();
const mongoose = require('mongoose');
const { sendPushNotification } = require('./services/fcmService');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected');

  const result = await sendPushNotification('6923f85fd8823e6f88977191', {
    title: '🎉 Test Notification',
    body: 'Testing push to Nishant!',
    data: { type: 'TEST' }
  });

  console.log('Result:', result);
  process.exit();
});
```

## 🎯 Expected Output (After Deploy)

```
✅ Firebase Admin SDK initialized successfully
🚀 Sending push notification to Nishant...
✅ Connected to MongoDB
✅ User found:
  - ID: 6923f85fd8823e6f88977191
  - Name: Nishant
  - Device Token: Present

🔔 Sending push notification...

[FCM] Found 1 user(s) with deviceToken for userIds: [ '6923f85fd8823e6f88977191' ]
[FCM] Attempting to send push notification to 1 device(s)
[FCM] Push sent: 1, failed: 0

📊 Result: {
  "success": true,
  "sent": 1,
  "failed": 0,
  "totalTargeted": 1
}

✅ Push sent! Check device!
```

## ⚠️ IMPORTANT: Deploy Code First!

Before running the above test, you MUST deploy the fixed code:

```bash
cd /var/www/epi-backend
git pull origin main
pm2 restart epi-backend
```

The fixed code includes:
1. ✅ Field name fix (`deviceToken` instead of `fcmToken`)
2. ✅ Firebase SDK fix (individual `send()` instead of `sendMulticast()`)

## 📱 Result

After running, Nishant should receive a push notification on his device! 🎉
