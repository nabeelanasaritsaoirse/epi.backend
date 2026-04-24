# Autopay API Documentation

## Overview

The Autopay system allows users to automatically pay their daily installments from their wallet balance. The system runs at scheduled times (6 AM, 12 PM, 6 PM IST) and processes payments based on user preferences.

## Features

### Phase 1 (Implemented)
- Basic Autopay (enable/disable per order)
- Cron Job for daily payments (3 time slots)
- Pause/Resume/Skip dates
- Settings (time preference, minimum balance lock)
- Push Notifications

### Phase 2 (Implemented)
- Dashboard & Balance Forecast
- Payment Streak System with Rewards (Admin Configurable)
- Low Balance Alerts
- Daily Payment Reminders

---

## API Endpoints

### Base URL: `/api/installments/autopay`

---

## Enable/Disable Autopay

### Enable Autopay for Order
```
POST /api/installments/autopay/enable/:orderId
```

**Request Body:**
```json
{
  "priority": 1  // Optional, 1-100 (lower = higher priority)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Autopay enabled successfully",
  "data": {
    "orderId": "ORD123456",
    "productName": "iPhone 15",
    "autopay": {
      "enabled": true,
      "priority": 1,
      "enabledAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

### Disable Autopay for Order
```
POST /api/installments/autopay/disable/:orderId
```

### Enable Autopay for All Orders
```
POST /api/installments/autopay/enable-all
```

### Disable Autopay for All Orders
```
POST /api/installments/autopay/disable-all
```

---

## Pause/Resume/Skip

### Pause Autopay
```
POST /api/installments/autopay/pause/:orderId
```

**Request Body:**
```json
{
  "pauseUntil": "2024-01-20T00:00:00.000Z"  // Maximum 30 days
}
```

### Resume Autopay
```
POST /api/installments/autopay/resume/:orderId
```

### Add Skip Dates
```
POST /api/installments/autopay/skip-dates/:orderId
```

**Request Body:**
```json
{
  "dates": [
    "2024-01-25",
    "2024-01-26",
    "2024-02-14"
  ]
}
```
*Maximum 10 skip dates per order*

### Remove Skip Date
```
DELETE /api/installments/autopay/skip-dates/:orderId
```

**Request Body:**
```json
{
  "date": "2024-01-25"
}
```

---

## Skip Dates - Technical Implementation Notes

**Important for Developers and Testers:**

The skip dates feature was updated on **February 11, 2026** to fix two critical bugs:

### Bug Fixes Implemented

#### 1. Timezone Consistency Fix
**Issue:** Skip dates were being stored with timezone offset (e.g., selecting Feb 15 would store as Feb 16 or vice versa depending on server timezone).

**Root Cause:** Date parsing used server's local timezone (`setHours(0,0,0,0)`) instead of UTC, causing dates to shift when server timezone was IST (UTC+5:30).

**Fix:** All skip dates are now stored as **UTC midnight** (`00:00:00.000Z`) regardless of server timezone. Date parsing uses `Date.UTC()` to ensure consistency.

**Example:**
- **Before:** Selecting `2026-02-15` stored as `2026-02-14T18:30:00.000Z` or `2026-02-15T18:30:00.000Z`
- **After:** Selecting `2026-02-15` stores as `2026-02-15T00:00:00.000Z`

#### 2. Persistence Fix (Mongoose markModified)
**Issue:** DELETE operations showed success but dates reappeared on subsequent fetch.

**Root Cause:** Mongoose doesn't auto-detect changes to nested arrays (`order.autopay.skipDates`), so `save()` wasn't persisting modifications.

**Fix:** Added `order.markModified('autopay.skipDates')` before `save()` in both add and remove operations.

### Date Format Requirements

**Request Format:**
- Send dates as **ISO date strings** in format: `YYYY-MM-DD`
- Example: `"2026-02-15"`, `"2026-03-20"`

**Response Format:**
- Dates returned as **ISO 8601 UTC strings**: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Always at midnight UTC: `00:00:00.000Z`
- Example: `"2026-02-15T00:00:00.000Z"`

**Frontend Parsing:**
```javascript
// Correct way to display skip date to user
const skipDate = "2026-02-15T00:00:00.000Z";
const dateObj = new Date(skipDate);

