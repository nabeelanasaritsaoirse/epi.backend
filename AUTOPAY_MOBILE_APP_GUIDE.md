# Autopay System - Mobile App Integration Guide

## Overview

This document provides technical specifications for integrating the Autopay system into the Mobile Application. Users can enable automatic daily installment payments from their wallet balance.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Core Autopay APIs](#core-autopay-apis)
3. [Pause/Resume/Skip APIs](#pauseresumeskip-apis)
4. [Settings & Preferences](#settings--preferences)
5. [Dashboard & Analytics](#dashboard--analytics)
6. [Streak System](#streak-system)
7. [Push Notifications](#push-notifications)
8. [UI/UX Recommendations](#uiux-recommendations)
9. [Data Models](#data-models)
10. [Error Handling](#error-handling)

---

## Authentication

All user endpoints require a valid JWT token in the Authorization header.

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${userToken}`
};
```

---

## Core Autopay APIs

### 1. Enable Autopay for an Order

**Endpoint:** `POST /api/installments/autopay/enable/:orderId`

**Purpose:** Enable automatic payment for a specific installment order.

**URL Parameter:** `orderId` - The MongoDB ObjectId of the order

**Request Body (Optional):**
```json
{
  "priority": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| priority | number | No | Payment priority (1-100). Lower number = higher priority. Default: 1 |

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

**Error Responses:**
- `400`: "Order not found"
- `400`: "Autopay can only be enabled for active orders"
- `400`: "Order is already fully paid"

---

### 2. Disable Autopay for an Order

**Endpoint:** `POST /api/installments/autopay/disable/:orderId`

**Purpose:** Disable automatic payment for a specific order.

**Response:**
```json
{
  "success": true,
  "message": "Autopay disabled successfully",
  "data": {
    "orderId": "ORD123456",
    "productName": "iPhone 15",
    "autopay": {
      "enabled": false
    }
  }
}
```

---

### 3. Enable Autopay for All Orders

**Endpoint:** `POST /api/installments/autopay/enable-all`

**Purpose:** Enable autopay for all active installment orders at once.

**Response:**
```json
{
  "success": true,
  "message": "Autopay enabled for 3 orders",
  "data": {
    "enabledCount": 3,
    "orders": [
      { "orderId": "ORD123", "productName": "iPhone 15" },
      { "orderId": "ORD124", "productName": "MacBook Pro" },
      { "orderId": "ORD125", "productName": "iPad Air" }
    ]
  }
}
```

---

### 4. Disable Autopay for All Orders

**Endpoint:** `POST /api/installments/autopay/disable-all`

**Purpose:** Disable autopay for all orders at once.

**Response:**
```json
{
  "success": true,
  "message": "Autopay disabled for all orders",
  "data": {
    "disabledCount": 3
  }
}
```

---

## Pause/Resume/Skip APIs

### 1. Pause Autopay

**Endpoint:** `POST /api/installments/autopay/pause/:orderId`

**Purpose:** Temporarily pause autopay until a specified date.

**Request Body:**
```json
{
  "pauseUntil": "2024-01-25T00:00:00.000Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| pauseUntil | ISO Date String | Yes | Must be in future, maximum 30 days from today |

**Response:**
```json
{
  "success": true,
  "message": "Autopay paused until 2024-01-25",
  "data": {
    "orderId": "ORD123456",
    "autopay": {
      "enabled": true,
      "pausedUntil": "2024-01-25T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400`: "Pause date must be in the future"
- `400`: "Maximum pause period is 30 days"

---

### 2. Resume Autopay

**Endpoint:** `POST /api/installments/autopay/resume/:orderId`

**Purpose:** Resume autopay before the pause period ends.

**Response:**
```json
{
  "success": true,
  "message": "Autopay resumed successfully",
  "data": {
    "orderId": "ORD123456",
    "autopay": {
      "enabled": true,
      "pausedUntil": null
    }
  }
}
```

---

### 3. Add Skip Dates

**Endpoint:** `POST /api/installments/autopay/skip-dates/:orderId`

**Purpose:** Add specific dates when autopay should be skipped.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| dates | Array of date strings | Yes | Maximum 10 skip dates per order |

**Response:**
```json
{
  "success": true,
  "message": "Skip dates added successfully",
  "data": {
    "orderId": "ORD123456",
    "skipDates": [
      "2024-01-25T00:00:00.000Z",
      "2024-01-26T00:00:00.000Z",
      "2024-02-14T00:00:00.000Z"
    ]
  }
}
```

**Error Response:**
- `400`: "Maximum 10 skip dates allowed"

---

### 4. Remove Skip Date

**Endpoint:** `DELETE /api/installments/autopay/skip-dates/:orderId`

**Purpose:** Remove a previously added skip date.

**Request Body:**
```json
{
  "date": "2024-01-25"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Skip date removed successfully",
  "data": {
    "orderId": "ORD123456",
    "skipDates": [
      "2024-01-26T00:00:00.000Z",
      "2024-02-14T00:00:00.000Z"
    ]
  }
}
```

---

### Technical Notes on Skip Dates (For Developers)

**Last Updated:** February 11, 2026

The skip dates feature was updated to fix critical timezone and persistence bugs. Mobile app developers should be aware of the following:

#### Date Format Handling

**Backend Storage:**
- All skip dates are stored as **UTC midnight** (`00:00:00.000Z`)
- Format: ISO 8601 string (e.g., `2026-02-15T00:00:00.000Z`)

**Frontend Implementation:**

```javascript
// ✅ CORRECT: Send only date portion
const selectedDate = "2026-02-15"; // From date picker
await addSkipDates(orderId, [selectedDate]);

// ✅ CORRECT: Display date from response
const skipDates = response.data.skipDates; // ["2026-02-15T00:00:00.000Z"]
skipDates.forEach(dateStr => {
  const displayDate = dateStr.split('T')[0]; // "2026-02-15"
  // Show in UI
});

// ❌ WRONG: Don't use local timezone conversion for display
const wrongDate = new Date(dateStr).toLocaleDateString(); // May show wrong date!
```

**Date Picker Integration:**

```javascript
// When user selects date from calendar
function onDateSelected(dateObject) {
  // Convert to YYYY-MM-DD format
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const day = String(dateObject.getDate()).padStart(2, '0');

  const dateString = `${year}-${month}-${day}`;

  // Send to API
  addSkipDate(orderId, dateString);
}
```

**Calendar Display:**

```javascript
// Mark skip dates in calendar
function isSkipDate(calendarDate, skipDates) {
  const checkDate = calendarDate.toISOString().split('T')[0];

  return skipDates.some(skipDateStr => {
    const skipDate = skipDateStr.split('T')[0];
    return skipDate === checkDate;
  });
}
```

#### Bug Fixes Summary

**1. Timezone Consistency:**
- **Before:** Dates shifted based on server timezone (Feb 15 → Feb 16)
- **After:** All dates stored and compared in UTC (Feb 15 → Feb 15)

**2. Persistence:**
- **Before:** DELETE operation succeeded but dates reappeared
- **After:** Changes persist correctly to database

**Impact:** No impact on production users. Test data created before Feb 11, 2026 may have old format dates (`18:30:00.000Z` instead of `00:00:00.000Z`).

**Testing Recommendation:**
- Clear old test skip dates and create new ones after this update
- Verify calendar correctly highlights skip dates
- Test that deleted dates don't reappear after app restart/refresh

---

## Settings & Preferences

### 1. Update Autopay Settings

**Endpoint:** `PUT /api/installments/autopay/settings`

**Purpose:** Update global autopay settings for the user.

**Request Body:**
```json
{
  "enabled": true,
  "timePreference": "MORNING_6AM",
  "minimumBalanceLock": 200,
  "lowBalanceThreshold": 500,
  "sendDailyReminder": true,
  "reminderHoursBefore": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| enabled | boolean | No | Global enable/disable for autopay |
| timePreference | string | No | Payment time slot (see enum below) |
| minimumBalanceLock | number | No | Amount to reserve in wallet (will not be used for autopay) |
| lowBalanceThreshold | number | No | Alert when wallet balance falls below this |
| sendDailyReminder | boolean | No | Receive reminder before payment |
| reminderHoursBefore | number | No | Hours before payment to send reminder (1-12) |

**Time Preference Options:**
- `MORNING_6AM` - 6:00 AM IST
- `AFTERNOON_12PM` - 12:00 PM IST
- `EVENING_6PM` - 6:00 PM IST

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "settings": {
      "enabled": true,
      "timePreference": "MORNING_6AM",
      "minimumBalanceLock": 200,
      "lowBalanceThreshold": 500,
      "sendDailyReminder": true,
      "reminderHoursBefore": 1
    }
  }
}
```

---

### 2. Get Autopay Settings

**Endpoint:** `GET /api/installments/autopay/settings`

**Purpose:** Retrieve current autopay settings.

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

---

### 3. Get Autopay Status

**Endpoint:** `GET /api/installments/autopay/status`

**Purpose:** Get autopay status for all user's orders.

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
        "productImage": "https://...",
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

---

### 4. Set Order Priority

**Endpoint:** `PUT /api/installments/autopay/priority/:orderId`

**Purpose:** Set payment priority for an order (when wallet balance is limited).

**Request Body:**
```json
{
  "priority": 2
}
```

| Field | Type | Constraints |
|-------|------|-------------|
| priority | number | 1-100, lower = higher priority |

**Response:**
```json
{
  "success": true,
  "message": "Priority updated successfully",
  "data": {
    "orderId": "ORD123456",
    "priority": 2
  }
}
```

---

### 5. Update Notification Preferences

**Endpoint:** `PUT /api/installments/autopay/notification-preferences`

**Purpose:** Control which autopay notifications to receive.

**Request Body:**
```json
{
  "autopaySuccess": true,
  "autopayFailed": true,
  "lowBalanceAlert": true,
  "dailyReminder": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification preferences updated",
  "data": {
    "notificationPreferences": {
      "autopaySuccess": true,
      "autopayFailed": true,
      "lowBalanceAlert": true,
      "dailyReminder": true
    }
  }
}
```

---

## Dashboard & Analytics

### 1. Get Autopay Dashboard

**Endpoint:** `GET /api/installments/autopay/dashboard`

**Purpose:** Fetch comprehensive dashboard data for autopay overview screen.

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

---

### 2. Get Balance Forecast

**Endpoint:** `GET /api/installments/autopay/forecast`

**Purpose:** Get projected wallet balance over upcoming days.

**Query Parameters:**
| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| days | number | 30 | 1-90 |

**Example:** `/api/installments/autopay/forecast?days=30`

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

---

### 3. Get Autopay History

**Endpoint:** `GET /api/installments/autopay/history`

**Purpose:** Get historical autopay payment records.

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| page | number | 1 |
| limit | number | 20 |

**Example:** `/api/installments/autopay/history?page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2024-01-15T00:30:00.000Z",
        "orderId": "ORD123456",
        "productName": "iPhone 15",
        "amount": 100,
        "status": "SUCCESS",
        "paymentId": "PAY789"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "totalRecords": 95
    }
  }
}
```

---

### 4. Get Suggested Top-up

**Endpoint:** `GET /api/installments/autopay/suggested-topup`

**Purpose:** Calculate recommended wallet top-up amount.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | number | 7 | Number of days to cover |

**Response:**
```json
{
  "success": true,
  "data": {
    "currentBalance": 500,
    "availableForAutopay": 300,
    "dailyDeduction": 300,
    "daysRequested": 7,
    "suggestedTopUp": 1800,
    "breakdown": {
      "totalRequired": 2100,
      "currentAvailable": 300,
      "shortfall": 1800
    }
  }
}
```

---

## Streak System

The streak system rewards users for maintaining consistent payment streaks. **Note:** Streak rewards are configured by admin and may not be available if admin hasn't set them up.

### Get Streak Information

**Endpoint:** `GET /api/installments/autopay/streak`

**Purpose:** Get user's current streak status and available milestones.

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
        "achievedAt": "2024-01-10T00:30:00.000Z",
        "rewardAmount": 10
      }
    ],
    "nextMilestone": {
      "days": 30,
      "reward": 50,
      "badge": "MONTHLY_MASTER"
    },
    "daysUntilNextMilestone": 15,
    "allMilestones": [
      { "days": 7, "reward": 10, "badge": "WEEKLY_WARRIOR" },
      { "days": 30, "reward": 50, "badge": "MONTHLY_MASTER" },
      { "days": 60, "reward": 100, "badge": "CONSISTENCY_CHAMPION" }
    ],
    "isConfigured": true,
    "isEnabled": true
  }
}
```

**Important Fields:**
- `isConfigured`: Whether admin has set up streak rewards
- `isEnabled`: Whether streak rewards are currently active
- `allMilestones`: Empty array if not configured by admin
- `nextMilestone`: `null` if no milestones configured or all achieved

---

## Push Notifications

The app will receive the following push notification types:

### Notification Types

| Type | When Sent | Priority |
|------|-----------|----------|
| `AUTOPAY_SUCCESS` | After successful autopay | Normal |
| `AUTOPAY_FAILED` | When autopay fails | High |
| `LOW_BALANCE_ALERT` | When balance is insufficient for next day | High |
| `AUTOPAY_REMINDER` | Before scheduled payment | Normal |
| `STREAK_MILESTONE` | When user achieves a milestone | Normal |

### Notification Payload Examples

**Autopay Success:**
```json
{
  "type": "AUTOPAY_SUCCESS",
  "title": "Payment Successful",
  "body": "₹100 autopay completed for iPhone 15",
  "data": {
    "orderId": "ORD123456",
    "amount": 100,
    "productName": "iPhone 15"
  }
}
```

**Autopay Failed:**
```json
{
  "type": "AUTOPAY_FAILED",
  "title": "Autopay Failed",
  "body": "Insufficient balance for iPhone 15 payment",
  "data": {
    "orderId": "ORD123456",
    "reason": "INSUFFICIENT_BALANCE",
    "requiredAmount": 100,
    "availableBalance": 50
  }
}
```

**Low Balance Alert:**
```json
{
  "type": "LOW_BALANCE_ALERT",
  "title": "Low Balance Alert",
  "body": "Add ₹500 to continue autopay tomorrow",
  "data": {
    "currentBalance": 200,
    "requiredAmount": 700,
    "shortfall": 500
  }
}
```

**Streak Milestone:**
```json
{
  "type": "STREAK_MILESTONE",
  "title": "Streak Milestone!",
  "body": "Congratulations! 7-day streak achieved. ₹10 added to wallet!",
  "data": {
    "days": 7,
    "reward": 10,
    "badge": "WEEKLY_WARRIOR"
  }
}
```

---

## UI/UX Recommendations

### Autopay Toggle Screen

```
+------------------------------------------+
|  Autopay                        [Toggle] |
+------------------------------------------+
|                                          |
|  Time Preference                         |
|  [Morning 6AM] [Afternoon 12PM] [Eve 6PM]|
|                                          |
+------------------------------------------+
|  Wallet Protection                       |
|  Minimum Balance Lock: ₹[   200   ]      |
|  Low Balance Alert: ₹[   500   ]         |
+------------------------------------------+
|  Notifications                           |
|  [x] Payment Success                     |
|  [x] Payment Failed                      |
|  [x] Low Balance Alert                   |
|  [x] Daily Reminder                      |
+------------------------------------------+
```

### Order Card with Autopay

```
+------------------------------------------+
|  [Image]  iPhone 15                      |
|           Daily: ₹100 | Remaining: ₹5000 |
|           Progress: [=========>    ] 50% |
|                                          |
|  Autopay: [ON]  Priority: [1 ▼]          |
|                                          |
|  [Pause] [Skip Date] [History]           |
+------------------------------------------+
```

### Dashboard Overview

```
+------------------------------------------+
|  Wallet Balance: ₹2,500                  |
|  Available for Autopay: ₹2,300           |
+------------------------------------------+
|  Daily Deduction: ₹300                   |
|  Balance Lasts: 7 days                   |
|  Next Payment: Tomorrow 6:00 AM          |
+------------------------------------------+
|  Streak: 15 days 🔥                      |
|  Next Reward: 30 days (₹50)              |
|  [======>                     ] 15/30    |
+------------------------------------------+
|  [Top Up ₹800 for 7 more days]           |
+------------------------------------------+
```

### Streak Display

```
+------------------------------------------+
|  🔥 Current Streak: 15 days              |
|     Longest: 25 days                     |
+------------------------------------------+
|  Milestones                              |
|  [✓] 7 days  - ₹10 earned                |
|  [ ] 30 days - ₹50 reward                |
|  [ ] 60 days - ₹100 reward               |
|  [ ] 90 days - ₹200 reward               |
+------------------------------------------+
|  Total Earned: ₹60                       |
+------------------------------------------+
```

---

## Data Models

### Autopay Settings

```typescript
interface AutopaySettings {
  enabled: boolean;
  timePreference: 'MORNING_6AM' | 'AFTERNOON_12PM' | 'EVENING_6PM';
  minimumBalanceLock: number;
  lowBalanceThreshold: number;
  sendDailyReminder: boolean;
  reminderHoursBefore: number;
}
```

### Order Autopay Status

```typescript
interface OrderAutopay {
  enabled: boolean;
  priority: number;
  pausedUntil: string | null;
  skipDates: string[];
  isActive: boolean;
  successCount: number;
  failedCount: number;
  lastAttempt: {
    date: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'INSUFFICIENT_BALANCE';
    errorMessage?: string;
  } | null;
}
```

### Streak Data

```typescript
interface StreakData {
  current: number;
  longest: number;
  isActive: boolean;
  lastPaymentDate: string | null;
  totalRewardsEarned: number;
  milestonesAchieved: MilestoneAchieved[];
  nextMilestone: Milestone | null;
  daysUntilNextMilestone: number | null;
  allMilestones: Milestone[];
  isConfigured: boolean;
  isEnabled: boolean;
}

interface Milestone {
  days: number;
  reward: number;
  badge: string;
}

interface MilestoneAchieved extends Milestone {
  achievedAt: string;
  rewardAmount: number;
}
```

---

## Error Handling

### Common Error Responses

| HTTP Code | Message | User Action |
|-----------|---------|-------------|
| 400 | "Order not found" | Refresh order list |
| 400 | "Autopay can only be enabled for active orders" | Show message, disable toggle |
| 400 | "Order is already fully paid" | Show celebration, disable autopay |
| 400 | "Pause date must be in the future" | Show date picker validation |
| 400 | "Maximum pause period is 30 days" | Limit date picker range |
| 400 | "Maximum 10 skip dates allowed" | Show limit message |
| 400 | "Priority must be between 1 and 100" | Validate input |
| 401 | "Unauthorized" | Redirect to login |

### Error Handling Example

```javascript
async function enableAutopay(orderId) {
  try {
    const response = await fetch(`/api/installments/autopay/enable/${orderId}`, {
      method: 'POST',
      headers
    });

    const data = await response.json();

    if (!data.success) {
      // Show error toast
      showToast(data.message);
      return false;
    }

    // Success - update UI
    showToast('Autopay enabled successfully');
    return true;

  } catch (error) {
    showToast('Network error. Please try again.');
    return false;
  }
}
```

---

## API Summary Table

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/autopay/enable/:orderId` | Enable autopay for order |
| POST | `/autopay/disable/:orderId` | Disable autopay for order |
| POST | `/autopay/enable-all` | Enable for all orders |
| POST | `/autopay/disable-all` | Disable for all orders |
| POST | `/autopay/pause/:orderId` | Pause autopay |
| POST | `/autopay/resume/:orderId` | Resume autopay |
| POST | `/autopay/skip-dates/:orderId` | Add skip dates |
| DELETE | `/autopay/skip-dates/:orderId` | Remove skip date |
| PUT | `/autopay/settings` | Update settings |
| GET | `/autopay/settings` | Get settings |
| GET | `/autopay/status` | Get all orders status |
| PUT | `/autopay/priority/:orderId` | Set order priority |
| GET | `/autopay/dashboard` | Get dashboard data |
| GET | `/autopay/forecast` | Get balance forecast |
| GET | `/autopay/history` | Get payment history |
| GET | `/autopay/streak` | Get streak info |
| GET | `/autopay/suggested-topup` | Get top-up suggestion |
| PUT | `/autopay/notification-preferences` | Update notifications |

**Base URL:** `/api/installments`

---

## Cron Schedule Reference

| Time Slot | IST Time | UTC Time |
|-----------|----------|----------|
| MORNING_6AM | 6:00 AM | 00:30 UTC |
| AFTERNOON_12PM | 12:00 PM | 06:30 UTC |
| EVENING_6PM | 6:00 PM | 12:30 UTC |

Reminders are sent 1 hour before the selected time slot.
