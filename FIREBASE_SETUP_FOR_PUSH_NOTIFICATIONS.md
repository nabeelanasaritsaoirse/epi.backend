# Firebase Setup for Push Notifications

## 🔍 Current Situation

### ✅ What You Have:
- Firebase Authentication (for login system) - **Working**
- FCM tokens registered in database - **Working**
- Push notification API code - **Working**

### ❌ What's Missing:
- **Firebase Admin SDK credentials** for sending push notifications

---

## 📋 Important: Two Different Firebase Setups

### 1. **Firebase Authentication** (Client-side) ✅
- Used in your **mobile app/frontend**
- Handles user login/signup
- **Already configured and working**

### 2. **Firebase Admin SDK** (Server-side) ❌
- Used in your **backend/server**
- Sends push notifications
- **NOT configured yet - This is what we need!**

---

## 🚀 How to Fix Push Notifications

### Step 1: Get Firebase Admin Credentials

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select your project (the one you're using for authentication)
3. Click on **⚙️ Project Settings** (gear icon, top left)
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (keep it secure!)

The JSON file looks like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id-here",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

---

### Step 2: Add to Your `.env` File

Open your `.env` file and **add these three lines**:

```bash
# Firebase Admin SDK for Push Notifications
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

**⚠️ Important Notes:**
- Keep the quotes around `FIREBASE_PRIVATE_KEY`
- Keep the `\n` characters in the private key (they're important!)
- Don't share these credentials publicly

---

### Step 3: Update `.env` File (Complete Example)

Your `.env` file should look like this:

```bash
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/your_database

# JWT Secret
JWT_SECRET=your_secret_key_here_change_this

# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# Firebase Admin SDK for Push Notifications (ADD THESE)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"

# Server Configuration
PORT=3000
NODE_ENV=production
TZ=Asia/Kolkata
```

---

### Step 4: Restart Your Server

**Local Development:**
```bash
# Stop server (Ctrl+C)
# Start again
npm start
```

**Production (PM2):**
```bash
pm2 restart all
# or
pm2 restart epi-backend
```

---

### Step 5: Verify Firebase is Initialized

Check the server logs:

**Local:**
```bash
# Look for this message in console:
✅ Firebase Admin SDK initialized successfully
```

**Production:**
```bash
pm2 logs epi-backend --lines 50 | grep -i firebase
```

**Should see:**
```
✅ Firebase Admin SDK initialized successfully
```

**If you see this instead:**
```
⚠️  Firebase Admin SDK NOT initialized
⚠️  Push notifications will be disabled
```
Then the credentials are not set correctly.

---

## 🧪 Test Push Notifications After Setup

Once Firebase is configured, test immediately:

```javascript
// Use the API we created
POST https://api.epielio.com/api/notifications/trigger
Authorization: Bearer YOUR_JWT_TOKEN

{
  "title": "🎉 Push Notification Test",
  "message": "Testing push notifications after Firebase setup!",
  "sendPush": true,
  "sendInApp": true
}
```

**Expected result:**
- ✅ Push notification appears on device
- ✅ In-app notification created
- ✅ Response: `"pushResult": { success details }` (not null anymore!)

---

## 📝 Quick Setup Checklist

- [ ] Go to Firebase Console
- [ ] Download service account JSON (Generate new private key)
- [ ] Open `.env` file
- [ ] Add `FIREBASE_PROJECT_ID` from JSON
- [ ] Add `FIREBASE_CLIENT_EMAIL` from JSON
- [ ] Add `FIREBASE_PRIVATE_KEY` from JSON (keep quotes and \n)
- [ ] Save `.env` file
- [ ] Restart server
- [ ] Check logs for "✅ Firebase Admin SDK initialized successfully"
- [ ] Test push notification via API
- [ ] Verify notification appears on device

---

## 🔐 Security Best Practices

1. **Never commit `.env` to Git**
   - Add to `.gitignore`: `echo ".env" >> .gitignore`

2. **Use different credentials for dev/prod**
   - Dev server: `.env` (local)
   - Production: Set environment variables on server

3. **Rotate keys periodically**
   - Generate new service account keys every 6-12 months

4. **Restrict service account permissions**
   - In Firebase Console, ensure service account has minimal required permissions

---

## 🎯 Why This is Different from Authentication

| Feature | Client-side Firebase | Server-side Firebase Admin |
|---------|---------------------|---------------------------|
| **Purpose** | User login/signup | Send push notifications |
| **Used in** | Mobile app/frontend | Backend/server |
| **Config file** | `google-services.json` (Android) | `.env` with service account |
| **Status** | ✅ Already working | ❌ Needs setup |

You already have Firebase Authentication working (that's why login works).

Now you need Firebase Admin SDK for push notifications (different setup).

---

## 🆘 Troubleshooting

### Issue 1: "Firebase Admin SDK NOT initialized"
**Cause:** Environment variables not set correctly

**Solution:**
1. Check `.env` file has all 3 variables
2. Restart server
3. Check for typos in variable names

### Issue 2: "Error: Invalid service account"
**Cause:** Wrong credentials or format

**Solution:**
1. Re-download JSON from Firebase Console
2. Copy exact values from JSON
3. Ensure `FIREBASE_PRIVATE_KEY` has quotes and `\n`

### Issue 3: Still getting `"pushResult": null`
**Cause:** Server not picking up new environment variables

**Solution:**
1. Stop server completely
2. Start fresh
3. Check logs immediately on startup

---

## 📞 Need Help?

If you're stuck:

1. **Check logs first:**
   ```bash
   pm2 logs epi-backend | grep Firebase
   ```

2. **Verify .env is loaded:**
   ```bash
   # Add this temporarily to index.js to test:
   console.log('Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
   ```

3. **Test credentials:**
   - Make sure the service account JSON is from the correct Firebase project
   - Verify it's the same project used for authentication

---

## ✅ Success Indicators

After setup, you should see:

1. **Server logs:**
   ```
   ✅ Firebase Admin SDK initialized successfully
   ```

2. **API response:**
   ```json
   {
     "success": true,
     "data": {
       "sentPush": true,
       "pushResult": {
         "successCount": 1,
         "failureCount": 0
       }
     }
   }
   ```

3. **Device:**
   - Push notification appears in notification bar
   - Sound/vibration (if enabled)

---

## 🎉 Once Configured

Push notifications will work for:
- ✅ Custom notifications via API
- ✅ Order confirmations
- ✅ Payment alerts
- ✅ Wallet updates
- ✅ Any system notifications

All automatically! 🚀