// Display only the date part (YYYY-MM-DD)
const displayDate = skipDate.split('T')[0]; // "2026-02-15"

// Or use date formatting
const formatted = dateObj.toISOString().split('T')[0]; // "2026-02-15"
```

### Migration Notes for Test Data

**For Developers/Testers Only:**

If you have test orders with skip dates created before February 11, 2026, those dates may have incorrect timezone offsets (e.g., `18:30:00.000Z` instead of `00:00:00.000Z`).

**How to identify old buggy dates:**
- Old dates: `2026-02-15T18:30:00.000Z` (18:30 UTC = midnight IST)
- New dates: `2026-02-15T00:00:00.000Z` (midnight UTC)

**Cleanup Options:**

1. **Delete and re-add:** Remove old skip dates via DELETE endpoint, then add new ones
2. **Manual cleanup:** Run the migration script provided in `scripts/migrateOldSkipDates.js`
3. **Ignore:** Old dates won't affect production users (feature not live yet)

**Note:** This only affects test/dev data. No production user data is impacted as skip dates feature was not released before the fix.

### Implementation Details

The fix was applied to 3 files:
1. `services/autopayService.js` - Add/remove skip dates logic
2. `models/InstallmentOrder.js` - `isSkipDate()` method for autopay processing
3. `jobs/autopayCron.js` - Low balance alert skip date checks

All date comparisons now use UTC consistently across the entire autopay system.

---

## Settings

### Update Autopay Settings
```
PUT /api/installments/autopay/settings
```

**Request Body:**
```json
{
  "enabled": true,
  "timePreference": "MORNING_6AM",  // MORNING_6AM, AFTERNOON_12PM, EVENING_6PM
  "minimumBalanceLock": 200,        // This amount will not be used for autopay
  "lowBalanceThreshold": 500,       // Alert when balance falls below this
  "sendDailyReminder": true,
  "reminderHoursBefore": 1          // 1-12 hours before payment
}
```

### Get Autopay Settings
```
GET /api/installments/autopay/settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "enabled": true,
      "timePreference": "MORNING_6AM",
      "minimumBalanceLock": 200,
      "lowBalanceThreshold": 500,
      "sendDailyReminder": true,
      "reminderHoursBefore": 1
    },
    "notificationPreferences": {
      "autopaySuccess": true,
      "autopayFailed": true,
      "lowBalanceAlert": true,
      "dailyReminder": true
    }
  }
}
```

### Get Autopay Status (All Orders)
```
GET /api/installments/autopay/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 5,
    "autopayEnabled": 3,
    "totalDailyAmount": 300,
    "orders": [
      {
        "orderId": "ORD123456",
        "productName": "iPhone 15",
        "dailyAmount": 100,
        "remainingAmount": 5000,
        "progress": 50,
        "autopay": {
          "enabled": true,
          "priority": 1,
          "pausedUntil": null,
          "skipDates": [],
          "isActive": true,
          "successCount": 25,
          "failedCount": 0
        }
      }
    ]
  }
}
```

### Set Order Priority
```
PUT /api/installments/autopay/priority/:orderId
```

**Request Body:**
```json
{
  "priority": 2  // 1-100
}
```

---

## Dashboard & Forecast

### Get Autopay Dashboard
```
GET /api/installments/autopay/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "balance": 2500,
      "minimumLock": 200,
      "availableForAutopay": 2300,
      "isLowBalance": false,
      "lowBalanceThreshold": 500
    },
    "autopay": {
      "enabled": true,
      "totalOrders": 5,
      "autopayEnabledOrders": 3,
      "totalDailyDeduction": 300,
      "daysBalanceLasts": 7,
      "nextPaymentTime": "2024-01-16T00:30:00.000Z",
      "timePreference": "MORNING_6AM"
    },
    "stats": {
      "thisMonthPaid": 4500,
      "thisMonthPaymentsCount": 45
    },
    "streak": {
      "current": 15,
      "longest": 20,
      "lastPaymentDate": "2024-01-15",
      "nextMilestone": {
        "days": 30,
        "reward": 50,
        "badge": "MONTHLY_MASTER"
      }
    },
    "suggestions": {
      "suggestedTopUp": 800,
      "topUpFor7Days": 2100,
      "topUpFor30Days": 9000
    },
    "orders": [...]
  }
}
```

### Get Balance Forecast
```
GET /api/installments/autopay/forecast?days=30
```

**Query Parameters:**
- `days`: Number of days to forecast (1-90, default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "currentBalance": 2500,
    "minimumLock": 200,
    "availableForAutopay": 2300,
    "totalOrders": 3,
    "daysForecasted": 30,
    "daysUntilInsufficient": 8,
    "dailyForecast": [
      {
        "date": "2024-01-16",
        "dayNumber": 1,
        "startBalance": 2300,
        "deduction": 300,
        "endBalance": 2000,
        "payments": [
          {
            "orderId": "ORD123",
            "productName": "iPhone 15",
            "amount": 100
          }
        ],
        "insufficientFunds": false,
        "shortfall": 0
      }
    ],
    "summary": {
      "totalExpectedDeduction": 9000,
      "totalPayments": 90,
      "daysWithInsufficientFunds": 22
    }
  }
}
```

