# Autopay System - Admin Panel Integration Guide

## Overview

This document provides technical specifications for integrating the Autopay system into the Admin Panel. The admin has complete control over autopay monitoring, statistics, and streak reward configuration.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Autopay Management APIs](#autopay-management-apis)
3. [Streak Configuration APIs](#streak-configuration-apis)
4. [UI Component Recommendations](#ui-component-recommendations)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)

---

## Authentication

All admin endpoints require:
- Bearer token in Authorization header
- User must have admin role

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${adminToken}`
};
```

---

## Autopay Management APIs

### 1. Get Autopay Statistics

**Endpoint:** `GET /api/installments/admin/autopay/stats`

**Purpose:** Fetch overview statistics for the autopay system dashboard.

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

**UI Implementation:**
- Display `usersWithAutopay` and `ordersWithAutopay` as stat cards
- Create a pie/donut chart for `timePreferences` distribution
- Show `recentActivity` as a table with status badges

---

### 2. Get Users with Autopay Enabled

**Endpoint:** `GET /api/installments/admin/autopay/users`

**Purpose:** List all users who have enabled autopay functionality.

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
          "timePreference": "MORNING_6AM",
          "minimumBalanceLock": 200,
          "lowBalanceThreshold": 500
        },
        "walletBalance": 5000,
        "autopayOrderCount": 3
      }
    ]
  }
}
```

**UI Implementation:**
- Create a searchable/filterable data table
- Add filters for `timePreference`
- Show wallet balance with conditional styling (red if low)
- Display order count as a badge

---

### 3. Get Cron Job Status

**Endpoint:** `GET /api/installments/admin/autopay/cron-status`

**Purpose:** Monitor the status of autopay cron jobs.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": {
      "MORNING_6AM": { "running": true, "lastRun": "2024-01-15T00:30:00.000Z" },
      "AFTERNOON_12PM": { "running": true, "lastRun": "2024-01-15T06:30:00.000Z" },
      "EVENING_6PM": { "running": true, "lastRun": "2024-01-14T12:30:00.000Z" }
    },
    "serverTime": "2024-01-15T08:45:00.000Z",
    "timezone": "Asia/Kolkata"
  }
}
```

**UI Implementation:**
- Display each job with a status indicator (green/red)
- Show last run time in relative format ("2 hours ago")
- Display server time and timezone

---

### 4. Manual Trigger Autopay (Testing)

**Endpoint:** `POST /api/installments/admin/autopay/trigger`

**Purpose:** Manually trigger autopay processing for testing purposes.

**Request:**
```json
{
  "timeSlot": "MORNING_6AM"
}
```

**Valid timeSlot values:**
- `MORNING_6AM`
- `AFTERNOON_12PM`
- `EVENING_6PM`

**Response:**
```json
{
  "success": true,
  "message": "Autopay triggered for MORNING_6AM",
  "data": {
    "processedUsers": 15,
    "successfulPayments": 42,
    "failedPayments": 3,
    "totalAmount": 12500
  }
}
```

**UI Implementation:**
- Create a dropdown to select time slot
- Add a "Trigger" button with confirmation dialog
- Display results in a modal/toast after execution

---

## Streak Configuration APIs

The streak system allows admins to configure milestone rewards for users who maintain consistent payment streaks. **Important:** There are no hardcoded defaults - admin must configure all milestones.

### 1. Get Streak Configuration

**Endpoint:** `GET /api/installments/admin/streak/config`

