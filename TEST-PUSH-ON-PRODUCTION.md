# Test Push Notifications on Production Server

## ✅ What We've Done So Far

1. ✅ Updated Firebase Admin SDK: `npm install firebase-admin@latest`
2. ✅ Restarted server: `pm2 restart epi-backend`
3. ✅ Verified logs show: `✅ Firebase Admin SDK initialized successfully`

## 🧪 Now Let's Test Push Notifications

### Method 1: Test Script (Recommended)

**Step 1: Upload the test script to production**

You need to copy `production-test-push.js` to your production server at `/var/www/epi-backend/`

**Step 2: Run the test on production**

```bash
cd /var/www/epi-backend
node production-test-push.js
```

**Expected Output:**

If **successful**:
```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

👤 Found user: {
  id: xxx,
  name: 'Dadu Dade',
  phone: '+919922133164',
  hasFCMToken: true
}

🚀 Sending test push notification...

📊 Result: {
  "pushResult": {
    "successCount": 1,
    "failureCount": 0
  }
}

🎉 SUCCESS! Firebase push notification sent!
✅ Firebase Admin SDK is working correctly!
✅ The sendMulticast() function is now available!

📱 Check your device for the notification!
```

If **still failing**:
```
⚠️  Push result is null
Possible reasons:
- Firebase credentials not loaded
- Firebase Admin SDK not initialized
- FCM token invalid or expired
```

---

### Method 2: Using API Directly

**Step 1: Get a fresh authentication token**

Login to the app on your device, then get the token from your app.

**Step 2: Test via curl on production server**

```bash
# Replace YOUR_FRESH_TOKEN with actual token
curl -X POST https://api.epielio.com/api/notifications/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FRESH_TOKEN" \
  -d '{
    "title": "🎉 Firebase Test",
    "message": "Testing push after Firebase update!",
    "sendPush": true,
    "sendInApp": true
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": true,
    "pushResult": {
      "successCount": 1,
      "failureCount": 0
    }
  }
}
```

**Expected Response (Still failing):**
```json
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": true,
    "pushResult": null
  }
}
```

---

### Method 3: Check Logs While Testing

**Open two terminal windows:**

**Terminal 1:** Watch logs
```bash
pm2 logs epi-backend --lines 0
```

**Terminal 2:** Trigger notification (using Method 1 or 2)

**Look for these logs:**

✅ **If working:**
```
[FCM] Attempting to send push notification
[FCM] Successfully sent push notification
```

❌ **If still failing:**
```
[FCM] Error sending push notification: admin.messaging(...).sendMulticast is not a function
```

---

## 🔍 Diagnostic Commands

If the test still shows `pushResult: null`, run these:

### 1. Check Firebase Environment Variables
```bash
cd /var/www/epi-backend
printenv | grep FIREBASE
```

Should show:
```
FIREBASE_PROJECT_ID=epielio-b0faf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@epielio-b0faf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

### 2. Check Firebase Admin SDK Version
```bash
cd /var/www/epi-backend
npm list firebase-admin
```

Should show version **12.x.x or higher**:
```
firebase-admin@12.7.0
```

### 3. Check if Firebase is Actually Initialized
```bash
pm2 logs epi-backend --lines 100 | grep -i firebase
```

Must see:
```
✅ Firebase Admin SDK initialized successfully
```

### 4. Restart and Watch Startup Logs
```bash
pm2 restart epi-backend && pm2 logs epi-backend --lines 20
```

---

## 🚨 If Still Not Working

### Issue: `pushResult: null` even after update

**Possible Cause 1: Environment variables not loaded**

**Solution:**
```bash
cd /var/www/epi-backend

# Check if .env file exists
ls -la .env

# If exists, make sure PM2 loads it
pm2 stop epi-backend
pm2 start index.js --name epi-backend --env production
pm2 save
```

**Possible Cause 2: Old version still cached**

**Solution:**
```bash
cd /var/www/epi-backend

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm install firebase-admin@latest

# Hard restart PM2
pm2 delete epi-backend
pm2 start index.js --name epi-backend
pm2 save
```

**Possible Cause 3: Different code on production**

**Solution:**
```bash
# Check if config/firebase.js exists
cat /var/www/epi-backend/config/firebase.js

# Check if index.js loads it
grep "firebase" /var/www/epi-backend/index.js
```

Must see this line in index.js:
```javascript
require("./config/firebase"); // Initialize Firebase
```

---

## 📝 What to Share

After running the tests, please share:

1. **Output of Method 1** (production-test-push.js)
2. **Current Firebase version**: `npm list firebase-admin`
3. **Environment check**: `printenv | grep FIREBASE` (mask the private key)
4. **Recent logs**: `pm2 logs epi-backend --lines 50 | grep -i firebase`

This will help identify exactly what's happening!

---

## 🎯 Expected Final Result

Once everything is working:

1. ✅ Script shows: `🎉 SUCCESS! Firebase push notification sent!`
2. ✅ API response includes: `"pushResult": { "successCount": 1, "failureCount": 0 }`
3. ✅ You see notification on your device
4. ✅ Logs show: `[FCM] Successfully sent push notification`

Then push notifications will work automatically for:
- Order confirmations
- Payment alerts
- Wallet updates
- Any triggered notifications via API

🚀 Let's test it!