### Get Autopay History
```
GET /api/installments/autopay/history?page=1&limit=20
```

### Get Suggested Top-up Amount
```
GET /api/installments/autopay/suggested-topup?days=7
```

---

## Streak System (User APIs)

The streak system rewards users for consistent daily payments. **All milestones and rewards are configured by the admin** - there are no hardcoded defaults. The streak system will only work after an admin configures it from the admin panel.

### Get Streak Information
```
GET /api/installments/autopay/streak
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 15,
    "longest": 25,
    "isActive": true,
    "lastPaymentDate": "2024-01-15",
    "totalRewardsEarned": 60,
    "milestonesAchieved": [
      {
        "days": 7,
        "achievedAt": "2024-01-10",
        "rewardAmount": 10
      }
    ],
    "nextMilestone": {
      "days": 30,
      "reward": 50,
      "badge": "MONTHLY_MASTER"
    },
    "daysUntilNextMilestone": 15,
    "allMilestones": [],
    "isConfigured": true,
    "isEnabled": true
  }
}
```

**Note:**
- `isConfigured`: Whether admin has set up streak configuration
- `isEnabled`: Whether streak rewards are currently active
- `allMilestones`: Returns milestones configured by admin (empty if not configured)
- `nextMilestone`: Returns null if no milestones are configured or all have been achieved

---

## Notification Preferences

### Update Notification Preferences
```
PUT /api/installments/autopay/notification-preferences
```

**Request Body:**
```json
{
  "autopaySuccess": true,
  "autopayFailed": true,
  "lowBalanceAlert": true,
  "dailyReminder": true
}
```

---

## Admin APIs - Autopay Management

### Manual Trigger Autopay (For Testing)
```
POST /api/installments/admin/autopay/trigger
```

**Request Body:**
```json
{
  "timeSlot": "MORNING_6AM"  // MORNING_6AM, AFTERNOON_12PM, EVENING_6PM
}
```

### Get Cron Job Status
```
GET /api/installments/admin/autopay/cron-status
```

### Get Users with Autopay Enabled
```
GET /api/installments/admin/autopay/users
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "users": [
      {
        "_id": "user123",
        "name": "John Doe",
        "email": "john@example.com",
        "autopaySettings": {
          "enabled": true,
          "timePreference": "MORNING_6AM"
        },
        "walletBalance": 5000,
        "autopayOrderCount": 3
      }
    ]
  }
}
```

### Get Autopay Statistics
```
GET /api/installments/admin/autopay/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "usersWithAutopay": 25,
    "ordersWithAutopay": 78,
    "timePreferences": {
      "MORNING_6AM": 15,
      "AFTERNOON_12PM": 7,
      "EVENING_6PM": 3
    },
    "recentActivity": [
      {
        "orderId": "ORD123456",
        "productName": "iPhone 15",
        "successCount": 25,
        "failedCount": 0,
        "lastActivity": {
          "date": "2024-01-15T00:30:00.000Z",
          "status": "SUCCESS",
          "amount": 100
        }
      }
    ]
  }
}
```

