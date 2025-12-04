# Wallet API Test Guide

Quick guide to test wallet APIs on production (`https://api.epielio.com`)

---

## 🔐 Step 1: Get Your JWT Token

Login to the app and copy your JWT token from the response.

```bash
# Set your token as environment variable
export JWT_TOKEN="your_jwt_token_here"
```

Or for Windows PowerShell:
```powershell
$JWT_TOKEN="your_jwt_token_here"
```

---

## 🧪 Test Commands

### 1. Get Wallet Summary

```bash
curl -X GET "https://api.epielio.com/api/wallet/" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Wallet fetched",
  "walletBalance": 5000,
  "availableBalance": 5000,
  "transactions": [...]
}
```

---

### 2. Add Money to Wallet (₹100)

```bash
curl -X POST "https://api.epielio.com/api/wallet/add-money" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

**Expected Success Response:**
```json
{
  "success": true,
  "order_id": "order_MXkj8d9sKLm2Pq",
  "amount": 10000,
  "transaction_id": "6543210abcdef123456789"
}
```

**Expected Error (OLD CODE - Receipt Too Long):**
```json
{
  "success": false,
  "message": "Server error"
}
```

**PM2 Logs (OLD CODE):**
```
description: 'receipt: the length must be no more than 40.'
```

**PM2 Logs (NEW CODE - FIXED):**
```
✅ Razorpay initialized successfully
```

---

### 3. Withdraw Money (UPI)

```bash
curl -X POST "https://api.epielio.com/api/wallet/withdraw" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "paymentMethod": "upi",
    "upiId": "yourname@paytm"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Your withdrawal request has been submitted successfully. Money will be credited within 2 days.",
  "withdrawal": {
    "_id": "...",
    "amount": 50,
    "paymentMethod": "upi",
    "status": "pending"
  }
}
```

---

### 4. Withdraw Money (Bank Transfer)

```bash
curl -X POST "https://api.epielio.com/api/wallet/withdraw" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "paymentMethod": "bank_transfer",
    "bankName": "State Bank of India",
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "accountHolderName": "Your Name"
  }'
```

---

### 5. Get Transaction History

```bash
curl -X GET "https://api.epielio.com/api/wallet/transactions" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 🔧 Admin APIs

Get admin JWT token first, then test:

### 1. Get All Withdrawal Requests

```bash
curl -X GET "https://api.epielio.com/api/admin/wallet/withdrawals?status=pending" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

### 2. Approve Withdrawal

```bash
curl -X POST "https://api.epielio.com/api/admin/wallet/withdrawals/approve" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "6543210abcdef123456789",
    "adminNotes": "Payment processed via NEFT"
  }'
```

---

### 3. Reject Withdrawal

```bash
curl -X POST "https://api.epielio.com/api/admin/wallet/withdrawals/reject" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "6543210abcdef123456789",
    "reason": "Invalid bank details"
  }'
```

---

## 🚀 Quick Test (One-Liner)

Test add-money API quickly:

```bash
curl -X POST "https://api.epielio.com/api/wallet/add-money" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}' \
  | jq '.'
```

Replace `YOUR_TOKEN_HERE` with your actual JWT token.

---

## ✅ Success Criteria

### Before Deploy (Old Code):
```bash
# add-money returns error
{
  "success": false,
  "message": "Server error"
}

# PM2 logs show:
receipt: the length must be no more than 40.
```

### After Deploy (Fixed Code):
```bash
# add-money returns success
{
  "success": true,
  "order_id": "order_xxx",
  "amount": 10000,
  "transaction_id": "xxx"
}

# PM2 logs show:
✅ Razorpay initialized successfully
```

---

## 📋 Deployment Checklist

- [ ] SSH into production server
- [ ] `cd /var/www/epi-backend`
- [ ] `git pull origin nishant` (or `git pull origin main`)
- [ ] `pm2 restart epi-backend`
- [ ] `pm2 logs epi-backend --lines 20` (verify no errors)
- [ ] Test add-money API with curl
- [ ] Verify Razorpay order is created
- [ ] Test withdrawal API
- [ ] Share API docs with frontend teams

---

## 🐛 Troubleshooting

### Issue: Still getting "Server error"

**Solution:**
```bash
# On production server
cd /var/www/epi-backend

# Check current code
git log --oneline -3

# You should see:
# a94b70f feat: Enhanced environment configuration and payment setup

# If not, pull again
git fetch origin
git pull origin nishant

# Force restart
pm2 delete epi-backend
pm2 start ecosystem.config.js  # or however you start it

# Check logs
pm2 logs epi-backend --lines 50
```

### Issue: "receipt: the length must be no more than 40"

**Solution:**
The fix is in commit `a94b70f`. Make sure production has this commit:

```bash
git log --oneline | grep "Enhanced environment"
```

---

## 📞 Support

If issues persist:
1. Check PM2 logs: `pm2 logs epi-backend --err --lines 100`
2. Verify Razorpay credentials in `.env` file
3. Check if server pulled latest code: `git log -1`
4. Verify receipt generation in [routes/wallet.js:54-58](routes/wallet.js#L54-L58)

---

**Last Updated:** 2024-11-28
**API Version:** 1.0
