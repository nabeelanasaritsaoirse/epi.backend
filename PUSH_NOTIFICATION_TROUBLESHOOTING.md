# Push Notification Not Showing - Troubleshooting Guide

## ✅ What's Working
- API endpoint is working (200 response)
- Request is being processed successfully
- `sentPush: true` confirms the system tried to send push notification

## ❌ Why Push Notification Not Showing

The issue is likely one of these:

### 1. Firebase Not Initialized on Server ⚠️ MOST LIKELY
**Check server logs for Firebase initialization:**

```bash
pm2 logs epi-backend | grep -i firebase
```

**Expected (if working):**
```
✅ Firebase Admin SDK initialized successfully
```

**If you see this instead:**
```
⚠️  Firebase Admin SDK NOT initialized
⚠️  Push notifications will be disabled
⚠️  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

**Solution:**
The server needs Firebase environment variables set. Ask your backend team to configure:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

### 2. FCM Token Not Registered or Invalid

**Check if your FCM token is registered:**

#### Test API Call:
```javascript
// Check your user profile to see if FCM token exists
GET http://13.127.15.87:8080/api/users/profile
Authorization: Bearer YOUR_TOKEN
```

**Response should include:**
```json
{
  "fcmToken": "cZYhzmBWQsuld_pu8G_1jM:APA91bG8ku_o8S99d2NF6duNNTJEOfpkjf0RHjxFntMOQj1ehNQPoSH6XLgH1jWXJawpa_5mI_XsZB1XAKh3yzfXkmx3PRdYl04xnK0_RxgECSSUhPy3YLk"
}
```

**If fcmToken is missing or null:**

#### Register FCM Token First:
```javascript
// In your Flutter/React Native app, get the FCM token first
import firebase_messaging from '@react-native-firebase/messaging';

async function registerFCMToken() {
  // Request permission (iOS)
  const authStatus = await firebase_messaging().requestPermission();

  // Get FCM token
  const fcmToken = await firebase_messaging().getToken();
  console.log('FCM Token:', fcmToken);

  // Register token with backend
  const response = await fetch('http://13.127.15.87:8080/api/notifications/register-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userAuthToken}`
    },
    body: JSON.stringify({
      fcmToken: fcmToken
    })
  });

  const data = await response.json();
  console.log('Token registered:', data);
}

// Call this when user logs in
registerFCMToken();
```

---

### 3. Notification Preferences Disabled

**Check notification preferences:**

```javascript
GET http://13.127.15.87:8080/api/users/profile
Authorization: Bearer YOUR_TOKEN
```

**Look for:**
```json
{
  "notificationPreferences": {
    "pushEnabled": true,  // ⚠️ Must be true
    "systemNotifications": true
  }
}
```

**If pushEnabled is false, enable it:**

```javascript
PUT http://13.127.15.87:8080/api/notifications/preferences
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "pushEnabled": true,
  "systemNotifications": true,
  "orderUpdates": true,
  "paymentAlerts": true,
  "promotionalOffers": true
}
```

---

### 4. Device Notification Permissions

**Android:**
- Go to Settings → Apps → Your App → Notifications
- Ensure "Allow notifications" is ON

**iOS:**
- Go to Settings → Notifications → Your App
- Ensure "Allow Notifications" is ON

---

### 5. App Not Configured for FCM

#### Flutter Setup Check:

**android/app/google-services.json**
```json
{
  "project_info": {
    "project_id": "your-firebase-project"
  }
}
```

**android/app/build.gradle**
```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

**lib/main.dart**
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

---

## 🔍 Step-by-Step Debugging

### Step 1: Check Server Logs (MOST IMPORTANT)
```bash
# SSH to your server
ssh user@13.127.15.87

# Check Firebase initialization
pm2 logs epi-backend --lines 100 | grep -i firebase

# Look for FCM activity when you trigger notification
pm2 logs epi-backend --lines 50
```

### Step 2: Trigger Notification and Watch Logs in Real-Time
```bash
# Terminal 1: Watch server logs
pm2 logs epi-backend

# Terminal 2: Trigger notification from your app
# Check Terminal 1 for any FCM errors
```

**What to look for:**
```
[FCM] Token registered for user 691af389415a3d077c3bb154
[FCM] Sent: 1, Failed: 0
[Notification] Created in-app notification ... for user 691af389415a3d077c3bb154
```

**If you see:**
```
[FCM] Firebase not initialized, skipping push notification
```
**Then Firebase is NOT configured on server.**

### Step 3: Test Direct FCM Send (Bypass Backend)

Use Firebase Console to test if FCM token works:

1. Go to https://console.firebase.google.com/
2. Select your project
3. Go to **Cloud Messaging** → **Send test message**
4. Enter your FCM token: `cZYhzmBWQsuld_pu8G_1jM:APA91bG8ku_o8S99d2NF6duNNTJEOfpkjf0RHjxFntMOQj1ehNQPoSH6XLgH1jWXJawpa_5mI_XsZB1XAKh3yzfXkmx3PRdYl04xnK0_RxgECSSUhPy3YLk`
5. Click **Test**

**If this works:** Problem is with backend Firebase setup
**If this doesn't work:** Problem is with app/device setup

---

## 🎯 Quick Fix Checklist

Run through this checklist in order:

- [ ] **1. Check server Firebase initialization** (SSH and check logs)
- [ ] **2. Verify FCM token is registered** (Call GET /api/users/profile)
- [ ] **3. Check notification preferences** (Ensure pushEnabled: true)
- [ ] **4. Test FCM token in Firebase Console** (Direct send test)
- [ ] **5. Check device notification permissions** (Settings)
- [ ] **6. Verify app has google-services.json** (Android)
- [ ] **7. Check Firebase initialization in app** (Flutter/React Native)

---

## 💡 Most Common Issue (99% of cases)

**Firebase is NOT initialized on the server.**

The server needs these environment variables:

```bash
# Get these from Firebase Console → Project Settings → Service Accounts
FIREBASE_PROJECT_ID=epi-backend-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@epi-backend.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
```

**Ask your backend/DevOps team to:**
1. Set these environment variables on the server
2. Restart the application: `pm2 restart epi-backend`
3. Check logs: `pm2 logs epi-backend | grep Firebase`

---

## 📞 Contact Backend Team

Send this to your backend team:

```
Hi Team,

Push notifications are not working. The API returns success but notifications don't arrive on device.

API Response:
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": false,
    "pushResult": null
  }
}

Please check:
1. Is Firebase Admin SDK initialized on the server?
2. Are environment variables set: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY?
3. Check server logs for: [FCM] or Firebase messages

Server: 13.127.15.87:8080
```

---

## ✅ Testing After Fix

Once Firebase is configured on server, test with this:

```javascript
// Test push notification
fetch('http://13.127.15.87:8080/api/notifications/trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: '🧪 Testing Push Notification',
    message: 'If you see this, push notifications are working!',
    sendPush: true,
    sendInApp: false  // Test push only
  })
});
```

**Expected:**
- Notification appears on device within 1-3 seconds
- Server logs show: `[FCM] Sent: 1, Failed: 0`

---

## 📚 Additional Resources

- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
- Flutter Firebase: https://firebase.flutter.dev/docs/messaging/overview
- React Native Firebase: https://rnfirebase.io/messaging/usage

---

## Summary

**API is working ✅** - Backend code is correct
**Push not showing ❌** - Most likely Firebase not initialized on server

**Next Steps:**
1. Check server logs for Firebase initialization
2. Contact backend team to configure Firebase environment variables
3. Test direct FCM send from Firebase Console
4. Ensure FCM token is registered for your user
