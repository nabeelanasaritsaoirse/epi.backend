# 🔧 Deploy Push Notification Fix

## 🎯 The Bug Found!

**Root Cause:** Field name mismatch
- User model field: `deviceToken` ✅
- FCM service was looking for: `fcmToken` ❌
- Result: FCM service couldn't find users with tokens, returned `null`

**This is why:**
- ✅ Firebase Admin SDK initialized successfully
- ✅ User has device token in database
- ❌ `pushResult: null` (FCM service couldn't find the token)

---

## ✅ The Fix Applied

Updated [services/fcmService.js](services/fcmService.js):
- Changed all `fcmToken` references to `deviceToken`
- Fixed in 7 locations throughout the file
- Now matches the User model field name

---

## 🚀 Deploy to Production

### Option 1: Copy Updated File (Fastest)

```bash
# On production server
cd /var/www/epi-backend

# Backup current file
cp services/fcmService.js services/fcmService.js.backup

# Upload the fixed services/fcmService.js file from your local machine
# Then restart:
pm2 restart epi-backend
```

### Option 2: Manual Edit on Production

```bash
# On production server
cd /var/www/epi-backend
nano services/fcmService.js
```

**Find and replace all occurrences** (7 times):
- Find: `fcmToken` (in query/select)
- Replace: `deviceToken`

**Specific lines to change:**
1. Line 43: `fcmToken:` → `deviceToken:`
2. Line 45: `.select('fcmToken'` → `.select('deviceToken'`
3. Line 57: `u.fcmToken` → `u.deviceToken`
4. Line 109: `{ fcmToken:` → `{ deviceToken:`
5. Line 110: `{ $unset: { fcmToken:` → `{ $unset: { deviceToken:`
6. Line 167: `fcmToken:` → `deviceToken:`
7. Line 171: `.select('fcmToken')` → `.select('deviceToken')`
8. Line 177: `u.fcmToken` → `u.deviceToken`
9. Line 250: `.select('fcmToken'` → `.select('deviceToken'`
10. Line 252: `user.fcmToken` → `user.deviceToken`
11. Line 295: `{ fcmToken },` → `{ deviceToken: fcmToken },`
12. Line 317: `{ $unset: { fcmToken:` → `{ $unset: { deviceToken:`

**Save and restart:**
```bash
pm2 restart epi-backend
```

### Option 3: Git Push (If using version control)

```bash
# On local machine (where you have the fix)
git add services/fcmService.js
git commit -m "fix: Change fcmToken to deviceToken to match User model"
git push

# On production server
cd /var/www/epi-backend
git pull
pm2 restart epi-backend
```

---

## 🧪 Test Immediately After Deploy

### Test 1: Watch Logs

```bash
pm2 logs epi-backend --lines 0
```

### Test 2: Send Test Notification

In another terminal or using curl:

```bash
curl -X POST https://api.epielio.com/api/notifications/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -d '{
    "title": "🎉 Test After Fix",
    "message": "Testing push notifications after fcmToken fix!",
    "sendPush": true,
    "sendInApp": true
  }'
```

**Expected Response (FIXED):**
```json
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": true,
    "pushResult": {
      "successCount": 1,
      "failureCount": 0,
      "totalTargeted": 1
    }
  }
}
```

**NOT null anymore!** ✅

### Test 3: Check Logs for FCM Success

```bash
pm2 logs epi-backend --lines 50 | grep FCM
```

**Expected:**
```
[FCM] Attempting to send push notification
[FCM] Sent: 1, Failed: 0
```

### Test 4: Check Device

The push notification should now appear on Dadu's device!

---

## 📊 Before vs After

### Before Fix:
```json
{
  "pushResult": null  ❌
}
```

**Logs:**
```
[FCM] No users with valid FCM tokens found
```

### After Fix:
```json
{
  "pushResult": {
    "successCount": 1,
    "failureCount": 0,
    "totalTargeted": 1
  }
}
```

**Logs:**
```
[FCM] Sent: 1, Failed: 0
```

**Device:** 📱 Push notification appears!

---

## ✅ Verification Checklist

After deploying, verify:

- [ ] File deployed to production
- [ ] PM2 restarted
- [ ] Firebase initialization still shows: `✅ Firebase Admin SDK initialized successfully`
- [ ] Test API returns `pushResult` with actual data (not null)
- [ ] Logs show: `[FCM] Sent: 1, Failed: 0`
- [ ] Push notification appears on device
- [ ] No errors in PM2 logs

---

## 🎉 Expected Result

Once deployed:

1. ✅ API returns success with actual `pushResult` data
2. ✅ FCM logs show notifications being sent
3. ✅ Push notifications appear on devices
4. ✅ All notification features work:
   - Manual trigger via `/api/notifications/trigger`
   - Order confirmations
   - Payment alerts
   - Wallet updates
   - System notifications

---

## 🆘 If Issues After Deploy

### Issue: Still seeing `pushResult: null`

**Check:**
```bash
# Verify file was actually updated
grep "deviceToken" /var/www/epi-backend/services/fcmService.js | head -3
```

Should show `deviceToken`, not `fcmToken`.

**If still shows `fcmToken`:**
File wasn't updated. Re-deploy.

### Issue: Error after restart

**Check logs:**
```bash
pm2 logs epi-backend --lines 100 --err
```

**Most common:**
- Syntax error: Check you edited correctly
- Module not found: Run `npm install`

---

## 💬 Next Steps

1. Deploy the fix using one of the options above
2. Test with the curl command
3. Verify `pushResult` is NOT null
4. Confirm notification appears on device
5. Celebrate! 🎉

The fix is simple but critical - just need to deploy it!
