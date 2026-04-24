# Coupon Admin Panel Guide

## Overview

This guide covers all admin endpoints for managing coupons in the admin panel. The coupon system now supports **12 advanced features** for creating, editing, and tracking coupon usage.

**Base URL:** `/api/coupons`

**Authentication:** All admin endpoints require `Authorization: Bearer <token>` header with admin privileges.

---

## New Features Summary

| Feature | Description |
|---------|-------------|
| Usage Limits | Set max total uses and per-user limits |
| Usage Tracking | Track who used coupon, when, which order |
| Edit Coupon | Update coupon settings after creation |
| First-Time User Only | Restrict to new users only |
| Product-Specific | Apply to specific products |
| Category-Specific | Apply to specific categories |
| Max Discount Cap | Limit max discount for percentage coupons |
| Payment Method Specific | Wallet-only or Razorpay-only |
| Win-Back Coupons | Target inactive users |
| Referral Coupons | Unique codes linked to referrers |
| Personal Codes | Auto-generated codes per user |
| Bulk Code Generation | Generate multiple unique codes |

---

## API Endpoints

### 1. Create Coupon

**POST** `/api/coupons/admin/create`

Creates a new coupon with all available options.

**Request Body:**

```json
{
  "couponCode": "SAVE20",
  "couponType": "INSTANT",
  "discountType": "percentage",
  "discountValue": 20,
  "minOrderValue": 1000,
  "expiryDate": "2026-12-31",
  "description": "Get 20% off on all products",

  "maxUsageCount": 100,
  "maxUsagePerUser": 1,

  "firstTimeUserOnly": false,
  "applicableProducts": [],
  "applicableCategories": [],

  "maxDiscountAmount": 500,
  "applicablePaymentMethods": ["WALLET", "RAZORPAY"],

  "isWinBackCoupon": false,
  "minDaysSinceLastOrder": null,

  "isStackable": false,
  "stackPriority": 0
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `couponCode` | string | Yes | Unique coupon code (auto-uppercase) |
| `couponType` | string | Yes | `INSTANT`, `REDUCE_DAYS`, or `MILESTONE_REWARD` |
| `discountType` | string | No | `flat` or `percentage` (not for MILESTONE) |
| `discountValue` | number | No | Discount amount or percentage |
| `minOrderValue` | number | No | Minimum order value required |
| `expiryDate` | date | Yes | Coupon expiry date |
| `description` | string | No | Description for users |
| `maxUsageCount` | number | No | Max total uses (null = unlimited) |
| `maxUsagePerUser` | number | No | Max uses per user (null = unlimited) |
| `firstTimeUserOnly` | boolean | No | Only for users with no orders |
| `applicableProducts` | array | No | Product IDs (empty = all) |
| `applicableCategories` | array | No | Category names (empty = all) |
| `maxDiscountAmount` | number | No | Cap for percentage coupons |
| `applicablePaymentMethods` | array | No | `WALLET`, `RAZORPAY`, or `ALL` |
| `isWinBackCoupon` | boolean | No | Target inactive users |
| `minDaysSinceLastOrder` | number | No | Days user must be inactive |
| `isStackable` | boolean | No | Can combine with other coupons |
| `stackPriority` | number | No | Order when stacking (lower = first) |
| `rewardCondition` | number | No | Payments required (MILESTONE only) |
| `rewardValue` | number | No | Free days awarded (MILESTONE only) |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "65abc123...",
      "couponCode": "SAVE20",
      "couponType": "INSTANT",
      "discountType": "percentage",
      "discountValue": 20,
      "maxUsageCount": 100,
      "currentUsageCount": 0,
      "isActive": true,
      "expiryDate": "2026-12-31T00:00:00.000Z"
    }
  }
}
```

---

### 2. Update Coupon

**PUT** `/api/coupons/admin/update/:id`

Update any coupon settings after creation.

**Request Body (all fields optional):**

```json
{
  "maxUsageCount": 200,
  "maxUsagePerUser": 2,
  "isActive": true,
  "expiryDate": "2027-06-30",
  "description": "Updated description",
  "minOrderValue": 500,
  "firstTimeUserOnly": true,
  "applicableProducts": ["product_id_1", "product_id_2"],
  "applicableCategories": ["Electronics"],
  "maxDiscountAmount": 1000,
  "applicablePaymentMethods": ["WALLET"],
  "isWinBackCoupon": true,
  "minDaysSinceLastOrder": 30,
  "isStackable": true,
  "stackPriority": 1
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    "coupon": {
      "_id": "65abc123...",
      "couponCode": "SAVE20",
      "maxUsageCount": 200,
      "currentUsageCount": 45,
      "isActive": true
    }
  }
}
```

