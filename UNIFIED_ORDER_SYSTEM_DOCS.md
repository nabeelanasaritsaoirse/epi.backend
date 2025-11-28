# 📚 Unified Order System - Complete Documentation

**Version:** 2.0
**Date:** November 27, 2025
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [App Frontend API Documentation](#app-frontend-api)
3. [Admin Frontend API Documentation](#admin-frontend-api)
4. [Backend Technical Documentation](#backend-technical-docs)
5. [Migration Guide](#migration-guide)
6. [Error Handling Reference](#error-handling)

---

## 🚀 Quick Start Guide

### What's New?

✅ **Quantity Support** - Order 1-10 items per order
✅ **Two Coupon Types** - INSTANT (reduce price) or REDUCE_DAYS (free last days)
✅ **One Payment Per Day** - Prevents duplicate payments
✅ **Combined Payment** - Pay multiple orders together
✅ **Enhanced Commission** - 10% default, auto 90-10 split
✅ **Wallet Integration** - Check balance, pay with wallet

### Route Changes

| OLD Route | NEW Route | Status |
|-----------|-----------|--------|
| `/api/orders/*` | `/api/orders/legacy/*` | ⚠️ Deprecated (6 existing orders) |
| `/api/installments/*` | `/api/orders/*` | ✅ Active (unified system) |

---

## 📱 App Frontend API Documentation

### Authentication

All endpoints require Bearer token:
```
Authorization: Bearer {user_token}
```

---

### 1. Create Order

**Endpoint:** `POST /api/orders/create`

**Description:** Create new installment order with quantity, variants, and coupons.

**Request Body:**
```json
{
  "productId": "6923f0026b65b26289a04f23",
  "quantity": 3,
  "variantId": "VAR-RED-L",
  "planOption": {
    "totalDays": 20,
    "dailyAmount": 200
  },
  "paymentMethod": "WALLET",
  "couponCode": "SAVE20",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

**Field Validations:**
- `quantity`: 1-10 (required, default: 1)
- `totalDays`: min 5, max 365
- `dailyAmount`: min ₹50
- `paymentMethod`: "RAZORPAY" or "WALLET"
- `phoneNumber`: 10 digits, starts 6-9
- `pincode`: 6 digits

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "ORD-20251127-A1F3",
      "status": "ACTIVE",
      "quantity": 3,
      "pricePerUnit": 1333,
      "totalProductPrice": 4000,
      "productPrice": 3800,
      "dailyPaymentAmount": 200,
      "totalDays": 20,
      "paidInstallments": 1,
      "totalPaidAmount": 200,
      "remainingAmount": 3600,
      "couponCode": "SAVE20",
      "couponType": "INSTANT",
      "couponDiscount": 200,
      "paymentSchedule": [
        {
          "installmentNumber": 1,
          "amount": 200,
          "dueDate": "2025-11-27",
          "status": "PAID",
          "isCouponBenefit": false
        },
        // ... more installments
      ]
    },
    "firstPayment": {
      "paymentId": "PAY-20251127-B2C4",
      "status": "COMPLETED",
      "amount": 200
    }
  }
}
```

**Coupon Types:**

1. **INSTANT** (reduces price immediately):
```
Original: ₹4000
Coupon: -₹200
Final: ₹3800 (pay ₹190/day for 20 days)
```

2. **REDUCE_DAYS** (free last days):
```
Price: ₹4000
Daily: ₹200
Coupon: ₹800 discount
Result: Last 4 days FREE
Schedule: Pay days 1-16 (₹200 each), days 17-20 FREE
```

---

### 2. Get User Orders

**Endpoint:** `GET /api/orders/my-orders`

**Query Parameters:**
- `status`: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
- `page`: number (default: 1)
- `limit`: number (default: 20)

**Example:**
```
GET /api/orders/my-orders?status=ACTIVE&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "ORD-20251127-A1F3",
      "productName": "Premium Headphones",
      "quantity": 2,
      "totalProductPrice": 8000,
      "status": "ACTIVE",
      "paidInstallments": 5,
      "totalInstallments": 20,
      "progress": 25,
      "remainingAmount": 6000,
      "nextDueDate": "2025-12-02"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15
  }
}
```

---

### 3. Get Daily Pending Payments

**Endpoint:** `GET /api/orders/payments/daily-pending`

**Description:** Get all pending payments due today or overdue.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "totalAmount": 600,
  "payments": [
    {
      "orderId": "ORD-20251127-A1F3",
      "productName": "Premium Headphones",
      "quantity": 2,
      "installmentNumber": 6,
      "amount": 200,
      "dueDate": "2025-11-27",
      "canPayToday": true
    },
    {
      "orderId": "ORD-20251127-B2F4",
      "productName": "Bouquet",
      "quantity": 1,
      "installmentNumber": 3,
      "amount": 200,
      "dueDate": "2025-11-27",
      "canPayToday": true
    },
    {
      "orderId": "ORD-20251126-C3D5",
      "productName": "Watch",
      "quantity": 1,
      "installmentNumber": 2,
      "amount": 200,
      "dueDate": "2025-11-26",
      "canPayToday": true,
      "isOverdue": true
    }
  ]
}
```

---

### 4. Process Single Payment

**Endpoint:** `POST /api/orders/payments/process`

**Description:** Pay single order installment (Wallet or Razorpay).

**Request Body (Wallet):**
```json
{
  "orderId": "ORD-20251127-A1F3",
  "paymentMethod": "WALLET"
}
```

**Request Body (Razorpay):**
```json
{
  "orderId": "ORD-20251127-A1F3",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "sig_..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "paymentId": "PAY-20251127-D4E5",
      "status": "COMPLETED",
      "amount": 200,
      "installmentNumber": 6
    },
    "order": {
      "orderId": "ORD-20251127-A1F3",
      "status": "ACTIVE",
      "paidInstallments": 6,
      "remainingInstallments": 14,
      "isCompleted": false
    },
    "commission": {
      "amount": 20,
      "availableAmount": 18,
      "lockedAmount": 2
    }
  },
  "message": "Payment successful. 14 installments remaining."
}
```

**Error (Already Paid Today):**
```json
{
  "success": false,
  "error": "You have already made a payment for this order today. Please try again tomorrow."
}
```

---

### 5. Pay Multiple Orders (Combined Payment)

**Endpoint:** `POST /api/orders/payments/pay-daily-selected`

**Description:** Pay multiple orders in one transaction.

**Request Body:**
```json
{
  "selectedOrders": [
    "ORD-20251127-A1F3",
    "ORD-20251127-B2F4",
    "ORD-20251126-C3D5"
  ],
  "paymentMethod": "RAZORPAY"
}
```

**Note:** If `selectedOrders` is empty, pays ALL pending orders for today.

**Step 1: Get Total Amount**

First, call `/api/orders/payments/daily-pending` to see total amount.

**Step 2: Create Razorpay Order** (if using Razorpay)

```javascript
// Frontend creates Razorpay order for total amount
const options = {
  amount: 60000,  // ₹600 in paise
  currency: 'INR',
  name: 'Epi Backend'
};

const razorpayOrder = await fetch('/api/orders/payments/create-combined-razorpay', {
  method: 'POST',
  body: JSON.stringify({ selectedOrders, totalAmount: 600 })
});
```

**Step 3: Process Combined Payment**

After user completes Razorpay payment:

```json
{
  "selectedOrders": [
    "ORD-20251127-A1F3",
    "ORD-20251127-B2F4",
    "ORD-20251126-C3D5"
  ],
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "sig_..."
}
```

**Response:**
```json
{
  "success": true,
  "totalAmount": 600,
  "ordersProcessed": 3,
  "payments": [
    {
      "orderId": "ORD-20251127-A1F3",
      "paymentId": "PAY-20251127-F1G2",
      "amount": 200,
      "installmentNumber": 6,
      "orderStatus": "ACTIVE"
    },
    {
      "orderId": "ORD-20251127-B2F4",
      "paymentId": "PAY-20251127-G2H3",
      "amount": 200,
      "installmentNumber": 3,
      "orderStatus": "ACTIVE"
    },
    {
      "orderId": "ORD-20251126-C3D5",
      "paymentId": "PAY-20251127-H3I4",
      "amount": 200,
      "installmentNumber": 2,
      "orderStatus": "COMPLETED"
    }
  ],
  "commissions": [
    { "orderId": "ORD-20251127-A1F3", "amount": 20 },
    { "orderId": "ORD-20251127-B2F4", "amount": 20 },
    { "orderId": "ORD-20251126-C3D5", "amount": 20 }
  ],
  "message": "Successfully processed payments for 3 orders"
}
```

---

### 6. Get Order Details

**Endpoint:** `GET /api/orders/:orderId`

**Response:**
```json
{
  "success": true,
  "order": {
    "orderId": "ORD-20251127-A1F3",
    "productName": "Premium Headphones",
    "quantity": 2,
    "pricePerUnit": 2000,
    "totalProductPrice": 4000,
    "productPrice": 4000,
    "couponCode": null,
    "status": "ACTIVE",
    "dailyPaymentAmount": 200,
    "totalDays": 20,
    "paidInstallments": 6,
    "totalPaidAmount": 1200,
    "remainingAmount": 2800,
    "progress": 30,
    "paymentSchedule": [
      // ... all 20 installments
    ],
    "deliveryStatus": "PENDING",
    "deliveryAddress": { /* ... */ },
    "createdAt": "2025-11-27T10:00:00.000Z",
    "lastPaymentDate": "2025-11-27T15:30:00.000Z"
  }
}
```

---

### 7. Cancel Order

**Endpoint:** `POST /api/orders/:orderId/cancel`

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "order": {
    "orderId": "ORD-20251127-A1F3",
    "status": "CANCELLED",
    "cancelledAt": "2025-11-27T16:00:00.000Z"
  }
}
```

---

### 8. Get Payment History

**Endpoint:** `GET /api/orders/payments/my-payments`

**Query Parameters:**
- `status`: 'COMPLETED' | 'PENDING' | 'FAILED'
- `page`: number
- `limit`: number

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "paymentId": "PAY-20251127-F1G2",
      "orderId": "ORD-20251127-A1F3",
      "amount": 200,
      "installmentNumber": 6,
      "status": "COMPLETED",
      "paymentMethod": "WALLET",
      "commissionAmount": 20,
      "completedAt": "2025-11-27T15:30:00.000Z"
    }
  ],
  "count": 25,
  "page": 1,
  "limit": 20
}
```

---

## 👨‍💼 Admin Frontend API Documentation

### Admin Authentication

All admin endpoints require admin role:
```
Authorization: Bearer {admin_token}
Headers: Admin role required
```

---

### 1. Dashboard Stats

**Endpoint:** `GET /api/orders/admin/dashboard/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalOrders": 150,
    "activeOrders": 85,
    "completedOrders": 60,
    "cancelledOrders": 5,
    "pendingApprovals": 12,
    "totalRevenue": 450000,
    "todayCollections": 8500,
    "totalCommissionPaid": 45000,
    "statusBreakdown": {
      "PENDING": 10,
      "ACTIVE": 85,
      "COMPLETED": 60,
      "CANCELLED": 5
    },
    "deliveryStatusBreakdown": {
      "PENDING": 72,
      "APPROVED": 12,
      "SHIPPED": 8,
      "DELIVERED": 58
    }
  }
}
```

---

### 2. Get All Orders

**Endpoint:** `GET /api/orders/admin/all`

**Query Parameters:**
- `status`: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
- `deliveryStatus`: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'DELIVERED'
- `search`: Search by orderId, user name, or product name
- `page`: number
- `limit`: number
- `sort`: '-createdAt' | 'createdAt'

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "ORD-20251127-A1F3",
      "user": {
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "9876543210"
      },
      "productName": "Premium Headphones",
      "quantity": 2,
      "totalProductPrice": 4000,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "paidInstallments": 6,
      "totalInstallments": 20,
      "progress": 30,
      "createdAt": "2025-11-27T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

---

### 3. Get Pending Approval Orders

**Endpoint:** `GET /api/orders/admin/pending-approval`

**Description:** Orders that are COMPLETED but delivery not yet approved.

**Response:**
```json
{
  "success": true,
  "count": 12,
  "orders": [
    {
      "orderId": "ORD-20251126-C3D5",
      "user": {
        "name": "Jane Smith",
        "phoneNumber": "9876543211"
      },
      "productName": "Watch",
      "totalProductPrice": 4000,
      "status": "COMPLETED",
      "deliveryStatus": "PENDING",
      "completedAt": "2025-11-26T18:00:00.000Z",
      "deliveryAddress": {
        "name": "Jane Smith",
        "phoneNumber": "9876543211",
        "addressLine1": "456 Park Ave",
        "city": "Delhi",
        "state": "Delhi",
        "pincode": "110001"
      }
    }
  ]
}
```

---

### 4. Approve Delivery

**Endpoint:** `POST /api/orders/admin/:orderId/approve-delivery`

**Description:** Approve delivery for completed order.

**Response:**
```json
{
  "success": true,
  "message": "Delivery approved successfully",
  "order": {
    "orderId": "ORD-20251126-C3D5",
    "deliveryStatus": "APPROVED",
    "deliveryApprovedAt": "2025-11-27T17:00:00.000Z"
  }
}
```

---

### 5. Update Delivery Status

**Endpoint:** `PUT /api/orders/admin/:orderId/delivery-status`

**Request Body:**
```json
{
  "deliveryStatus": "SHIPPED",
  "trackingNumber": "TRK123456789",
  "courierService": "Blue Dart"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery status updated",
  "order": {
    "orderId": "ORD-20251126-C3D5",
    "deliveryStatus": "SHIPPED",
    "trackingNumber": "TRK123456789",
    "courierService": "Blue Dart"
  }
}
```

---

### 6. Add Admin Notes

**Endpoint:** `PUT /api/orders/admin/:orderId/notes`

**Request Body:**
```json
{
  "adminNotes": "Customer requested gift wrapping. Added extra packing."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin notes added",
  "order": {
    "orderId": "ORD-20251126-C3D5",
    "adminNotes": "Customer requested gift wrapping. Added extra packing."
  }
}
```

---

### 7. Get All Payments

**Endpoint:** `GET /api/orders/admin/payments/all`

**Query Parameters:**
- `status`: 'COMPLETED' | 'PENDING' | 'FAILED'
- `method`: 'RAZORPAY' | 'WALLET'
- `orderId`: Filter by specific order
- `page`: number
- `limit`: number

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "paymentId": "PAY-20251127-F1G2",
      "order": {
        "orderId": "ORD-20251127-A1F3",
        "productName": "Premium Headphones"
      },
      "user": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "amount": 200,
      "installmentNumber": 6,
      "status": "COMPLETED",
      "paymentMethod": "WALLET",
      "commissionAmount": 20,
      "commissionPercentage": 10,
      "completedAt": "2025-11-27T15:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 50
  }
}
```

