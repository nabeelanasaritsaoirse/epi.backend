# 🚀 Deploy Push Notification Fix to Production

## ✅ What's Fixed in Local Code (Main Branch)

The fcmService.js has been updated with TWO critical fixes:

1. **Field Name Fix**: Changed `fcmToken` → `deviceToken` (to match User model)
2. **Firebase SDK Fix**: Replaced `sendMulticast()` with individual `send()` calls (compatible with firebase-admin@13.6.0)

## 📋 Deploy Commands (Run on Production Server)

```bash
# 1. Go to project directory
cd /var/www/epi-backend

# 2. Pull latest code from main branch
git pull origin main

# 3. Restart PM2
pm2 restart epi-backend

# 4. Watch logs
pm2 logs epi-backend --lines 50
```

## 🧪 Immediately After Deploy - Test

Once deployed, you should see in logs:
```
✅ Firebase Admin SDK initialized successfully
[FCM] Found 1 user(s) with deviceToken for userIds: [ '69325d650e5fae0da2739122' ]
[FCM] Attempting to send push notification to 1 device(s)
[FCM] Push sent: 1, failed: 0
```

And API response will show:
```json
{
  "pushResult": {
    "success": true,
    "sent": 1,
    "failed": 0,
    "totalTargeted": 1
  }
}
```

**NOT `null` anymore!** ✅

## 🎯 Expected Result

Push notification will appear on Dadu's device! 📱
