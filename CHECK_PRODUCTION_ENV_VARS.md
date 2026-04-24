# Check Production Environment Variables

You're now SSH'd into the production server. Here are the commands to check Firebase configuration:

## 1. Check PM2 Environment Variables

```bash
# Show all environment variables for epi-backend
pm2 describe epi-backend

# Or show just the env section
pm2 describe epi-backend | grep -A 50 "env:"

# Check specifically for Firebase variables
pm2 env 0  # If epi-backend is process ID 0
```

## 2. Check if .env file exists

```bash
# Navigate to the project directory
cd /var/www/epi-backend  # or wherever your project is

# Check if .env file exists
ls -la .env

# View .env file (if it exists)
cat .env | grep FIREBASE
```

## 3. Check process environment

```bash
# Get the PID of epi-backend
pm2 list

# Check environment variables for that process
cat /proc/$(pm2 pid epi-backend)/environ | tr '\0' '\n' | grep FIREBASE
```

## 4. Check PM2 ecosystem file

```bash
# Check if ecosystem.config.js exists
ls -la ecosystem.config.js

# View it
cat ecosystem.config.js
```

## 5. Check Application Logs

```bash
# Check for Firebase initialization messages
pm2 logs epi-backend --lines 100 | grep -i firebase

# Watch logs in real-time
pm2 logs epi-backend --raw | grep -E "Firebase|FCM"
```

## Expected Results:

### ✅ If Firebase IS configured:
```
✅ Firebase Admin SDK initialized successfully
   Project ID: your-project-id
```

### ❌ If Firebase is NOT configured:
```
⚠️  Firebase Admin SDK NOT initialized
⚠️  Push notifications will be disabled
⚠️  Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

## What to Look For:

You need these 3 environment variables:
```
FIREBASE_PROJECT_ID=epi-epielio  # (or your project ID)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@epi-epielio.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Next Steps Based on Results:

### If variables are missing:
1. Check where the project stores secrets (AWS Secrets Manager, .env file, etc.)
2. Add the Firebase credentials
3. Restart: `pm2 restart epi-backend`

### If variables exist but formatted incorrectly:
- Check that `FIREBASE_PRIVATE_KEY` has newlines escaped as `\n`
- Ensure the key is wrapped in quotes
- Restart after fixing

### If variables exist and formatted correctly:
- The issue might be with the credentials themselves
- Verify in Firebase Console that the service account is active
- Check Cloud Messaging API is enabled