---

## 🔧 Backend Technical Documentation

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 CLIENT (App/Admin)               │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │    Routes Layer    │  (HTTP endpoints)
        │  - orderRoutes.js  │
        │  - legacy Routes   │
        └─────────┬─────────┘
                  │
        ┌─────────▼──────────┐
        │ Controllers Layer  │  (Request handling)
        │  - Validation      │
        │  - Response format │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │  Services Layer    │  (Business logic)
        │  - orderService    │
        │  - paymentService  │
        │  - commissionSvc   │
        │  - walletService   │
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │   Models Layer     │  (Data/DB)
        │  - InstallmentOrder│
        │  - PaymentRecord   │
        │  - Coupon          │
        └────────────────────┘
```

---

### Database Schema

#### InstallmentOrder Model

```javascript
{
  // Identification
  orderId: String (unique, "ORD-YYYYMMDD-XXXX"),

  // Relationships
  user: ObjectId (ref User),
  product: ObjectId (ref Product),
  referrer: ObjectId (ref User, optional),

  // ⭐ Quantity & Pricing
  quantity: Number (1-10, default: 1),
  pricePerUnit: Number (original price per unit),
  totalProductPrice: Number (pricePerUnit × quantity),
  productPrice: Number (final price after coupon if INSTANT),

  // Product Details
  productName: String,
  productSnapshot: Object (full product data),
  variantId: String (optional),
  variantDetails: Object (optional),

  // ⭐ Coupon
  couponCode: String (optional),
  couponDiscount: Number (default: 0),
  couponType: String ('INSTANT' | 'REDUCE_DAYS'),
  originalPrice: Number (before coupon),

  // Installment Plan
  totalDays: Number (min: 5),
  dailyPaymentAmount: Number (min: 50),
  paidInstallments: Number (default: 0),
  totalPaidAmount: Number (default: 0),
  remainingAmount: Number (calculated),

  // ⭐ Payment Schedule
  paymentSchedule: [{
    installmentNumber: Number,
    dueDate: Date,
    amount: Number,
    status: String ('PENDING' | 'PAID' | 'SKIPPED' | 'FREE'),
    isCouponBenefit: Boolean,  // ⭐ TRUE for FREE days
    paidDate: Date,
    paymentId: ObjectId (ref PaymentRecord)
  }],

  // Status
  status: String ('PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'),

  // Delivery
  deliveryAddress: {
    name: String (required),
    phoneNumber: String (required, 10 digits),
    addressLine1: String (required),
    addressLine2: String,
    city: String (required),
    state: String (required),
    pincode: String (required, 6 digits)
  },
  deliveryStatus: String ('PENDING' | 'APPROVED' | 'SHIPPED' | 'DELIVERED'),

  // ⭐ Commission
  commissionPercentage: Number (default: 10),
  productCommissionPercentage: Number,
  totalCommissionPaid: Number (default: 0),

  // ⭐ Payment Tracking
  firstPaymentMethod: String ('RAZORPAY' | 'WALLET'),
  firstPaymentId: ObjectId (ref PaymentRecord),
  firstPaymentCompletedAt: Date,
  lastPaymentDate: Date,  // ⭐ For one-per-day rule

  // Metadata
  orderNotes: String,
  adminNotes: String,
  cancellationReason: String,
  cancelledAt: Date,
  cancelledBy: ObjectId (ref User),
  completedAt: Date,

  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

---

### Business Logic

#### 1. Order Creation with Quantity

```javascript
// Step 1: Calculate pricing
pricePerUnit = variant ? variant.price : product.price;
totalProductPrice = pricePerUnit × quantity;

// Step 2: Apply coupon
if (couponType === 'INSTANT') {
  productPrice = totalProductPrice - couponDiscount;
  // User pays reduced price
} else if (couponType === 'REDUCE_DAYS') {
  productPrice = totalProductPrice;  // No price reduction
  // Last X days marked FREE in schedule
}

// Step 3: Calculate installments
dailyAmount = productPrice / totalDays;  // User-specified or calculated
```

#### 2. Coupon Application

**INSTANT Coupon:**
```javascript
Original: ₹4000 (₹2000 × 2 qty)
Coupon: -₹200
Final: ₹3800
Daily: ₹190 for 20 days
Schedule: All days at ₹190
```

**REDUCE_DAYS Coupon:**
```javascript
Price: ₹4000 (₹2000 × 2 qty)
Daily: ₹200
Coupon: ₹800 discount

Calculation:
fullDays = floor(800 / 200) = 4 days
remainder = 800 % 200 = ₹0

Schedule:
- Days 1-16: Pay ₹200 each
- Days 17-20: FREE (isCouponBenefit: true)
- Total paid: ₹3200
- Total saved: ₹800
```

**With Remainder:**
```javascript
Price: ₹1000
Daily: ₹50
Coupon: ₹175 discount

Calculation:
fullDays = floor(175 / 50) = 3 days
remainder = 175 % 50 = ₹25

Schedule:
- Days 1-16: Pay ₹50 each (₹800)
- Days 17-19: FREE (coupon benefit)
- Day 20: Pay ₹25 (reduced by remainder)
- Total paid: ₹825
- Total saved: ₹175
```

#### 3. One Payment Per Day Rule

```javascript
// Check before processing payment
function canPayToday(lastPaymentDate) {
  if (!lastPaymentDate) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);  // Midnight

  const lastPayment = new Date(lastPaymentDate);
  lastPayment.setHours(0, 0, 0, 0);

  // Different dates at midnight level
  return lastPayment.getTime() < today.getTime();
}

// Update after payment
order.lastPaymentDate = new Date();
```

#### 4. Combined Daily Payment

```javascript
// Flow:
// 1. Get all selected orders
// 2. Validate all can pay today
// 3. Calculate total amount
// 4. If WALLET: Deduct total, then distribute
// 5. If RAZORPAY: Verify single payment, then distribute
// 6. Create separate PaymentRecord for each order (same razorpayOrderId)
// 7. Update each order
// 8. Calculate commission for each payment
// 9. Commit transaction (all-or-nothing)

// Example:
Order 1: ₹200 → PaymentRecord 1 (razorpayOrderId: order_ABC)
Order 2: ₹200 → PaymentRecord 2 (razorpayOrderId: order_ABC)
Order 3: ₹200 → PaymentRecord 3 (razorpayOrderId: order_ABC)
Total: ₹600 → Single Razorpay transaction
```

#### 5. Commission Calculation

```javascript
// On EVERY payment (not just after completion)

// Get commission rate
commissionRate = order.commissionPercentage || 10;  // Default 10%

// Calculate on payment amount
commissionAmount = (paymentAmount × commissionRate) / 100;

// Credit to referrer (auto 90-10 split)
await walletService.creditCommissionToWallet(
  referrerId,
  commissionAmount,  // e.g., ₹20
  orderId,
  paymentId,
  session
);

// Result: ₹18 available, ₹2 locked
```

---

### Service Layer Architecture

#### installmentOrderService.js
- `createOrder()` - Create order with quantity, variants, coupons
- `getUserOrders()` - Get user's orders with filters
- `getOrderById()` - Get single order details
- `cancelOrder()` - Cancel order with reason
- `approveDelivery()` - Admin approve delivery
- `updateDeliveryStatus()` - Update delivery status

#### installmentPaymentService.js
- `processPayment()` - Process single payment (with one-per-day check)
- `getDailyPendingPayments()` - Get today's pending payments
- `processSelectedDailyPayments()` - ⭐ Combined payment for multiple orders
- `createRazorpayOrderForPayment()` - Create Razorpay order
- `verifyRazorpaySignature()` - Verify Razorpay payment
- `getPaymentHistory()` - Get payment history

#### commissionService.js
- `calculateAndCreditCommission()` - Calculate and credit commission
- `batchCalculateCommissions()` - Batch process for combined payment
- `getOrderCommissionSummary()` - Get commission summary

#### installmentWalletService.js (existing)
- `validateWalletBalance()` - Check sufficient balance
- `deductFromWallet()` - Deduct for payment
- `creditCommissionToWallet()` - Credit commission (auto 90-10 split)
- `getWalletBalance()` - Get wallet balance

---

### MongoDB Transactions

All payment operations use MongoDB transactions for ACID compliance:

```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Deduct wallet (if applicable)
  // 2. Create payment record
  // 3. Update order
  // 4. Update payment schedule
  // 5. Calculate and credit commission
  // 6. Check if order completed

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### Error Handling

Custom error classes in `utils/customErrors.js`:

```javascript
- OrderNotFoundError (404)
- ProductNotFoundError (404)
- UserNotFoundError (404)
- InsufficientWalletBalanceError (400)
- PaymentAlreadyProcessedError (409)
- InvalidPaymentMethodError (400)
- OrderAlreadyCompletedError (400)
- UnauthorizedOrderAccessError (403)
- InvalidPaymentAmountError (400)
- InvalidOrderStatusError (400)
- RazorpayVerificationError (400)
- ProductOutOfStockError (400)
- InvalidInstallmentDurationError (400)
- ValidationError (400)
- TransactionFailedError (500)
```

---

## 🔄 Migration Guide

### For Frontend Teams

#### App Frontend Changes

**Before (OLD System):**
```javascript
// Create order
POST /api/orders
{
  "productId": "...",
  "paymentOption": "daily",
  "paymentDetails": {
    "totalDays": 20
  }
}
```

**After (NEW System):**
```javascript
// Create order with quantity
POST /api/orders/create
{
  "productId": "...",
  "quantity": 2,  // ⭐ NEW
  "planOption": {
    "totalDays": 20,
    "dailyAmount": 200
  },
  "paymentMethod": "WALLET"
}
```

#### New Features to Implement

1. **Quantity Selector**
```javascript
<input type="number" min="1" max="10" value="1" />
```

2. **Daily Pending with Selection**
```javascript
// Get pending
const pending = await fetch('/api/orders/payments/daily-pending');

// Show checkboxes, let user select which orders
<Checkbox orderId={order.orderId} />

// Pay selected
await fetch('/api/orders/payments/pay-daily-selected', {
  body: JSON.stringify({
    selectedOrders: ['ORD-...', 'ORD-...'],
    paymentMethod: 'WALLET'
  })
});
```

3. **One Payment Per Day Indicator**
```javascript
{order.canPayToday ? (
  <Button>Pay Now</Button>
) : (
  <Text>Already paid today. Next payment: Tomorrow</Text>
)}
```

---

### For Backend Team

#### Code Changes Summary

**Files Modified:**
1. `models/InstallmentOrder.js` - Added quantity, lastPaymentDate, couponType, commissionPercentage
2. `models/CouponModel.js` - Created with couponType field
3. `utils/installmentHelpers.js` - Enhanced generatePaymentSchedule for REDUCE_DAYS
4. `services/installmentOrderService.js` - Added quantity & coupon logic
5. `services/installmentPaymentService.js` - Added one-per-day check, combined payment
6. `services/commissionService.js` - Created for commission calculation
7. `routes/orderRoutes.js` - New main routes (was installmentRoutes.js)
8. `routes/legacyOrderRoutes.js` - Deprecated old system routes
9. `index.js` - Updated route mounting

**Files Created:**
1. `models/CouponModel.js`
2. `services/commissionService.js`
3. `routes/orderRoutes.js` (copy of installmentRoutes.js)
4. `routes/legacyOrderRoutes.js` (copy of orders.js with deprecation)

**Database Migration:**
No migration needed! New fields have defaults. Existing orders continue working.

---

### Testing Checklist

#### Order Creation
- [ ] Create order with quantity 1
- [ ] Create order with quantity 5
- [ ] Create order with variant
- [ ] Create order with INSTANT coupon
- [ ] Create order with REDUCE_DAYS coupon
- [ ] Create order with REDUCE_DAYS coupon (with remainder)
- [ ] Create order with wallet payment
- [ ] Create order with Razorpay payment

#### Payment Processing
- [ ] Pay single order with wallet
- [ ] Pay single order with Razorpay
- [ ] Try to pay same order twice in one day (should fail)
- [ ] Pay order next day (should succeed)
- [ ] Pay combined payment (2 orders, wallet)
- [ ] Pay combined payment (3 orders, Razorpay)
- [ ] Verify commission credited on each payment

#### Admin Features
- [ ] Get dashboard stats
- [ ] Get all orders with filters
- [ ] Get pending approval orders
- [ ] Approve delivery
- [ ] Update delivery status to SHIPPED
- [ ] Add admin notes

---

## 📞 Support

**Issues:** Create issue on GitHub
**Questions:** Contact backend team
**Documentation:** This file + inline code comments

---

**End of Documentation**
**Last Updated:** November 27, 2025