---

### 3. Get Coupon Usage History

**GET** `/api/coupons/admin/usage/:id`

View detailed usage history including who used the coupon.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "couponCode": "SAVE20",
    "maxUsageCount": 100,
    "currentUsageCount": 45,
    "remainingUses": 55,
    "maxUsagePerUser": 1,
    "usageHistory": [
      {
        "user": {
          "_id": "user_id_1",
          "name": "John Doe",
          "email": "john@example.com",
          "phoneNumber": "+919876543210"
        },
        "orderId": {
          "_id": "order_id_1",
          "orderId": "ORD-20260115-A1B2",
          "productName": "Gold Coin 10g"
        },
        "usedAt": "2026-01-15T10:30:00.000Z",
        "discountApplied": 500
      },
      {
        "user": {
          "_id": "user_id_2",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "phoneNumber": "+919876543211"
        },
        "orderId": {
          "_id": "order_id_2",
          "orderId": "ORD-20260116-C3D4",
          "productName": "Silver Bar 100g"
        },
        "usedAt": "2026-01-16T14:45:00.000Z",
        "discountApplied": 800
      }
    ]
  }
}
```

---

### 4. Get All Coupons

**GET** `/api/coupons/admin/all`

Retrieve all coupons (including inactive).

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "65abc123...",
        "couponCode": "SAVE20",
        "couponType": "INSTANT",
        "discountType": "percentage",
        "discountValue": 20,
        "maxUsageCount": 100,
        "currentUsageCount": 45,
        "isActive": true,
        "expiryDate": "2026-12-31T00:00:00.000Z",
        "firstTimeUserOnly": false,
        "isReferralCoupon": false,
        "isPersonalCode": false
      }
    ]
  }
}
```

---

### 5. Get Single Coupon

**GET** `/api/coupons/admin/:id`

