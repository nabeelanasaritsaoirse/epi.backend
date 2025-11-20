# Installment Order & Payment System - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Business Logic](#business-logic)
3. [API Endpoints](#api-endpoints)
4. [Testing Guide](#testing-guide)
5. [Error Handling](#error-handling)
6. [Database Models](#database-models)

---

## Overview

The installment order system allows users to purchase products by paying daily installments over a configurable period (minimum 5 days). Key features include:

- ✅ Flexible payment schedules (5-365 days based on product price)
- ✅ First payment processed immediately on order creation
- ✅ Automatic commission crediting (90-10 split)
- ✅ Support for Razorpay and Wallet payments
- ✅ MongoDB transactions for data consistency
- ✅ Idempotency to prevent duplicate payments
- ✅ Admin delivery approval workflow

---

## Business Logic

### Order Creation Rules

**Minimum Daily Payment:** ₹50

**Installment Duration Limits (based on product price):**
- ≤ ₹10,000 → Maximum 100 days
- ₹10,001 - ₹50,000 → Maximum 180 days
- > ₹50,000 → Maximum 365 days

**First Payment:**
- Must be processed immediately when creating order
- Can be paid via Razorpay or Wallet
- Order status becomes `ACTIVE` after first payment

### Payment Processing Rules

**Flexible Payment:**
- Users can skip days (no penalty)
- Users can pay multiple installments in one day
- Payment schedule tracks which specific installments are paid

**Commission System:**
- Calculated on EVERY payment (not after order completion)
- Commission percentage comes from Product model
- Auto-split: 90% available for withdrawal, 10% locked for investment
- Only credited if user has a referrer

**Order Completion:**
- Order marked `COMPLETED` when total paid ≥ product price
- Admin must approve delivery before shipping
- Users notified when order is ready for delivery

---

## API Endpoints

### Base URL
```
http://localhost:3000/api/installment
```

---

## USER ENDPOINTS

### 1. Create Order

**POST** `/orders`

Creates a new installment order with first payment.

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "totalDays": 30,
  "dailyAmount": 100,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "landmark": "Near Central Park"
  }
}
```

**Field Validation:**
- `productId` (required): Valid MongoDB ObjectId
- `totalDays` (required): Number, min 5, max based on product price
- `dailyAmount` (optional): Number, min 50. Auto-calculated if not provided
- `paymentMethod` (required): `RAZORPAY` or `WALLET`
- `deliveryAddress` (required): Complete address object

**Success Response (Wallet):**
```json
{
  "success": true,
  "message": "Order created successfully. First payment completed via wallet.",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "iPhone 15 Pro",
      "productPrice": 120000,
      "dailyPaymentAmount": 4000,
      "totalDays": 30,
      "paidInstallments": 1,
      "totalPaidAmount": 4000,
      "remainingAmount": 116000,
      "status": "ACTIVE",
      "progress": 3.33
    },
    "firstPayment": {
      "paymentId": "PAY-20241120-B7E1",
      "amount": 4000,
      "installmentNumber": 1,
      "status": "COMPLETED"
    }
  },
  "meta": {
    "timestamp": "2024-11-20T10:30:00.000Z"
  }
}
```

**Success Response (Razorpay):**
```json
{
  "success": true,
  "message": "Order created successfully. Please complete payment via Razorpay.",
  "data": {
    "order": { /* order details */ },
    "firstPayment": { /* payment record */ },
    "razorpayOrder": {
      "id": "order_MXkj8d9sKLm2Pq",
      "amount": 400000,
      "currency": "INR",
      "keyId": "rzp_test_xxxxx"
    }
  }
}
```

---

### 2. Get User Orders

**GET** `/orders`

Retrieves user's orders with optional filters.

**Authentication:** Required

**Query Parameters:**
- `status` (optional): `PENDING`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- `limit` (optional): Number, default 50, max 100
- `page` (optional): Page number

**Example:**
```
GET /api/installment/orders?status=ACTIVE&limit=20&page=1
```

**Response:**
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": {
    "orders": [
      {
        "_id": "64a1b2c3d4e5f6789012345",
        "orderId": "ORD-20241120-A3F2",
        "productName": "iPhone 15 Pro",
        "productPrice": 120000,
        "totalPaidAmount": 12000,
        "remainingAmount": 108000,
        "status": "ACTIVE",
        "progress": 10,
        "createdAt": "2024-11-15T10:00:00.000Z"
      }
    ],
    "count": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

### 3. Get Order Details

**GET** `/orders/:orderId`

Get detailed information about a specific order.

**Authentication:** Required (must own the order)

**Response:**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "user": { /* user details */ },
      "product": { /* product details */ },
      "productPrice": 120000,
      "dailyPaymentAmount": 4000,
      "totalDays": 30,
      "paidInstallments": 3,
      "totalPaidAmount": 12000,
      "remainingAmount": 108000,
      "paymentSchedule": [
        {
          "installmentNumber": 1,
          "dueDate": "2024-11-15T00:00:00.000Z",
          "amount": 4000,
          "status": "PAID",
          "paidDate": "2024-11-15T10:30:00.000Z"
        }
        // ... more installments
      ],
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "deliveryAddress": { /* address details */ }
    }
  }
}
```

