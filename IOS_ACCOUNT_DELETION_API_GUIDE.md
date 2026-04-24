# Account Deletion API Guide (iOS App Store Compliance)

This document explains how to integrate the account deletion feature in the iOS app. These APIs comply with Apple's App Store requirement that users must be able to delete their account from within the app.

---

## Overview / How It Works

1. **User requests** account deletion from the app
2. **Admin reviews** the request and approves or rejects it
3. **On approval**, the user's account is immediately deactivated (cannot use the app)
4. **After 30 days**, the account and all user data are permanently deleted by an automated system

---

## Complete API Reference

### Base URL

```
Production: https://your-api-domain.com
```

All endpoints require the `Authorization` header:

```
Authorization: Bearer <user_jwt_token>
```

---

## 1. Get Deletion Info (What Data Will Be Deleted)

Show this information to the user before they submit the deletion request. This helps the user understand the impact.

**Endpoint:**

```
GET /api/users/:userId/deletion-info
```

**Headers:**

```
Authorization: Bearer <user_token>
```

**Success Response (200):**

```json
{
  "success": true,
  "deletionInfo": {
    "dataToBeDeleted": [
      "Your profile information (name, email, phone)",
      "Profile picture",
      "All saved addresses",
      "Bank account details",
      "KYC documents and verification status",
      "Wallet balance and transaction history",
      "Wishlist items",
      "Referral code and referral history",
      "All app preferences and settings"
    ],
    "dataCounts": {
      "addresses": 2,
      "bankAccounts": 1,
      "kycDocuments": 3,
      "transactions": 15,
      "wishlistItems": 5,
      "walletBalance": 250.00
    },
    "retentionPeriod": "30 days",
    "note": "After deletion, this action cannot be undone. Some data may be retained for legal and compliance purposes as per our Privacy Policy."
  }
}
```

---

## 2. Request Account Deletion

Call this API when the user confirms they want to delete their account.

**Endpoint:**

```
POST /api/users/:userId/request-deletion
```

**Headers:**

```
Authorization: Bearer <user_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "reason": "I no longer use this app"
}
```

| Field  | Type   | Required | Description                    |
|--------|--------|----------|--------------------------------|
| reason | string | No       | Why the user wants to delete   |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Account deletion request submitted. It will be reviewed by our team."
}
```

**Error Responses:**

| Status | When                                      | Response                                                    |
|--------|-------------------------------------------|-------------------------------------------------------------|
| 400    | User already has a pending/approved request | `{ "success": false, "message": "A deletion request is already active for this account", "currentStatus": "pending" }` |
| 403    | Trying to delete another user's account   | `{ "success": false, "message": "You can only delete your own account" }` |
| 404    | User not found                            | `{ "success": false, "message": "User not found" }`        |

---

## 3. Cancel Deletion Request

The user can cancel their deletion request **only while it is still pending** (before admin approves it). Once approved, cancellation is not possible.

**Endpoint:**

```
POST /api/users/:userId/cancel-deletion
```

**Headers:**

```
Authorization: Bearer <user_token>
```

**No request body required.**

**Success Response (200):**

```json
{
  "success": true,
  "message": "Account deletion request cancelled successfully"
}
```

**Error Responses:**

| Status | When                                | Response                                                          |
|--------|-------------------------------------|-------------------------------------------------------------------|
| 400    | No active deletion request exists   | `{ "success": false, "message": "No active deletion request found" }` |
| 400    | Request is already approved/rejected | `{ "success": false, "message": "Cannot cancel deletion request with status: approved. Only pending requests can be cancelled." }` |
| 403    | Unauthorized                        | `{ "success": false, "message": "Unauthorized" }`                |

---

## 4. Check Deletion Request Status

To check the current status of a user's deletion request, use the **Get User Profile** API. The `deletionRequest` field will be present in the user object if a request exists.

**The `deletionRequest` object in the user profile:**

```json
{
  "deletionRequest": {
    "requestedAt": "2026-02-04T10:30:00.000Z",
    "reason": "I no longer use this app",
    "status": "pending",
    "approvedAt": null,
    "scheduledDeletionDate": null,
    "rejectedAt": null,
    "rejectedReason": null
  }
}
```

**Possible `status` values:**

| Status      | Meaning                                        |
|-------------|------------------------------------------------|
| `pending`   | Request submitted, waiting for admin review    |
| `approved`  | Admin approved, account deactivated, data will be deleted after 30 days |
| `rejected`  | Admin rejected the request (see `rejectedReason`) |
| `cancelled` | User cancelled the request                     |
| `completed` | Account has been permanently deleted           |

---

## 5. What Happens After Approval

When an admin approves the deletion request:

1. **Account is immediately deactivated** (`isActive = false`)
2. The user will receive a **403 error** on all API calls with the response:
   ```json
   {
     "success": false,
     "message": "Account is disabled",
     "code": "ACCOUNT_DISABLED"
   }
   ```
3. `scheduledDeletionDate` is set to **30 days from approval**
4. After 30 days, an automated system permanently deletes all user data

---

## iOS Implementation Guide

### Recommended Screen Flow

```
Settings Screen
  |
  v
