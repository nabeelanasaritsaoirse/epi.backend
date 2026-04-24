# Fix Server Time Sync Issue for Firebase

## Problem
Firebase credential error due to server time not being synced properly:
```
app/invalid-credential - Invalid JWT Signature
```

## Solution: Sync Server Time

### Step 1: SSH into Production Server
```bash
ssh ubuntu@your-server-ip
# OR
ssh ubuntu@api.epielio.com
```

### Step 2: Check Current Server Time
```bash
date
timedatectl
```

### Step 3: Install NTP (if not installed)
```bash
sudo apt-get update
sudo apt-get install ntp -y
```

### Step 4: Sync Time Immediately

**Option A - Using timedatectl (Recommended for Ubuntu 18.04+):**
```bash
# Enable automatic time sync
sudo timedatectl set-ntp true

# Check status
timedatectl status
```

**Option B - Using ntpdate:**
```bash
# Stop NTP service first
sudo systemctl stop ntp

# Sync time immediately
sudo ntpdate -s time.nist.gov
# OR
sudo ntpdate -s pool.ntp.org

# Start NTP service again
sudo systemctl start ntp
sudo systemctl enable ntp
```

**Option C - Using timesyncd (Ubuntu default):**
```bash
# Restart timesyncd
sudo systemctl restart systemd-timesyncd

# Check status
timedatectl status
```

### Step 5: Verify Time is Synced
```bash
# Check if time is synced
timedatectl status | grep "System clock synchronized"
# Should show: System clock synchronized: yes

# Check current time
date
```

### Step 6: Restart Your Application
```bash
cd /var/www/epi-backend

# Restart PM2
pm2 restart epi-backend

# Check logs
pm2 logs epi-backend --lines 20
```

### Step 7: Test Push Notification Again
After restarting, the Firebase credential error should be gone.

---

## Alternative: If Time Sync Doesn't Work

If time sync doesn't fix the issue, then Firebase service account key might be revoked.

### Regenerate Firebase Service Account Key:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/saoirse-epi/settings/serviceaccounts/adminsdk

2. **Click "Generate New Private Key"**

3. **Download the JSON file**

4. **Extract values and update environment variables on server:**
   ```bash
   # Open the downloaded JSON file and get:
   # - project_id
   # - private_key
   # - client_email

   # On server, edit .env file:
   nano /var/www/epi-backend/.env

   # Update these values:
   FIREBASE_PROJECT_ID="your-project-id"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@project-id.iam.gserviceaccount.com"
   ```

5. **Restart application:**
   ```bash
   pm2 restart epi-backend
   ```

---

## Quick Commands Summary

```bash
# SSH to server
ssh ubuntu@api.epielio.com

# Check time
date
timedatectl status

# Sync time (choose one method)
sudo timedatectl set-ntp true
# OR
sudo ntpdate -s time.nist.gov && sudo systemctl restart ntp

# Verify
timedatectl status | grep synchronized

# Restart app
cd /var/www/epi-backend
pm2 restart epi-backend

# Check logs
pm2 logs epi-backend --lines 30 | grep -E "FCM|Firebase"
```

---

## Expected Result After Fix

Logs should show:
```
✅ Firebase Admin SDK initialized successfully
[FCM] Found 1 user(s) with deviceToken
[FCM] Attempting to send push notification to 1 device(s)
[FCM] Push sent: 1, failed: 0
```

No more `app/invalid-credential` errors!