---

### 4. Create Razorpay Order for Payment

**POST** `/payments/create-razorpay-order`

Creates a Razorpay order for the next installment payment.

**Authentication:** Required

**Request Body:**
```json
{
  "orderId": "ORD-20241120-A3F2"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Razorpay order created successfully. Proceed with payment.",
  "data": {
    "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
    "amount": 400000,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx",
    "installmentNumber": 2,
    "orderDetails": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "iPhone 15 Pro",
      "dailyAmount": 4000
    }
  }
}
```

---

### 5. Process Payment

**POST** `/payments/process`

Process an installment payment (Razorpay or Wallet).

**Authentication:** Required

**Request Body (Razorpay):**
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
  "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
  "razorpaySignature": "e3a2f8c9d1b4..."
}
```

**Request Body (Wallet):**
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "WALLET"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully. 27 installment(s) remaining. Commission credited to referrer: ₹800",
  "data": {
    "payment": {
      "paymentId": "PAY-20241120-C8D2",
      "amount": 4000,
      "installmentNumber": 2,
      "status": "COMPLETED",
      "commissionAmount": 800
    },
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "totalPaidAmount": 16000,
      "remainingAmount": 104000,
      "remainingInstallments": 27,
      "progress": 13.33,
      "isCompleted": false
    },
    "commission": {
      "amount": 800,
      "availableAmount": 720,
      "lockedAmount": 80,
      "referrer": "Jane Smith"
    }
  }
}
```

---

### 6. Get Payment Schedule

**GET** `/orders/:orderId/schedule`

Get the complete payment schedule for an order.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Payment schedule retrieved successfully",
  "data": {
    "schedule": [
      {
        "installmentNumber": 1,
        "dueDate": "2024-11-15T00:00:00.000Z",
        "amount": 4000,
        "status": "PAID",
        "paidDate": "2024-11-15T10:30:00.000Z"
      },
      {
        "installmentNumber": 2,
        "dueDate": "2024-11-16T00:00:00.000Z",
        "amount": 4000,
        "status": "PENDING",
        "paidDate": null
      }
      // ... 28 more installments
    ],
    "summary": {
      "totalInstallments": 30,
      "paidInstallments": 1,
      "pendingInstallments": 29,
      "skippedInstallments": 0
    }
  }
}
```

---

### 7. Cancel Order

**POST** `/orders/:orderId/cancel`

Cancel an order (only if not completed).

**Authentication:** Required

**Request Body:**
```json
{
  "reason": "Found a better deal elsewhere"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "CANCELLED",
      "cancelledAt": "2024-11-20T15:00:00.000Z",
      "cancellationReason": "Found a better deal elsewhere"
    }
  }
}
```

---

## ADMIN ENDPOINTS

### 1. Get Dashboard Statistics

**GET** `/admin/orders/dashboard/stats`

Get comprehensive dashboard statistics.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Dashboard statistics retrieved successfully",
  "data": {
    "stats": {
      "orders": {
        "total": 150,
        "byStatus": {
          "PENDING": 10,
          "ACTIVE": 80,
          "COMPLETED": 55,
          "CANCELLED": 5
        },
        "active": 80,
        "pendingApproval": 12
      },
      "deliveryStatus": {
        "PENDING": 12,
        "APPROVED": 30,
        "SHIPPED": 8,
        "DELIVERED": 5
      },
      "revenue": {
        "totalRevenue": 2500000,
        "totalCommission": 500000,
        "totalPayments": 450
      },
      "payments": {
        "byMethod": {
          "RAZORPAY": {
            "count": 250,
            "totalAmount": 1500000,
            "totalCommission": 300000
          },
          "WALLET": {
            "count": 200,
            "totalAmount": 1000000,
            "totalCommission": 200000
          }
        }
      }
    }
  }
}
```

---

### 2. Get Pending Approval Orders

**GET** `/admin/orders/pending-approval`