"Delete My Account" button
  |
  v
Deletion Info Screen (call GET /deletion-info)
  - Show what data will be deleted
  - Show wallet balance warning
  - Show "30 day review period" notice
  |
  v
Confirmation Dialog
  - "Are you sure you want to delete your account?"
  - Optional: Ask reason (text field)
  - [Cancel] [Delete Account]
  |
  v
Call POST /request-deletion
  |
  v
Success Screen
  - "Your request has been submitted"
  - "Our team will review it. You can cancel anytime before approval."
  - [Cancel Deletion Request] button
```

### Handling the ACCOUNT_DISABLED Response

After admin approves the deletion, the user's token will start returning 403 errors. Handle this in your API client:

```swift
// In your API interceptor / network layer
if response.statusCode == 403,
   let code = responseBody["code"] as? String,
   code == "ACCOUNT_DISABLED" {
    // Clear local user session
    // Navigate to login screen
    // Show message: "Your account has been deactivated and is scheduled for deletion."
}
```

### Showing Deletion Status in Settings

If the user has an active deletion request, show the status in the Settings screen:

```swift
// Check if deletionRequest exists in user profile
if let deletionRequest = user.deletionRequest {
    switch deletionRequest.status {
    case "pending":
        // Show: "Deletion request pending review"
        // Show: [Cancel Request] button
    case "approved":
        // Show: "Account scheduled for deletion on {scheduledDeletionDate}"
        // No cancel button (cannot cancel after approval)
    case "rejected":
        // Show: "Deletion request rejected: {rejectedReason}"
        // Show: [Request Again] button
    case "cancelled":
        // Show normal "Delete Account" button
    default:
        // Show normal "Delete Account" button
    }
}
```

---

## Quick Reference

| Action               | Method | Endpoint                                    | Auth     |
|----------------------|--------|---------------------------------------------|----------|
| Get deletion info    | GET    | `/api/users/:userId/deletion-info`          | User     |
| Request deletion     | POST   | `/api/users/:userId/request-deletion`       | User     |
| Cancel request       | POST   | `/api/users/:userId/cancel-deletion`        | User     |

### Admin APIs (for admin panel, not for iOS app)

| Action               | Method | Endpoint                                              | Auth        |
|----------------------|--------|-------------------------------------------------------|-------------|
| List all requests    | GET    | `/api/admin-mgmt/deletion-requests`                   | Super Admin |
| Approve request      | PUT    | `/api/admin-mgmt/deletion-requests/:userId/approve`   | Super Admin |
| Reject request       | PUT    | `/api/admin-mgmt/deletion-requests/:userId/reject`    | Super Admin |

---

## Deletion Request Lifecycle

```
User requests deletion
        |
        v
    [PENDING] -----> User cancels -----> [CANCELLED]
        |
        v
  Admin reviews
     /       \
    v         v
[APPROVED]  [REJECTED]
    |             |
    |             v
    |        User can request again
    v
Account deactivated (isActive = false)
User gets 403 on all API calls
    |
    v
30 days pass (automated cron job)
    |
    v
[COMPLETED] - All data permanently deleted
```

---

## Important Notes

1. **The `:userId` in all URLs** should be replaced with the logged-in user's ID
2. **Reason field is optional** but recommended for analytics
3. **Users can only cancel while status is `pending`** - once admin approves, cancellation is not possible
4. **After approval, user cannot use the app** - all API calls will return 403
5. **Data deletion is permanent** after the 30-day period - it cannot be recovered
6. **Apple App Store Review**: Ensure the "Delete Account" option is easily accessible from the app's Settings/Profile screen