**Purpose:** Fetch current streak configuration.

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
      {
        "days": 7,
        "reward": 10,
        "badge": "WEEKLY_WARRIOR",
        "description": "Complete 7 days streak",
        "isActive": true
      },
      {
        "days": 30,
        "reward": 50,
        "badge": "MONTHLY_MASTER",
        "description": "Complete 30 days streak",
        "isActive": true
      }
    ],
    "isConfigured": true,
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "updatedBy": "admin@example.com"
  }
}
```

**UI Implementation:**
- Show configuration status banner (configured/not configured)
- Display enable/disable toggle
- Show milestones in a sortable table
- Add "Last updated by" info

---

### 2. Update Streak Configuration

**Endpoint:** `PUT /api/installments/admin/streak/config`

**Purpose:** Update complete streak configuration (enable/disable and all milestones).

**Request:**
```json
{
  "enabled": true,
  "milestones": [
    {
      "days": 7,
      "reward": 10,
      "badge": "WEEKLY_WARRIOR",
      "description": "Complete 7 days streak",
      "isActive": true
    },
    {
      "days": 30,
      "reward": 50,
      "badge": "MONTHLY_MASTER",
      "description": "Complete 30 days streak",
      "isActive": true
    },
    {
      "days": 60,
      "reward": 100,
      "badge": "CONSISTENCY_CHAMPION",
      "description": "Complete 60 days streak",
      "isActive": true
    },
    {
      "days": 90,
      "reward": 200,
      "badge": "PLATINUM_PAYER",
      "description": "Complete 90 days streak",
      "isActive": true
    },
    {
      "days": 180,
      "reward": 500,
      "badge": "LEGENDARY_STREAK",
      "description": "Complete 180 days streak",
      "isActive": true
    }
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

**UI Implementation:**
- Create a form with milestone list
- Allow drag-and-drop reordering
- Validate that `days` values are unique
- Show success toast on save

---

### 3. Enable/Disable Streak System

**Endpoint:** `PUT /api/installments/admin/streak/enable`

**Purpose:** Quick toggle to enable or disable the streak reward system.

**Request:**
```json
{
  "enabled": true
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

**UI Implementation:**
- Use a toggle switch component
- Show confirmation dialog when disabling
- Display current status clearly

---

### 4. Add New Milestone

**Endpoint:** `POST /api/installments/admin/streak/milestone`

**Purpose:** Add a single new milestone to the configuration.

**Request:**
```json
{
  "days": 45,
  "reward": 75,
  "badge": "HALFWAY_HERO",
  "description": "Complete 45 days streak"
}
```

**Validation Rules:**
- `days`: Required, must be positive integer, must be unique
- `reward`: Required, must be non-negative number
- `badge`: Required, string identifier
- `description`: Optional, string

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 45 days added",
  "data": {
    "milestones": [...]
  }
}
```

**Error Response (Duplicate):**
```json
{
  "success": false,
  "message": "Milestone for 45 days already exists"
}
```

**UI Implementation:**
- Create an "Add Milestone" modal/drawer
- Validate `days` is not already used
- Auto-sort milestones by days after adding

---

### 5. Update Milestone

**Endpoint:** `PUT /api/installments/admin/streak/milestone/:days`

**Purpose:** Update a specific milestone by its days value.

**URL Parameter:** `days` - The current days value of the milestone to update

**Request:**
```json
{
  "days": 45,
  "reward": 80,
  "badge": "HALFWAY_HERO_V2",
  "description": "Updated description",
  "isActive": true
}
```

All fields are optional - only include fields you want to update.

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 45 days updated",
  "data": {
    "milestones": [...]
  }
}
```

**UI Implementation:**
- Create inline editing or edit modal
- Allow changing `days` value (validate uniqueness)
- Add `isActive` toggle to temporarily disable a milestone

---

### 6. Delete Milestone

**Endpoint:** `DELETE /api/installments/admin/streak/milestone/:days`

**Purpose:** Remove a specific milestone from the configuration.

**URL Parameter:** `days` - The days value of the milestone to delete

**Response:**
```json
{
  "success": true,
  "message": "Milestone for 45 days deleted",
  "data": {
    "milestones": [...]
  }
}
```

**UI Implementation:**
- Add delete button with confirmation dialog
- Warn about users who may have been close to achieving this milestone

---

### 7. Reset All Configuration

**Endpoint:** `DELETE /api/installments/admin/streak/config`

**Purpose:** Delete all streak configuration and reset to unconfigured state.

**Response:**
```json
{
  "success": true,
  "message": "Streak configuration deleted"
}
```

**UI Implementation:**
- Place in a "Danger Zone" section
- Require double confirmation
- Explain consequences clearly

---

### 8. Get Streak Statistics

**Endpoint:** `GET /api/installments/admin/streak/stats`

**Purpose:** Fetch statistics about streak performance across all users.

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

**UI Implementation:**
- Display stat cards for key metrics
- Create a leaderboard table for top users
- Show total rewards distributed prominently

---

## UI Component Recommendations

### Dashboard Layout

```
+------------------------------------------+
|  Autopay Overview                        |
+------------------------------------------+
| [Users: 25]  [Orders: 78]  [Active: Yes] |
+------------------------------------------+
|                                          |
|  Time Preference Distribution (Chart)    |
|                                          |
+------------------------------------------+
|  Recent Activity Table                   |
+------------------------------------------+
```

### Streak Configuration Layout

```
+------------------------------------------+
|  Streak Rewards Configuration            |
+------------------------------------------+
| Status: [Configured] [Toggle: Enabled]   |
+------------------------------------------+
|  Milestones                    [+ Add]   |
+------------------------------------------+
| Days | Reward | Badge          | Actions |
|------|--------|----------------|---------|
| 7    | ₹10    | WEEKLY_WARRIOR | Edit/Del|
| 30   | ₹50    | MONTHLY_MASTER | Edit/Del|
| 60   | ₹100   | CONSISTENCY... | Edit/Del|
+------------------------------------------+
|  [Reset All] (Danger Zone)               |
+------------------------------------------+
```

### Streak Statistics Layout

```
+------------------------------------------+
|  Streak Performance                      |
+------------------------------------------+
| [Users: 150] [Rewards: ₹25K] [Avg: 12]   |
+------------------------------------------+
|  Top Performers Leaderboard              |
+------------------------------------------+
| Rank | Name     | Streak | Rewards       |
|------|----------|--------|---------------|
| 1    | John Doe | 95     | ₹360          |
| 2    | Jane S.  | 82     | ₹310          |
+------------------------------------------+
```

---

## Data Models

### Milestone Object

```typescript
interface Milestone {
  days: number;        // Required, unique, positive integer
  reward: number;      // Required, non-negative number (wallet credit amount)
  badge: string;       // Required, identifier string
  description: string; // Optional, display description
  isActive: boolean;   // Whether this milestone is currently active
}
```

### Time Preference Enum

```typescript
enum TimePreference {
  MORNING_6AM = 'MORNING_6AM',
  AFTERNOON_12PM = 'AFTERNOON_12PM',
  EVENING_6PM = 'EVENING_6PM'
}
```

### Autopay Status Enum

```typescript
enum AutopayStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE'
}
```

---

## Technical Notes & Recent Updates

### Skip Dates API Fix (February 11, 2026)

**For Admin Panel Developers:**

The skip dates feature in the autopay system was updated to fix critical bugs. If you're integrating skip dates display/management in the admin panel, note the following:

#### Date Format
- **Storage:** All skip dates stored as UTC midnight (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Display:** Show only date portion (`YYYY-MM-DD`)

#### Bugs Fixed
1. **Timezone Issue:** Dates no longer shift based on server timezone
2. **Persistence Issue:** DELETE operations now properly save to database

#### Impact
- **Production:** No impact (feature not released to users before fix)
- **Test Data:** Old test dates may have format `18:30:00.000Z` instead of `00:00:00.000Z`

#### Admin Panel Implementation

```javascript
// Display skip dates in admin view
function displaySkipDates(skipDates) {
  return skipDates.map(dateStr => {
    // Extract date portion only
    return dateStr.split('T')[0]; // "2026-02-15"
  });
}