Get orders awaiting delivery approval.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Pending approval orders retrieved successfully",
  "data": {
    "orders": [
      {
        "orderId": "ORD-20241115-X9Y2",
        "user": {
          "name": "John Doe",
          "email": "john@example.com",
          "phoneNumber": "9876543210"
        },
        "productName": "iPhone 15 Pro",
        "productPrice": 120000,
        "totalPaidAmount": 120000,
        "status": "COMPLETED",
        "deliveryStatus": "PENDING",
        "completedAt": "2024-11-18T12:00:00.000Z",
        "deliveryAddress": { /* full address */ }
      }
    ],
    "count": 12
  }
}
```

---

### 3. Approve Delivery

**POST** `/admin/orders/:orderId/approve-delivery`

Approve delivery for a completed order.

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Delivery approved successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241115-X9Y2",
      "deliveryStatus": "APPROVED",
      "deliveryApprovedBy": "64a1b2c3d4e5f6789012999",
      "deliveryApprovedAt": "2024-11-20T16:00:00.000Z"
    }
  }
}
```

---

### 4. Update Delivery Status

**PUT** `/admin/orders/:orderId/delivery-status`

Update delivery status.

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "status": "SHIPPED"
}
```

**Valid Status Values:**
- `PENDING`
- `APPROVED`
- `SHIPPED`
- `DELIVERED`

**Response:**
```json
{
  "success": true,
  "message": "Delivery status updated to SHIPPED",
  "data": {
    "order": {
      "orderId": "ORD-20241115-X9Y2",
      "deliveryStatus": "SHIPPED"
    }
  }
}
```

---

## Testing Guide

### Prerequisites

1. **Environment Variables** (`.env` file):
```env
MONGODB_URI=mongodb://127.0.0.1:27017/epi_backend
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret_key
JWT_SECRET=your-jwt-secret
```

2. **Test User with Wallet Balance**
3. **Test Product in Database**
4. **Admin User for Admin Endpoints**

---

### Test Case 1: Create Order with Wallet Payment

**Step 1:** Get authentication token
```bash
# Login first to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Step 2:** Create order
```bash
curl -X POST http://localhost:3000/api/installment/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "64a1b2c3d4e5f6789012345",
    "totalDays": 30,
    "paymentMethod": "WALLET",
    "deliveryAddress": {
      "name": "John Doe",
      "phoneNumber": "9876543210",
      "addressLine1": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    }
  }'
```

**Expected Result:**
- ✅ Order created with status `ACTIVE`
- ✅ First payment deducted from wallet
- ✅ Payment schedule generated with first installment marked `PAID`
- ✅ Commission credited to referrer (if exists)

---

### Test Case 2: Process Daily Payment (Wallet)

```bash
curl -X POST http://localhost:3000/api/installment/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-20241120-A3F2",
    "paymentMethod": "WALLET"
  }'
```

**Expected Result:**
- ✅ Payment processed successfully
- ✅ Wallet balance deducted
- ✅ Order `totalPaidAmount` increased
- ✅ Commission credited to referrer
- ✅ Payment schedule updated
- ✅ If last payment, order marked `COMPLETED`

---

### Test Case 3: Process Payment with Razorpay

**Step 1:** Create Razorpay order
```bash
curl -X POST http://localhost:3000/api/installment/payments/create-razorpay-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-20241120-A3F2"
  }'
```

**Step 2:** Complete payment on Razorpay (frontend)

**Step 3:** Verify payment
```bash
curl -X POST http://localhost:3000/api/installment/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-20241120-A3F2",
    "paymentMethod": "RAZORPAY",
    "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
    "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
    "razorpaySignature": "signature_from_razorpay"
  }'
```

**Expected Result:**
- ✅ Razorpay signature verified
- ✅ Payment recorded
- ✅ Order updated
- ✅ Commission credited

---

### Test Case 4: Admin Approve Delivery

```bash
curl -X POST http://localhost:3000/api/installment/admin/orders/ORD-20241120-A3F2/approve-delivery \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Result:**
- ✅ Delivery status changed to `APPROVED`
- ✅ Admin ID and timestamp recorded

---

### Test Case 5: Idempotency Check

**Try to process the same installment twice:**

```bash
# First payment
curl -X POST http://localhost:3000/api/installment/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-20241120-A3F2",
    "paymentMethod": "WALLET"
  }'

# Immediate retry (should fail)
curl -X POST http://localhost:3000/api/installment/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORD-20241120-A3F2",
    "paymentMethod": "WALLET"
  }'
```

**Expected Result:**
- ✅ First request succeeds
- ✅ Second request returns error: `PAYMENT_ALREADY_PROCESSED`
- ✅ No duplicate charges

---

## Error Handling

### Common Error Responses

**1. Insufficient Wallet Balance**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance",
    "details": {
      "required": 4000,
      "available": 2500,
      "shortfall": 1500
    }
  },
  "meta": {
    "timestamp": "2024-11-20T10:30:00.000Z"
  }
}
```

