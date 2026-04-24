# 🔍 Firebase Push Notification Diagnostic

## ✅ Current Status

1. ✅ **API is working** - Returns 200 OK
2. ✅ **User has FCM token** - Device token present in database
3. ✅ **Firebase Admin SDK updated** - Latest version installed
4. ❌ **Push not delivered** - `pushResult: null` in API response

## 🎯 Root Cause

Since the user has an FCM token but `pushResult` is `null`, the issue is:

**Firebase Admin SDK is NOT properly initialized on production server**

This means either:
1. Firebase environment variables are not loaded
2. Firebase initialization failed silently
3. Server needs to be restarted to load new Firebase SDK

---

## 🧪 Diagnostic Commands (Run on Production Server)

### Step 1: Check Firebase Initialization Logs

```bash
pm2 logs epi-backend --lines 200 | grep -i firebase
```

**What to look for:**

✅ **If working:**
```
✅ Firebase Admin SDK initialized successfully
```

❌ **If failing:**
```
⚠️  Firebase Admin SDK NOT initialized
⚠️  Push notifications will be disabled
⚠️  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

---

### Step 2: Check Environment Variables

```bash
cd /var/www/epi-backend
printenv | grep FIREBASE
```

**Expected output:**
```
FIREBASE_PROJECT_ID=epielio-b0faf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@epielio-b0faf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

**If empty:**
Firebase environment variables are NOT set on production!

---

### Step 3: Check Firebase Admin SDK Version

```bash
cd /var/www/epi-backend
npm list firebase-admin
```

**Expected:**
```
firebase-admin@12.7.0
```

**If showing old version (< 11.0.0):**
The update didn't take effect. Need to reinstall.

---

### Step 4: Check if config/firebase.js is Loaded

```bash
cd /var/www/epi-backend
grep "firebase" index.js
```

**Must see this line:**
```javascript
require("./config/firebase"); // Initialize Firebase
```

**If missing:**
Firebase initialization is not being called!

---

## 🔧 Solutions Based on Diagnosis

### Solution 1: Environment Variables Not Set

**Problem:** `printenv | grep FIREBASE` returns empty

**Fix:**
```bash
cd /var/www/epi-backend

# Check if .env file exists
cat .env | grep FIREBASE

# If .env has Firebase variables, restart PM2 with env loading:
pm2 stop epi-backend
pm2 start index.js --name epi-backend
pm2 save

# If .env doesn't have Firebase variables, add them:
nano .env
# Add:
# FIREBASE_PROJECT_ID=epielio-b0faf
# FIREBASE_CLIENT_EMAIL=your-service-account-email
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Then restart:
pm2 restart epi-backend --update-env
```

---

### Solution 2: Firebase Admin SDK Not Updated

**Problem:** `npm list firebase-admin` shows old version

**Fix:**
```bash
cd /var/www/epi-backend

# Clean install
rm -rf node_modules package-lock.json
npm install
npm install firebase-admin@latest

# Hard restart
pm2 delete epi-backend
pm2 start index.js --name epi-backend
pm2 save
```

---

### Solution 3: Firebase Config Not Loaded

**Problem:** `grep "firebase" index.js` doesn't show `require("./config/firebase")`

**Fix:**

Check if line exists in [index.js](index.js) around line 176:
```javascript
require("./config/firebase"); // Initialize Firebase
```

If missing, the code was not deployed. Need to pull latest code or add the line.

---

### Solution 4: Firebase Initialized but Still Failing

**Problem:** Logs show "✅ Firebase Admin SDK initialized successfully" but `pushResult` still `null`

**Check FCM Service:**

```bash
cd /var/www/epi-backend
pm2 logs epi-backend --lines 500 | grep -i "FCM"
```

**Look for:**
```
[FCM] Error sending push notification: admin.messaging(...).sendMulticast is not a function
```

**If you see this error:**
Old Firebase version is still cached.

**Fix:**
```bash
cd /var/www/epi-backend
rm -rf node_modules
npm cache clean --force
npm install
pm2 restart epi-backend
```

---

## 🚀 Quick Test After Fix

After applying any fix, immediately test:

```bash
# Watch logs in real-time
pm2 logs epi-backend --lines 0
```

In another terminal, trigger notification via API or run this test:

```bash
cd /var/www/epi-backend
node check-user-fcm-token.js
```

**Expected logs if working:**
```
✅ Firebase Admin SDK initialized successfully
[FCM] Attempting to send push notification
[FCM] Successfully sent push notification to 1 device(s)
```

**Expected API response if working:**
```json
{
  "success": true,
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

---

## 📋 Information Needed

Please run these commands and share the output:

1. **Check Firebase initialization:**
   ```bash
   pm2 logs epi-backend --lines 200 | grep -i firebase
   ```

2. **Check environment variables (mask private key):**
   ```bash
   printenv | grep FIREBASE_PROJECT_ID
   printenv | grep FIREBASE_CLIENT_EMAIL
   echo "FIREBASE_PRIVATE_KEY exists: $(printenv | grep FIREBASE_PRIVATE_KEY | wc -l)"
   ```

3. **Check Firebase version:**
   ```bash
   cd /var/www/epi-backend
   npm list firebase-admin
   ```

4. **Check if Firebase config is loaded:**
   ```bash
   grep "firebase" /var/www/epi-backend/index.js
   ```

5. **Check recent FCM logs:**
   ```bash
   pm2 logs epi-backend --lines 100 | grep -E "(FCM|Firebase)"
   ```

---

## 🎯 Most Likely Issue

Based on the symptoms:

✅ User has device token
✅ API returns success
✅ Firebase SDK updated
❌ `pushResult` is `null`

**Most likely cause:** Firebase environment variables are not set on production server.

**Most likely fix:** Set Firebase environment variables in production `.env` file and restart PM2.

---

## 💡 Next Steps

1. Run the diagnostic commands above
2. Share the output
3. We'll identify exact issue
4. Apply the correct fix
5. Test immediately
6. Push notifications will work! 🎉
