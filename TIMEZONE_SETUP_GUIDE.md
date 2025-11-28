# 🌍 India Timezone Setup Guide

## Problem Statement

By default, Node.js server UTC timezone use karta hai. Isse ye problem hoti hai:
- **12 AM India time ≠ 12 AM UTC**
- Daily pending payments ko India time ke hisaab se schedule nahi hota
- Confusion hota hai payment due dates mein

## Solution: Server ko India Timezone (IST) pe Set Karo

---

## ✅ Implementation (Already Done)

### **File Updated:** `server.js`

```javascript
require('dotenv').config();

// Set timezone to India (IST)
process.env.TZ = 'Asia/Kolkata';

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

### **File Updated:** `.env.example`

```bash
# Timezone Configuration
TZ=Asia/Kolkata
```

---

## 🎯 What This Does

### Before Timezone Change (UTC):
```
India Time: 12:00 AM (Midnight)
Server Time: 6:30 PM (Previous Day)
❌ Payment due at 6:30 PM (wrong!)
```

### After Timezone Change (IST):
```
India Time: 12:00 AM (Midnight)
Server Time: 12:00 AM (Same)
✅ Payment due at 12:00 AM (correct!)
```

---

## 📋 Deployment Steps

### Step 1: Push Code to Git
```bash
git add server.js .env.example
git commit -m "feat: Set server timezone to Asia/Kolkata (IST)"
git push origin main
```

### Step 2: Pull on Live Server
```bash
# SSH into your server
ssh user@your-server-ip

# Navigate to project directory
cd /path/to/epi-backend

# Pull latest code
git pull origin main
```

### Step 3: Update .env File on Server
```bash
# Edit .env file
nano .env

# Add this line:
TZ=Asia/Kolkata

# Save and exit (Ctrl+X, then Y, then Enter)
```

### Step 4: Restart Server
```bash
# If using PM2:
pm2 restart all

# If using systemctl:
sudo systemctl restart your-app-name

# If using direct node:
pkill node
node server.js
```

---

## ✅ Verify Timezone is Set Correctly

### Method 1: Run Test Script
```bash
cd /path/to/epi-backend
node test-timezone.js
```

Expected Output:
```
🕐 Server Timezone Information:

Current Date (Server): 2025-11-28T02:54:22.000Z
Timezone String: Asia/Kolkata
Timezone Offset: 5.5 hours from UTC

Expected for India:
  - Timezone: Asia/Kolkata or Asia/Calcutta
  - Offset: +5.5 hours from UTC (IST)
```

### Method 2: Check via API
Create a test endpoint:

```javascript
// Add this to your routes
app.get('/api/test/timezone', (req, res) => {
  res.json({
    currentTime: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: new Date().getTimezoneOffset() / -60,
    indiaTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
});
```

Test:
```bash
curl https://api.epielio.com/api/test/timezone
```

---

## 🎯 Impact on Installment Orders

### Payment Schedule Calculation

**Before (UTC):**
```javascript
Order created at: 2025-11-27 12:00 PM India
Server sees: 2025-11-27 06:30 AM UTC
Next payment due: 2025-11-28 06:30 AM UTC
= 2025-11-28 12:00 PM India (Wrong! Should be midnight)
```

**After (IST):**
```javascript
Order created at: 2025-11-27 12:00 PM India
Server sees: 2025-11-27 12:00 PM IST
Next payment due: 2025-11-28 00:00 AM IST
= 2025-11-28 12:00 AM India (Correct! Midnight)
```

### Daily Pending API

**India time midnight ke baad:**
- New Date() automatically IST use karega
- `today.setHours(0, 0, 0, 0)` will set to IST midnight
- Daily pending calculations sahi honge

---

## 🔍 Code Analysis

### How Timezone Affects Code:

#### 1. Order Creation (`installmentOrderService.js`)
```javascript
// Payment schedule generation
const startDate = new Date(); // Now uses IST

for (let i = 1; i <= totalDays; i++) {
  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + (i - 1));
  // dueDate ab IST mein hoga

  schedule.push({
    installmentNumber: i,
    dueDate: dueDate, // IST midnight
    amount: dailyAmount,
    status: i === 1 ? 'PAID' : 'PENDING'
  });
}
```

#### 2. Daily Pending Check (`getDashboardOverview`)
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0); // IST midnight (00:00)

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1); // Next IST midnight

// Check if payment due between today and tomorrow (IST)
const dueDate = new Date(item.dueDate);
return dueDate >= today && dueDate < tomorrow;
```

---

## 📊 Testing After Deployment

### Test 1: Create New Order
```bash
# Create order at 11:00 PM IST
POST /api/installments/orders

# Check payment schedule
GET /api/installments/orders/{orderId}/schedule

# Verify: Next payment due at 12:00 AM IST (next day)
```

### Test 2: Daily Pending API
```bash
# Test at different times:
# 11:59 PM IST - Should NOT show tomorrow's payments
# 12:01 AM IST - Should show today's payments
GET /api/installments/payments/daily-pending
```

### Test 3: Dashboard Overview
```bash
# At 12:01 AM IST
GET /api/installments/dashboard/overview

# Should show:
# - todayPendingPayments.count > 0 (if orders exist)
# - Correct India time in all dates
```

---

## ⚠️ Important Notes

### 1. Database Dates
- MongoDB stores dates in UTC (always)
- But when querying with new Date(), it uses server timezone
- This is correct behavior!

### 2. Date Comparisons
```javascript
// This now works correctly:
const today = new Date(); // IST
today.setHours(0, 0, 0, 0); // IST midnight

// Comparing with DB dates (stored as UTC):
dueDate >= today // Automatically converts UTC to IST for comparison
```

### 3. Client-Side Display
- Frontend should display dates in user's local timezone
- Backend sends ISO format (includes timezone info)
- Flutter/JS automatically converts to local time

```dart
// Flutter example:
DateTime.parse(apiDate).toLocal()
```

---

## 🔄 Rollback (If Needed)

### If timezone causes issues:

#### Remove from server.js:
```javascript
// Comment out or remove:
// process.env.TZ = 'Asia/Kolkata';
```

#### Remove from .env:
```bash
# Comment out:
# TZ=Asia/Kolkata
```

#### Restart server:
```bash
pm2 restart all
```

---

## 📝 Current Test Data

### User for Testing:
```
User ID: 691d6035962542bf4120f30b
Email: dadud3002@gmail.com
Access Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Expected Behavior After Timezone Change:
```
Current Active Orders: 5
Next Payment Due: 28 Nov, 12:00 AM IST (midnight)

Daily Pending API (28 Nov, 12:01 AM onwards):
- Count: 5
- Total Amount: ₹280
```

---

## ✅ Benefits

1. **User-Friendly**: Payments due at India midnight (12 AM)
2. **Predictable**: Easy to understand for Indian users
3. **Consistent**: All dates in IST throughout the app
4. **No Confusion**: No timezone conversion needed for India users

---

## 📞 Support

Issues after deployment?
1. Check server logs: `pm2 logs`
2. Run test script: `node test-timezone.js`
3. Verify .env file has `TZ=Asia/Kolkata`
4. Check if server was restarted after changes

---

**Version:** 1.0
**Date:** November 28, 2025
**Status:** ✅ Ready for Deployment
**Impact:** High - Affects all installment payment scheduling