**2. Order Not Found**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found",
    "details": {
      "orderId": "ORD-20241120-XXXX"
    }
  }
}
```

**3. Order Already Completed**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_COMPLETED",
    "message": "Order has already been completed. All payments received.",
    "details": {
      "orderId": "ORD-20241120-A3F2"
    }
  }
}
```

**4. Invalid Payment Method**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAYMENT_METHOD",
    "message": "Invalid payment method",
    "details": {
      "provided": "CASH",
      "allowed": ["RAZORPAY", "WALLET"]
    }
  }
}
```

**5. Validation Error**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": [
        {
          "field": "totalDays",
          "message": "Total days must be a number and at least 5"
        },
        {
          "field": "deliveryAddress.phoneNumber",
          "message": "Invalid phone number format"
        }
      ]
    }
  }
}
```

---

## Database Models

### InstallmentOrder

**Collection:** `installmentorders`

**Key Fields:**
- `orderId`: Unique order identifier (auto-generated)
- `user`: Reference to User
- `product`: Reference to Product
- `productPrice`: Product price at time of order
- `totalDays`: Total installment days
- `dailyPaymentAmount`: Daily payment amount
- `paymentSchedule`: Array of payment schedule items
- `status`: `PENDING`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- `deliveryStatus`: `PENDING`, `APPROVED`, `SHIPPED`, `DELIVERED`
- `referrer`: Reference to referrer User (optional)
- `totalCommissionPaid`: Total commission paid to referrer

### PaymentRecord

**Collection:** `paymentrecords`

**Key Fields:**
- `paymentId`: Unique payment identifier (auto-generated)
- `order`: Reference to InstallmentOrder
- `user`: Reference to User
- `amount`: Payment amount
- `installmentNumber`: Which installment this payment is for
- `paymentMethod`: `RAZORPAY` or `WALLET`
- `status`: `PENDING`, `COMPLETED`, `FAILED`
- `idempotencyKey`: Prevents duplicate processing
- `commissionAmount`: Commission credited for this payment
- `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`: Razorpay details

---

## Commission Flow

### 1. Order Created with First Payment
```
User pays ₹4000 (first installment)
↓
Product commission: 20%
↓
Commission = ₹4000 × 20% = ₹800
↓
Split: 90% available (₹720), 10% locked (₹80)
↓
Referrer wallet updated:
  - balance += ₹720
  - holdBalance += ₹80
  - referralBonus += ₹800
↓
WalletTransaction created (type: 'referral_bonus', amount: ₹720)
WalletTransaction created (type: 'investment', amount: ₹80)
```

### 2. Every Subsequent Payment
```
Same commission calculation and crediting process
on EVERY payment, not after order completion
```

---

## Security Features

1. **Authentication:** All endpoints require JWT token
2. **Authorization:** Admin endpoints require admin role
3. **Input Sanitization:** XSS prevention on all inputs
4. **Validation:** Comprehensive request validation
5. **Idempotency:** Prevents duplicate payment processing
6. **MongoDB Transactions:** Ensures data consistency
7. **Razorpay Signature Verification:** Prevents payment fraud

---

## Performance Considerations

1. **Database Indexes:** Added on frequently queried fields
2. **Population:** Selective field population to reduce data transfer
3. **Pagination:** All list endpoints support pagination
4. **Transaction Optimization:** Minimal operations within transactions

---

## Monitoring & Logging

All errors are logged with:
- Error name and message
- Request URL, method, body, params
- User ID (if authenticated)
- Stack trace (development mode)

Example log:
```javascript
{
  name: 'InsufficientWalletBalanceError',
  message: 'Insufficient wallet balance',
  url: '/api/installment/orders',
  method: 'POST',
  userId: '64a1b2c3d4e5f6789012345',
  body: { productId: '...', paymentMethod: 'WALLET' }
}
```

---

## Future Enhancements

1. **Webhook Support:** Real-time Razorpay payment notifications
2. **Email Notifications:** Order creation, payment reminders
3. **SMS Notifications:** Payment confirmations
4. **Analytics Dashboard:** Revenue trends, popular products
5. **Refund System:** Handle payment refunds
6. **Partial Payments:** Allow custom payment amounts
7. **Auto-payment:** Automatic wallet deductions on due dates

---

## Support

For issues or questions:
1. Check error response for specific error codes
2. Review validation messages in error details
3. Ensure all required fields are provided
4. Verify authentication token is valid
5. Check MongoDB and Razorpay connectivity

---

**System Status:** ✅ Production Ready
**Last Updated:** November 20, 2024
**Version:** 1.0.0