// When viewing user's autopay settings
const userOrders = await fetch('/api/installments/admin/autopay/users');
userOrders.data.users.forEach(user => {
  user.orders.forEach(order => {
    if (order.autopay?.skipDates?.length > 0) {
      const displayDates = displaySkipDates(order.autopay.skipDates);
      console.log(`Skip dates: ${displayDates.join(', ')}`);
    }
  });
});
```

**Testing Recommendation:**
- Clear old test skip dates and verify new ones display correctly
- Test date filtering and sorting in admin tables

---

## Error Handling

### Common Error Responses

| HTTP Code | Message | Cause |
|-----------|---------|-------|
| 400 | "days, reward, and badge are required" | Missing required fields |
| 400 | "Milestone for X days already exists" | Duplicate days value |
| 400 | "Milestone for X days not found" | Invalid days parameter |
| 400 | "enabled field is required" | Missing enabled field |
| 400 | "Invalid days parameter" | Non-numeric days in URL |
| 401 | "Unauthorized" | Missing or invalid token |
| 403 | "Forbidden" | User is not an admin |

### Error Handling Example

```javascript
try {
  const response = await fetch('/api/installments/admin/streak/milestone', {
    method: 'POST',
    headers,
    body: JSON.stringify(milestoneData)
  });

  const data = await response.json();

  if (!data.success) {
    // Show error toast
    showToast('error', data.message);
    return;
  }

  // Success - update UI
  showToast('success', data.message);
  refreshMilestones(data.data.milestones);

} catch (error) {
  showToast('error', 'Network error. Please try again.');
}
```

---

## API Summary Table

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/autopay/stats` | Get autopay statistics |
| GET | `/admin/autopay/users` | Get users with autopay |
| GET | `/admin/autopay/cron-status` | Get cron job status |
| POST | `/admin/autopay/trigger` | Manual trigger autopay |
| GET | `/admin/streak/config` | Get streak configuration |
| PUT | `/admin/streak/config` | Update streak configuration |
| PUT | `/admin/streak/enable` | Enable/disable streak |
| POST | `/admin/streak/milestone` | Add milestone |
| PUT | `/admin/streak/milestone/:days` | Update milestone |
| DELETE | `/admin/streak/milestone/:days` | Delete milestone |
| DELETE | `/admin/streak/config` | Reset all configuration |
| GET | `/admin/streak/stats` | Get streak statistics |

**Base URL:** `/api/installments`
