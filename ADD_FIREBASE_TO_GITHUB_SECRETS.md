# Add Firebase Variables to GitHub Secrets

## 🔐 Your Setup

You're using **GitHub Secrets** (or similar CI/CD secrets) to store environment variables for the production server. The variables are injected during deployment.

## ✅ What You Need to Add

You need to add these 3 secrets to your GitHub repository:

### 1. FIREBASE_PROJECT_ID
```
Value: your-firebase-project-id
Example: epi-epielio
```

### 2. FIREBASE_CLIENT_EMAIL
```
Value: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
Example: firebase-adminsdk-abc123@epi-epielio.iam.gserviceaccount.com
```

### 3. FIREBASE_PRIVATE_KEY
```
Value: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**IMPORTANT:** For the private key, you need to include it as a **single line** with `\n` for newlines.

---

## 📋 Step-by-Step: Get Firebase Credentials

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com/
2. Select your project (the one used by the mobile app)

### Step 2: Generate Service Account Key
1. Click **Project Settings** (⚙️ icon)
2. Go to **Service Accounts** tab
3. Click **Generate New Private Key**
4. Click **Generate Key** → Downloads a JSON file

### Step 3: Extract Values from JSON

The downloaded file looks like this:
```json
{
  "type": "service_account",
  "project_id": "epi-epielio",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-abc123@epi-epielio.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}
```

**Extract these 3 values:**
- `project_id` → Use for **FIREBASE_PROJECT_ID**
- `client_email` → Use for **FIREBASE_CLIENT_EMAIL**
- `private_key` → Use for **FIREBASE_PRIVATE_KEY**

---

## 🔧 Add to GitHub Secrets

### If Using GitHub Actions:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:

#### Secret 1:
```
Name: FIREBASE_PROJECT_ID
Value: epi-epielio
```

#### Secret 2:
```
Name: FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-abc123@epi-epielio.iam.gserviceaccount.com
```

#### Secret 3 (IMPORTANT - Format Carefully):
```
Name: FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n
```

**Note:** Copy the ENTIRE `private_key` value from the JSON, including the `\n` characters. It should be one long line with `\n` for newlines.

---

## 🔄 Update Deployment Workflow

### If using GitHub Actions:

Your `.github/workflows/deploy.yml` should include these secrets:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy to Server
        env:
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_CLIENT_EMAIL: ${{ secrets.FIREBASE_CLIENT_EMAIL }}
          FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY }}
          # ... other secrets
        run: |
          # Your deployment script here
          # These env vars will be passed to the server
```

### If using GitLab CI/CD:

Go to: **Settings** → **CI/CD** → **Variables**

Add the same 3 variables there.

---

## 🚀 After Adding Secrets

### Option 1: Redeploy via Git Push

1. Make a small change (e.g., add a comment)
2. Commit and push to trigger deployment:
   ```bash
   git add .
   git commit -m "Trigger redeploy with Firebase secrets"
   git push origin main
   ```

### Option 2: Manual Deployment

If you have a manual deployment script:
```bash
# SSH to server
ssh your-server

# Set environment variables manually (temporary test)
export FIREBASE_PROJECT_ID="epi-epielio"
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-abc123@epi-epielio.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Restart PM2 with new env vars
pm2 restart epi-backend --update-env
```

### Option 3: Update PM2 Ecosystem File on Server

If you have an `ecosystem.config.js` on the server:
```bash
# SSH to server
cd /var/www/epi-backend

# Edit ecosystem.config.js
nano ecosystem.config.js
```

Add the Firebase variables:
```javascript
module.exports = {
  apps: [{
    name: 'epi-backend',
    script: './index.js',
    env_production: {
      NODE_ENV: 'production',
      FIREBASE_PROJECT_ID: 'epi-epielio',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-abc123@epi-epielio.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n',
      // ... other env vars
    }
  }]
}
```

Then restart:
```bash
pm2 delete epi-backend
pm2 start ecosystem.config.js --env production
```

---

## ✅ Verify It's Working

After deployment, check the logs:

```bash
# SSH to server
ssh your-server

# Check logs
pm2 logs epi-backend --lines 50 | grep -i firebase
```

**Expected output (SUCCESS):**
```
✅ Firebase Admin SDK initialized successfully
   Project ID: epi-epielio
```

**If still failing:**
```
⚠️  Firebase Admin SDK NOT initialized
⚠️  Push notifications will be disabled
```

---

## 🧪 Test Notification Again

After Firebase is initialized, run the test script again:

```bash
# From your local machine
node scripts/sendPushToNishantFixed.js
```

**Expected output:**
```json
{
  "success": true,
  "data": {
    "sentPush": true,
    "sentInApp": true,
    "pushResult": {
      "success": true,
      "sent": 1,        ← Should be 1, not 0!
      "failed": 0,
      "totalTargeted": 1
    }
  }
}
```

---

## 🔍 Troubleshooting

### Issue: Private key format error

If you see errors like:
```
Error: Invalid PEM formatted message
```

**Solution:** The private key needs proper escaping:
- In GitHub Secrets: Use `\n` (literal backslash-n)
- In ecosystem.config.js: Use `\\n` (double backslash-n)
- In .env file: Use actual newlines or `\n`

### Issue: Still showing "Firebase not initialized"

**Possible causes:**
1. Secrets not passed to deployment
2. Deployment workflow not updated
3. Server not restarted after adding secrets
4. Wrong secret names (must match exactly)

**Debug:**
```bash
# SSH to server
pm2 logs epi-backend --lines 100

# Check if env vars are set
pm2 describe epi-backend | grep -A 30 "env:"

# Check process environment
cat /proc/$(pm2 pid epi-backend)/environ | tr '\0' '\n' | grep FIREBASE
```

---

## 📝 Summary

1. ✅ Get Firebase service account JSON from Firebase Console
2. ✅ Extract 3 values: project_id, client_email, private_key
3. ✅ Add to GitHub Secrets (or your CI/CD platform)
4. ✅ Update deployment workflow to pass these secrets
5. ✅ Redeploy (git push or manual)
6. ✅ Verify in logs: "Firebase Admin SDK initialized successfully"
7. ✅ Test notification: `node scripts/sendPushToNishantFixed.js`

---

**Current Status:**
- ✅ Code upgraded with sendEachForMulticast
- ⚠️ Firebase secrets need to be added to GitHub
- ⚠️ Need to redeploy after adding secrets

**Time to complete:** ~10 minutes

---

## 🆘 Need Help?

If you're not sure about your deployment setup, please share:
1. Which branch triggers production deployment? (main, production, etc.)
2. Do you use GitHub Actions, GitLab CI, or manual deployment?
3. Output of: `pm2 logs epi-backend --lines 50 | grep -i firebase`

I can then provide specific instructions for your setup! 🚀