Get detailed information about a specific coupon.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "coupon": {
      "_id": "65abc123...",
      "couponCode": "SAVE20",
      "couponType": "INSTANT",
      "discountType": "percentage",
      "discountValue": 20,
      "minOrderValue": 1000,
      "maxUsageCount": 100,
      "currentUsageCount": 45,
      "maxUsagePerUser": 1,
      "firstTimeUserOnly": false,
      "applicableProducts": [],
      "applicableCategories": [],
      "maxDiscountAmount": 500,
      "applicablePaymentMethods": ["WALLET", "RAZORPAY"],
      "isWinBackCoupon": false,
      "isStackable": false,
      "isActive": true,
      "expiryDate": "2026-12-31T00:00:00.000Z",
      "usageHistory": []
    }
  }
}
```

---

### 6. Delete Coupon

**DELETE** `/api/coupons/admin/delete/:id`

Permanently delete a coupon.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

---

### 7. Create Referral Coupon

**POST** `/api/coupons/admin/create-referral-coupon`

Create a unique coupon code linked to a referrer. When someone uses this code, the referrer earns commission.

**Request Body:**

```json
{
  "userId": "referrer_user_id",
  "discountType": "percentage",
  "discountValue": 10,
  "commissionPercent": 10,
  "expiryDate": "2026-12-31"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Referral coupon JOHN8X4K created for John Doe",
  "data": {
    "coupon": {
      "_id": "65abc456...",
      "couponCode": "JOHN8X4K",
      "couponType": "INSTANT",
      "discountType": "percentage",
      "discountValue": 10,
      "linkedToReferrer": "referrer_user_id",
      "referrerCommissionPercent": 10,
      "isReferralCoupon": true,
      "isActive": true,
      "expiryDate": "2026-12-31T00:00:00.000Z"
    },
    "referrer": {
      "_id": "referrer_user_id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

**How Referral Coupons Work:**

1. Admin creates referral coupon for a user (referrer)
2. Referrer shares their unique code (e.g., "JOHN8X4K")
3. New user applies the code during order
4. **If user has no existing referrer:**
   - User is automatically linked to the referrer
   - Referrer earns commission on this order
   - Referrer will earn commission on all future orders from this user
5. **If user already has a referrer:**
   - Discount is applied but referrer is NOT changed
   - Original referrer continues earning commission

---

### 8. Generate Personal Codes

**POST** `/api/coupons/admin/generate-personal-codes`

Generate unique coupon codes for specific users. These codes can only be used by the assigned user.

**Request Body:**

```json
{
  "parentCouponId": "parent_coupon_id",
  "userIds": ["user_id_1", "user_id_2", "user_id_3"]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Generated 3 personal codes",
  "data": {
    "totalGenerated": 3,
    "codes": [
      {
        "userId": "user_id_1",
        "userName": "John Doe",
        "code": "SAVE20-X7K9M2"
      },
      {
        "userId": "user_id_2",
        "userName": "Jane Smith",
        "code": "SAVE20-P3Q8R1"
      },
      {
        "userId": "user_id_3",
        "userName": "Bob Wilson",
        "code": "SAVE20-T5Y2N6"
      }
    ]
  }
}
```

---

### 9. Generate Bulk Codes

**POST** `/api/coupons/admin/generate-bulk-codes`

Generate multiple unassigned unique codes based on a parent coupon. These can be distributed via marketing campaigns.

**Request Body:**

```json
{
  "parentCouponId": "parent_coupon_id",
  "count": 50
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Generated 50 bulk codes",
  "data": {
    "totalGenerated": 50,
    "codes": [
      "SAVE20-A1B2C3",
      "SAVE20-D4E5F6",
      "SAVE20-G7H8I9",
      "..."
    ]
  }
}
```

---

### 10. Get Child Coupons

**GET** `/api/coupons/admin/child-coupons/:id`

Get all personal/bulk codes generated from a parent coupon.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "parentCoupon": {
      "_id": "parent_id",
      "couponCode": "SAVE20",
      "couponType": "INSTANT"
    },
    "childCoupons": [
      {
        "_id": "child_id_1",
        "couponCode": "SAVE20-X7K9M2",
        "assignedToUser": {
          "_id": "user_id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "isPersonalCode": true,
        "currentUsageCount": 0
      },
      {
        "_id": "child_id_2",
        "couponCode": "SAVE20-A1B2C3",
        "assignedToUser": null,
        "isPersonalCode": true,
        "currentUsageCount": 1
      }
    ],
    "totalChildCoupons": 2
  }
}
```

---

## Admin Panel UI Integration

### Create Coupon Form Fields

```html
<!-- Basic Info -->
<input name="couponCode" placeholder="SAVE20" required />
<select name="couponType" required>
  <option value="INSTANT">Instant Discount</option>
  <option value="REDUCE_DAYS">Free Days</option>
  <option value="MILESTONE_REWARD">Milestone Reward</option>
</select>

<!-- Discount Settings (hide for MILESTONE) -->
<select name="discountType">
  <option value="flat">Flat (Rs.)</option>
  <option value="percentage">Percentage (%)</option>
</select>
<input name="discountValue" type="number" placeholder="20" />
<input name="maxDiscountAmount" type="number" placeholder="Max discount cap" />

<!-- Usage Limits -->
<input name="maxUsageCount" type="number" placeholder="Total uses (empty = unlimited)" />
<input name="maxUsagePerUser" type="number" placeholder="Per user limit (empty = unlimited)" />

<!-- Restrictions -->
<input name="minOrderValue" type="number" placeholder="Min order value" />
<input name="expiryDate" type="date" required />
<input name="firstTimeUserOnly" type="checkbox" /> First-time users only

<!-- Product/Category Selection -->
<select name="applicableProducts" multiple>
  <!-- Product options -->
</select>
<select name="applicableCategories" multiple>
  <!-- Category options -->
</select>

<!-- Payment Methods -->
<select name="applicablePaymentMethods" multiple>
  <option value="ALL">All Methods</option>
  <option value="WALLET">Wallet Only</option>
  <option value="RAZORPAY">Razorpay Only</option>
</select>

<!-- Win-Back Settings -->
<input name="isWinBackCoupon" type="checkbox" /> Win-back coupon
<input name="minDaysSinceLastOrder" type="number" placeholder="Days inactive" />

<!-- Stacking -->
<input name="isStackable" type="checkbox" /> Can stack with other coupons
<input name="stackPriority" type="number" placeholder="Priority (lower = first)" />
```

### Usage History Table

```html
<table>
  <thead>
    <tr>
      <th>User</th>
      <th>Email</th>
      <th>Phone</th>
      <th>Order ID</th>
      <th>Product</th>
      <th>Discount Applied</th>
      <th>Used At</th>
    </tr>
  </thead>
  <tbody>
    <!-- Loop through usageHistory -->
    <tr>
      <td>John Doe</td>
      <td>john@example.com</td>
      <td>+919876543210</td>
      <td>ORD-20260115-A1B2</td>
      <td>Gold Coin 10g</td>
      <td>Rs. 500</td>
      <td>15 Jan 2026, 10:30 AM</td>
    </tr>
  </tbody>
</table>
```

---

## Example Use Cases

### 1. First 10 Users Get Rs. 100 Off

```json
POST /api/coupons/admin/create
{
  "couponCode": "FIRST10",
  "couponType": "INSTANT",
  "discountType": "flat",
  "discountValue": 100,
  "maxUsageCount": 10,
  "maxUsagePerUser": 1,
  "expiryDate": "2026-12-31"
}
```

### 2. Welcome Coupon for New Users

```json
POST /api/coupons/admin/create
{
  "couponCode": "WELCOME50",
  "couponType": "INSTANT",
  "discountType": "percentage",
  "discountValue": 10,
  "maxDiscountAmount": 500,
  "firstTimeUserOnly": true,
  "expiryDate": "2026-12-31"
}
```

### 3. Category-Specific Coupon

```json
POST /api/coupons/admin/create
{
  "couponCode": "GOLD10",
  "couponType": "INSTANT",
  "discountType": "percentage",
  "discountValue": 10,
  "applicableCategories": ["Gold", "Gold Coins"],
  "expiryDate": "2026-12-31"
}
```

### 4. Wallet-Only Payment Coupon

```json
POST /api/coupons/admin/create
{
  "couponCode": "WALLET50",
  "couponType": "INSTANT",
  "discountType": "flat",
  "discountValue": 50,
  "applicablePaymentMethods": ["WALLET"],
  "description": "Rs. 50 off on wallet payments",
  "expiryDate": "2026-12-31"
}
```

### 5. Win-Back Coupon for Inactive Users

```json
POST /api/coupons/admin/create
{
  "couponCode": "COMEBACK20",
  "couponType": "INSTANT",
  "discountType": "percentage",
  "discountValue": 20,
  "maxDiscountAmount": 1000,
  "isWinBackCoupon": true,
  "minDaysSinceLastOrder": 30,
  "description": "20% off for users inactive for 30+ days",
  "expiryDate": "2026-12-31"
}
```

### 6. Referral Coupon for Influencer

```json
POST /api/coupons/admin/create-referral-coupon
{
  "userId": "influencer_user_id",
  "discountType": "percentage",
  "discountValue": 15,
  "commissionPercent": 10,
  "expiryDate": "2026-12-31"
}
```

---

## Error Responses

| Status | Message | Cause |
|--------|---------|-------|
| 400 | Coupon code is required | Missing couponCode |
| 400 | Coupon code already exists | Duplicate code |
| 400 | Invalid coupon type | Invalid couponType value |
| 400 | Expiry date is required | Missing expiryDate |
| 404 | Coupon not found | Invalid coupon ID |
| 404 | User not found | Invalid userId for referral coupon |
| 404 | Parent coupon not found | Invalid parentCouponId |
| 403 | Access denied | Not an admin |

---

## Backward Compatibility

All new features are backward compatible:

| Field | Default | Behavior for Old Coupons |
|-------|---------|--------------------------|
| `maxUsageCount` | null | Unlimited uses |
| `maxUsagePerUser` | null | Unlimited per user |
| `usageHistory` | [] | Empty, new uses will be tracked |
| `firstTimeUserOnly` | false | All users can use |
| `applicableProducts` | [] | All products |
| `applicableCategories` | [] | All categories |
| `maxDiscountAmount` | null | No cap |
| `applicablePaymentMethods` | [] | All methods |
| `isWinBackCoupon` | false | Not win-back |
| `isStackable` | false | Cannot stack |

---

**Last Updated:** January 2026
**Version:** 2.0