---

## Admin APIs - Streak Configuration

The admin has **full control** over the streak reward system. There are no hardcoded defaults - the admin must configure all milestones and enable the system before users can earn streak rewards.

### Get Streak Configuration
```
GET /api/installments/admin/streak/config
```

**Response (Not Configured):**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "milestones": [],
    "isConfigured": false,
    "message": "Streak system not configured. Admin needs to set it up."
  }
}
```

**Response (Configured):**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "milestones": [
      { "days": 7, "reward": 10, "badge": "WEEKLY_WARRIOR", "description": "7 days streak reward", "isActive": true },
      { "days": 30, "reward": 50, "badge": "MONTHLY_MASTER", "description": "30 days streak reward", "isActive": true },
      { "days": 60, "reward": 100, "badge": "CONSISTENCY_CHAMPION", "description": "60 days streak reward", "isActive": true }
    ],
    "isConfigured": true,
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "updatedBy": "admin@example.com"
  }
}
```

### Update Streak Configuration
```
PUT /api/installments/admin/streak/config
```

**Request Body:**
```json
{
  "enabled": true,
  "milestones": [
    { "days": 7, "reward": 10, "badge": "WEEKLY_WARRIOR", "description": "Complete 7 days streak", "isActive": true },
    { "days": 30, "reward": 50, "badge": "MONTHLY_MASTER", "description": "Complete 30 days streak", "isActive": true },
    { "days": 60, "reward": 100, "badge": "CONSISTENCY_CHAMPION", "description": "Complete 60 days streak", "isActive": true },
    { "days": 90, "reward": 200, "badge": "PLATINUM_PAYER", "description": "Complete 90 days streak", "isActive": true },
    { "days": 180, "reward": 500, "badge": "LEGENDARY_STREAK", "description": "Complete 180 days streak", "isActive": true }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Streak configuration updated",
  "data": {
    "enabled": true,
    "milestones": [...],
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Enable/Disable Streak System
```
PUT /api/installments/admin/streak/enable
```

**Request Body:**
```json
{
  "enabled": true  // or false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Streak system enabled",
  "data": {
    "enabled": true
  }
}
```

### Add a New Milestone
```
POST /api/installments/admin/streak/milestone
```

**Request Body:**
```json
{
  "days": 7,
  "reward": 10,
  "badge": "WEEKLY_WARRIOR",
  "description": "Complete 7 consecutive days of autopay"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 7 days added",
  "data": {
    "milestones": [...]
  }
}
```

### Update a Milestone
```
PUT /api/installments/admin/streak/milestone/:days
```

**Request Body:**
```json
{
  "days": 7,           // Optional - change the days value
  "reward": 15,        // Optional - update reward amount
  "badge": "NEW_BADGE", // Optional - update badge name
  "description": "Updated description",  // Optional
  "isActive": true     // Optional - enable/disable this milestone
}
```

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 7 days updated",
  "data": {
    "milestones": [...]
  }
}
```

### Delete a Milestone
```
DELETE /api/installments/admin/streak/milestone/:days
```

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 7 days deleted",
  "data": {
    "milestones": [...]
  }
}
```

### Delete All Streak Configuration (Reset)
```
DELETE /api/installments/admin/streak/config
```

**Response:**
```json
{
  "success": true,
  "message": "Streak configuration deleted"
}
```

### Get Streak Statistics
```
GET /api/installments/admin/streak/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "isConfigured": true,
      "enabled": true,
      "milestonesCount": 5
    },
    "stats": {
      "totalUsersWithStreak": 150,
      "totalRewardsGiven": 25000,
      "avgCurrentStreak": 12,
      "maxCurrentStreak": 95,
      "maxLongestStreak": 120
    },
    "topUsers": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "currentStreak": 95,
        "longestStreak": 95,
        "totalRewardsEarned": 360,
        "milestonesAchieved": 4
      }
    ]
  }
}
```

---

## Cron Job Schedule (IST)

| Job | Time (IST) | Description |
|-----|------------|-------------|
| MORNING_6AM | 6:00 AM | Process morning autopay |
| AFTERNOON_12PM | 12:00 PM | Process afternoon autopay |
| EVENING_6PM | 6:00 PM | Process evening autopay |
| REMINDER_5AM | 5:00 AM | Send reminder for 6 AM slot |
| REMINDER_11AM | 11:00 AM | Send reminder for 12 PM slot |
| REMINDER_5PM | 5:00 PM | Send reminder for 6 PM slot |
| LOW_BALANCE_CHECK | 12:00 AM | Check and alert for next day's payments |

---

## Database Schema Changes

### User Model - New Fields
```javascript
autopaySettings: {
  enabled: Boolean,                    // Global autopay enable
  timePreference: String,              // MORNING_6AM, AFTERNOON_12PM, EVENING_6PM
  minimumBalanceLock: Number,          // This amount will not be used for autopay
  lowBalanceThreshold: Number,         // Alert threshold
  sendDailyReminder: Boolean,
  reminderHoursBefore: Number          // 1-12
}

paymentStreak: {
  current: Number,
  longest: Number,
  lastPaymentDate: Date,
  totalRewardsEarned: Number,
  milestonesAchieved: [{
    days: Number,
    achievedAt: Date,
    rewardAmount: Number
  }]
}

notificationPreferences: {
  autopaySuccess: Boolean,
  autopayFailed: Boolean,
  lowBalanceAlert: Boolean,
  dailyReminder: Boolean
}
```

### InstallmentOrder Model - New Fields
```javascript
autopay: {
  enabled: Boolean,
  priority: Number,           // 1-100
  pausedUntil: Date,
  skipDates: [Date],
  lastAttempt: {
    date: Date,
    status: String,           // SUCCESS, FAILED, SKIPPED, INSUFFICIENT_BALANCE
    errorMessage: String
  },
  history: [{
    date: Date,
    status: String,
    amount: Number,
    errorMessage: String,
    paymentId: ObjectId
  }],
  enabledAt: Date,
  successCount: Number,
  failedCount: Number
}
```

### StreakConfig Model (New - Singleton)
```javascript
{
  configId: "STREAK_CONFIG",   // Unique identifier for singleton pattern
  enabled: Boolean,            // Is streak system enabled (default: false)
  milestones: [{
    days: Number,              // Streak days required
    reward: Number,            // Reward amount in wallet
    badge: String,             // Badge name
    description: String,       // Description
    isActive: Boolean          // Is this milestone active
  }],
  updatedBy: ObjectId,         // Admin who last updated
  updatedByEmail: String       // Admin email
}
```

**Important Notes:**
- `enabled` defaults to `false` - admin must enable the streak system
- `milestones` is empty by default - admin must add milestones
- No hardcoded default milestones - everything is admin-configured
- Streak rewards only work after admin configures and enables the system

---

## Error Codes

| Code | Message |
|------|---------|
| 400 | Order not found |
| 400 | Autopay can only be enabled for active orders |
| 400 | Order is already fully paid |
| 400 | Pause date must be in the future |
| 400 | Maximum pause period is 30 days |
| 400 | Maximum 10 skip dates allowed |
| 400 | Invalid time preference |
| 400 | Priority must be between 1 and 100 |
| 400 | Milestone for X days already exists |
| 400 | Milestone for X days not found |
| 400 | No streak configuration found |
| 400 | Configuration already exists. Use update instead. |

---

## Push Notification Types

| Type | When Sent |
|------|-----------|
| AUTOPAY_SUCCESS | After successful autopay |
| AUTOPAY_FAILED | When autopay fails |
| LOW_BALANCE_ALERT | When balance is low for next day |
| AUTOPAY_REMINDER | 1 hour before scheduled autopay |
| STREAK_MILESTONE | When streak milestone is achieved (only if streak system is enabled) |

---

## Frontend Integration Guide

### 1. Enable Autopay Flow
```javascript
// 1. Check wallet balance
const balance = await getWalletBalance();

// 2. Get active orders
const status = await fetch('/api/installments/autopay/status');

// 3. Enable for selected orders
await fetch(`/api/installments/autopay/enable/${orderId}`, {
  method: 'POST',
  body: JSON.stringify({ priority: 1 })
});

// 4. Set global settings
await fetch('/api/installments/autopay/settings', {
  method: 'PUT',
  body: JSON.stringify({
    enabled: true,
    timePreference: 'MORNING_6AM',
    minimumBalanceLock: 200
  })
});
```

### 2. Dashboard Display
```javascript
// Get dashboard data
const dashboard = await fetch('/api/installments/autopay/dashboard');

// Display:
// - Wallet balance & available amount
// - Daily deduction amount
// - Days balance will last
// - Current streak (if streak system is enabled)
// - Next payment time
// - Suggested top-up
```

### 3. Forecast View
```javascript
// Get 30-day forecast
const forecast = await fetch('/api/installments/autopay/forecast?days=30');

// Show calendar view with:
// - Days with payments
// - Days with insufficient funds (red)
// - Suggested top-up amounts
```

### 4. Admin Streak Configuration
```javascript
// 1. Check current configuration
const config = await fetch('/api/installments/admin/streak/config');

// 2. If not configured, set up milestones
if (!config.data.isConfigured) {
  await fetch('/api/installments/admin/streak/config', {
    method: 'PUT',
    body: JSON.stringify({
      enabled: true,
      milestones: [
        { days: 7, reward: 10, badge: 'WEEKLY_WARRIOR', description: '7 days streak' },
        { days: 30, reward: 50, badge: 'MONTHLY_MASTER', description: '30 days streak' },
        { days: 90, reward: 200, badge: 'PLATINUM_PAYER', description: '90 days streak' }
      ]
    })
  });
}

// 3. Add individual milestone
await fetch('/api/installments/admin/streak/milestone', {
  method: 'POST',
  body: JSON.stringify({
    days: 60,
    reward: 100,
    badge: 'CONSISTENCY_CHAMPION',
    description: '60 days streak reward'
  })
});

// 4. Enable/Disable system
await fetch('/api/installments/admin/streak/enable', {
  method: 'PUT',
  body: JSON.stringify({ enabled: true })
});

// 5. Get statistics
const stats = await fetch('/api/installments/admin/streak/stats');
```

---

## API Summary

### User Autopay Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/autopay/enable/:orderId` | Enable autopay for an order |
| POST | `/autopay/disable/:orderId` | Disable autopay for an order |
| POST | `/autopay/enable-all` | Enable autopay for all orders |
| POST | `/autopay/disable-all` | Disable autopay for all orders |
| POST | `/autopay/pause/:orderId` | Pause autopay for an order |
| POST | `/autopay/resume/:orderId` | Resume autopay for an order |
| POST | `/autopay/skip-dates/:orderId` | Add skip dates |
| DELETE | `/autopay/skip-dates/:orderId` | Remove a skip date |
| PUT | `/autopay/settings` | Update autopay settings |
| GET | `/autopay/settings` | Get autopay settings |
| GET | `/autopay/status` | Get autopay status for all orders |
| PUT | `/autopay/priority/:orderId` | Set order priority |
| GET | `/autopay/dashboard` | Get autopay dashboard |
| GET | `/autopay/forecast` | Get balance forecast |
| GET | `/autopay/history` | Get autopay history |
| GET | `/autopay/streak` | Get streak information |
| GET | `/autopay/suggested-topup` | Get suggested top-up amount |
| PUT | `/autopay/notification-preferences` | Update notification preferences |

### Admin Autopay Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/autopay/trigger` | Manually trigger autopay |
| GET | `/admin/autopay/cron-status` | Get cron job status |
| GET | `/admin/autopay/users` | Get users with autopay enabled |
| GET | `/admin/autopay/stats` | Get autopay statistics |

### Admin Streak Configuration Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/streak/config` | Get streak configuration |
| PUT | `/admin/streak/config` | Update streak configuration |
| PUT | `/admin/streak/enable` | Enable/disable streak system |
| POST | `/admin/streak/milestone` | Add a new milestone |
| PUT | `/admin/streak/milestone/:days` | Update a milestone |
| DELETE | `/admin/streak/milestone/:days` | Delete a milestone |
| DELETE | `/admin/streak/config` | Delete all streak configuration |
| GET | `/admin/streak/stats` | Get streak statistics |
