# Order Systems Comparison - Complete Documentation

**Date:** November 26, 2025
**Purpose:** Compare OLD and NEW order systems to decide on merger strategy

---

## 📊 System Overview

| Aspect | OLD System | NEW Installment System |
|--------|-----------|------------------------|
| **Endpoint Base** | `/api/orders` | `/api/installments/orders` |
| **Model** | `Order.js` | `InstallmentOrder.js` |
| **Routes** | `routes/orders.js` | `routes/installmentRoutes.js` |
| **Controllers** | `controllers/orderController.js` | `controllers/installmentOrderController.js` |
| **Services** | Direct in controller | `services/installmentOrderService.js` |
| **Current Usage** | ✅ 6 orders active | ❌ 0 orders (bug fixed) |

---

## 🔄 COMPLETE ORDER FLOW COMPARISON

### **OLD SYSTEM - Step by Step Flow**

#### **1. Order Creation**
```http
POST /api/orders
Authorization: Bearer {token}

{
  "productId": "6923f0026b65b26289a04f23",
  "paymentOption": "daily",
  "paymentDetails": {
    "totalDays": 20,        // Option 1: Specify days (backend calculates dailyAmount)
    "dailyAmount": 200      // Option 2: Specify amount (backend calculates days)
  },
  "couponCode": "SAVE20",   // Optional
  "deliveryAddress": {      // Optional
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "phone": "9876543210"
  }
}
```

**Backend Processing:**
1. ✅ Validates product exists and available
2. ✅ Calculates `dailyAmount` OR `totalDays` (whichever not provided)
3. ✅ Applies coupon discount (if provided)
4. ✅ Creates Razorpay order for first EMI
5. ✅ Creates Order document with status: `pending`
6. ✅ Creates Transaction record
7. ✅ Returns Razorpay order details for payment

**Response:**
```json
{
  "success": true,
  "order": {
    "_id": "6924111df747a104fdda414e",
    "orderId": "ORD-20251124-A1B2",
    "orderStatus": "pending",
    "paymentStatus": "pending",
    "orderAmount": 4000,
    "totalEmis": 20,
    "currentEmiNumber": 0,
    "totalPaid": 0,
    "product": { ... }
  },
  "payment": {
    "transaction_id": "txn_xyz123",
    "razorpay_order_id": "order_Mxyz..."
  }
}
```

#### **2. First EMI Payment Verification**
```http
POST /api/orders/{orderId}/verify-payment

{
  "razorpay_payment_id": "pay_abc123",
  "razorpay_signature": "sig_xyz789",
  "transaction_id": "txn_xyz123"
}
```

**Backend Processing:**
1. ✅ Verifies Razorpay signature
2. ✅ Updates order: `currentEmiNumber = 1`, `totalPaid += dailyAmount`
3. ✅ Updates order status to `confirmed`
4. ✅ Updates transaction status to `success`
5. ✅ **Triggers referral commission (20%)** immediately
6. ✅ Credits commission to referrer's wallet
7. ✅ Sends confirmation notifications

#### **3. Subsequent EMI Payments**
```http
# Create payment intent
POST /api/orders/{orderId}/create-payment
{
  "paymentAmount": 200
}

# Response: { transaction_id: "txn_new123", razorpay_order_id: "..." }

# Verify payment
POST /api/orders/{orderId}/verify-payment
{
  "razorpay_payment_id": "pay_new123",
  "razorpay_signature": "sig_new456",
  "transaction_id": "txn_new123"
}
```

**Backend Processing (each payment):**
1. ✅ Updates `currentEmiNumber++`
2. ✅ Updates `totalPaid += dailyAmount`
3. ✅ **Triggers commission on EVERY payment** (20%)
4. ✅ Checks if `totalPaid >= orderAmount`
5. ✅ If fully paid: `orderStatus = 'completed'`, `paymentStatus = 'completed'`
6. ✅ Auto-marks order as completed

#### **4. Order Tracking**
```http
GET /api/orders/user/history
```

**Response:**
```json
{
  "orders": [
    {
      "_id": "...",
      "orderId": "ORD-20251124-A1B2",
      "orderStatus": "confirmed",
      "paymentStatus": "partial",
      "orderAmount": 4000,
      "totalPaid": 800,
      "currentEmiNumber": 4,
      "totalEmis": 20,
      "product": { ... }
    }
  ]
}
```

---

### **NEW INSTALLMENT SYSTEM - Step by Step Flow**

#### **1. Order Creation**
```http
POST /api/installments/orders
Authorization: Bearer {token}

{
  "productId": "6923f0026b65b26289a04f23",
  "totalDays": 20,                    // REQUIRED (not nested)
  "dailyAmount": 200,                 // Optional (backend calculates if not provided)
  "paymentMethod": "RAZORPAY",        // REQUIRED: "RAZORPAY" or "WALLET"
  "variantId": "VAR123",              // Optional: Product variant selection
  "couponCode": "SAVE20",             // Optional
  "deliveryAddress": {                // REQUIRED (all fields mandatory)
    "name": "John Doe",               // REQUIRED
    "phoneNumber": "9876543210",      // REQUIRED (10 digits, starts 6-9)
    "addressLine1": "123 Main Street",// REQUIRED
    "city": "Mumbai",                 // REQUIRED
    "state": "Maharashtra",           // REQUIRED
    "pincode": "400001"               // REQUIRED (6 digits)
  }
}
```

**Backend Processing:**
1. ✅ Validates user exists
2. ✅ Validates product exists and in stock
3. ✅ **Handles product variants** (if variantId provided)
4. ✅ Applies coupon discount with validation
5. ✅ Validates installment duration (min 5 days, max based on price)
6. ✅ Validates minimum daily amount (₹50)
7. ✅ **Generates complete payment schedule** for all days
8. ✅ Gets referrer info from user
9. ✅ Creates product snapshot for history
10. ✅ **Uses MongoDB Transaction** for atomicity
11. ✅ If WALLET: Deducts first payment immediately
12. ✅ If RAZORPAY: Creates Razorpay order
13. ✅ **Auto-generates orderId** (ORD-YYYYMMDD-XXXX format)
14. ✅ Creates InstallmentOrder document
15. ✅ Creates first PaymentRecord with idempotency
16. ✅ If WALLET payment: Triggers commission immediately

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "67456...",
      "orderId": "ORD-20251126-A1F3",     // ✅ Auto-generated
      "status": "ACTIVE",                  // or "PENDING" for Razorpay
      "productName": "Premium Headphones",
      "productPrice": 4000,
      "dailyPaymentAmount": 200,
      "totalDays": 20,
      "totalInstallments": 20,
      "paidInstallments": 1,               // 1 if WALLET, 0 if RAZORPAY
      "totalPaidAmount": 200,
      "remainingAmount": 3800,
      "paymentSchedule": [                 // ✅ Complete schedule
        {
          "installmentNumber": 1,
          "amount": 200,
          "dueDate": "2025-11-26",
          "status": "PAID"                 // or "PENDING"
        },
        {
          "installmentNumber": 2,
          "amount": 200,
          "dueDate": "2025-11-27",
          "status": "PENDING"
        }
        // ... all 20 installments
      ],
      "deliveryStatus": "PENDING",
      "referrer": "referrerId",
      "productCommissionPercentage": 20,
      "totalCommissionPaid": 40
    },
    "firstPayment": {
      "_id": "...",
      "paymentId": "PAY-20251126-B2C4",
      "status": "COMPLETED",               // or "PENDING"
      "amount": 200,
      "installmentNumber": 1
    },
    "razorpayOrder": {                     // Only if RAZORPAY
      "razorpayOrderId": "order_Mxyz...",
      "amount": 20000,                     // in paise
      "keyId": "rzp_test_..."
    }
  },
  "message": "Order created successfully..."
}
```

#### **2. Subsequent Payments**

```http
# Step 1: Create Razorpay order for next installment
POST /api/installments/payments/create-razorpay-order

{
  "orderId": "67456..."                    // MongoDB _id or orderId
}

# Response:
{
  "razorpayOrderId": "order_New123",
  "amount": 20000,
  "currency": "INR",
  "keyId": "rzp_test_...",
  "installmentNumber": 2,
  "orderDetails": { ... }
}

# Step 2: Process payment
POST /api/installments/payments/process

{
  "orderId": "67456...",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_New123",
  "razorpayPaymentId": "pay_Xyz456",
  "razorpaySignature": "sig_Abc789"
}
```

**Backend Processing (each payment):**
1. ✅ Validates order ownership and status
2. ✅ Gets next pending installment from schedule
3. ✅ **Checks idempotency** (prevents duplicate processing)
4. ✅ Verifies Razorpay signature
5. ✅ **MongoDB Transaction** starts
6. ✅ Creates PaymentRecord with complete details
7. ✅ Updates order: `paidInstallments++`, `totalPaidAmount += amount`
8. ✅ Updates payment schedule: marks installment as PAID
9. ✅ Checks if fully paid: sets `status = 'COMPLETED'`
10. ✅ **Calculates and credits commission** (if referrer exists)
11. ✅ Updates payment record with commission details
12. ✅ **Commits transaction** (all or nothing)

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "paymentId": "PAY-20251126-C3D5",
      "status": "COMPLETED",
      "amount": 200,
      "installmentNumber": 2,
      "commissionAmount": 40,
      "commissionPercentage": 20
    },
    "order": {
      "orderId": "ORD-20251126-A1F3",
      "status": "ACTIVE",
      "paidInstallments": 2,
      "remainingInstallments": 18,
      "totalPaidAmount": 400,
      "remainingAmount": 3600,
      "isCompleted": false
    },
    "commission": {
      "amount": 40,
      "availableAmount": 32,           // 80% of commission
      "lockedAmount": 8,               // 20% locked
      "referrer": "Referrer Name"
    }
  },
  "message": "Payment processed successfully. 18 installment(s) remaining."
}
```

#### **3. Get Daily Pending Payments**
```http
GET /api/installments/payments/daily-pending
```

**Backend Processing:**
1. ✅ Finds all ACTIVE orders for user
2. ✅ Filters payment schedule for TODAY's date
3. ✅ Returns only PENDING installments due today
4. ✅ Calculates total amount due

**Response:**
```json
{
  "count": 2,
  "totalAmount": 400,
  "payments": [
    {
      "orderId": "ORD-20251126-A1F3",
      "productName": "Premium Headphones",
      "installmentNumber": 3,
      "amount": 200,
      "dueDate": "2025-11-26T00:00:00.000Z"
    },
    {
      "orderId": "ORD-20251126-B2F4",
      "productName": "Bouquet",
      "installmentNumber": 2,
      "amount": 200,
      "dueDate": "2025-11-26T00:00:00.000Z"
    }
  ]
}
```

#### **4. Get Order Details**
```http
GET /api/installments/orders/{orderId}
```

**Response:**
```json
{
  "order": {
    "orderId": "ORD-20251126-A1F3",
    "status": "ACTIVE",
    "productName": "Premium Headphones",
    "productPrice": 4000,
    "totalDays": 20,
    "dailyPaymentAmount": 200,
    "paidInstallments": 2,
    "totalInstallments": 20,
    "totalPaidAmount": 400,
    "remainingAmount": 3600,
    "paymentSchedule": [ ... ],        // All 20 installments with status
    "deliveryStatus": "PENDING",
    "deliveryAddress": { ... },
    "createdAt": "2025-11-26T...",
    "firstPaymentCompletedAt": "2025-11-26T..."
  }
}
```

#### **5. Get Payment History**
```http
GET /api/installments/payments/my-payments?status=COMPLETED&limit=20
```

**Response:**
```json
{
  "payments": [
    {
      "paymentId": "PAY-20251126-C3D5",
      "orderId": "ORD-20251126-A1F3",
      "amount": 200,
      "installmentNumber": 2,
      "status": "COMPLETED",
      "paymentMethod": "RAZORPAY",
      "commissionAmount": 40,
      "processedAt": "2025-11-26T...",
      "completedAt": "2025-11-26T..."
    }
  ],
  "count": 10,
  "page": 1,
  "limit": 20
}
```

#### **6. Order Cancellation**
```http
POST /api/installments/orders/{orderId}/cancel

{
  "reason": "Customer requested cancellation due to financial constraints"
}
```

**Backend Processing:**
1. ✅ Validates order can be cancelled
2. ✅ Updates status to CANCELLED
3. ✅ Records cancellation reason
4. ✅ May process refund (if applicable)

---

## 🎯 FEATURES COMPARISON

### **Payment & Order Features**

| Feature | OLD System | NEW System |
|---------|-----------|-----------|
| **Order ID Generation** | Manual | ✅ Auto (ORD-YYYYMMDD-XXXX) |
| **Payment Schedule** | ❌ No pre-generated | ✅ Complete schedule created |
| **Daily Pending API** | ❌ Not available | ✅ `/payments/daily-pending` |
| **Idempotency** | ❌ No | ✅ Prevents duplicate payments |
| **MongoDB Transactions** | ❌ No | ✅ Full ACID compliance |
| **Payment Method** | Razorpay only | ✅ Razorpay OR Wallet |
| **First Payment** | Razorpay only | ✅ Immediate if Wallet |
| **Flexible Days** | ✅ Yes | ✅ Yes (min 5 days) |
| **Flexible Amount** | ✅ Yes | ✅ Yes (min ₹50) |
| **Auto-completion** | ✅ Yes | ✅ Yes |

### **Product & Discount Features**

| Feature | OLD System | NEW System |
|---------|-----------|-----------|
| **Product Variants** | ❌ No | ✅ Full variant support |
| **Coupon Codes** | ✅ Basic | ✅ Advanced validation |
| **Product Snapshot** | ❌ No | ✅ Full snapshot saved |
| **Stock Management** | ✅ Basic | ✅ Advanced (+ variants) |
| **Price Override** | ❌ No | ✅ Via variants |

### **Commission & Referral**

| Feature | OLD System | NEW System |
|---------|-----------|-----------|
| **Commission on Every Payment** | ✅ Yes (20%) | ✅ Yes (configurable%) |
| **Auto Credit** | ✅ Yes | ✅ Yes |
| **Locked/Available Split** | ❌ No | ✅ 80% available, 20% locked |
| **Commission Tracking** | ✅ Basic | ✅ Detailed per payment |
| **Multi-tier Commission** | ❌ No | ✅ Ready for implementation |

### **Data & Validation**

| Feature | OLD System | NEW System |
|---------|-----------|-----------|
| **Delivery Address** | Optional | ✅ Required with validation |
| **Phone Validation** | ❌ No | ✅ 10 digits, starts 6-9 |
| **Pincode Validation** | ❌ No | ✅ 6 digits |
| **Input Sanitization** | ❌ No | ✅ XSS prevention |
| **Error Handling** | Basic | ✅ Custom error classes |

### **Admin Features**

| Feature | OLD System | NEW System |
|---------|-----------|-----------|
| **Dashboard Stats** | ❌ Limited | ✅ `/admin/orders/dashboard/stats` |
| **All Orders View** | ✅ Yes | ✅ Advanced filters |
| **Pending Approval** | ❌ No | ✅ `/admin/orders/pending-approval` |
| **Delivery Management** | ❌ No | ✅ Status updates |
| **Admin Notes** | ❌ No | ✅ `/admin/orders/:id/notes` |
| **Payment History** | ✅ Basic | ✅ Advanced with filters |

---

## 📂 CODE STRUCTURE COMPARISON

### **OLD System Files**

```
routes/
  └── orders.js                          # All routes
controllers/
  └── orderController.js                 # Business logic + DB operations
models/
  └── Order.js                           # Order schema
  └── Transaction.js                     # Transaction schema
```

### **NEW System Files**

```
routes/
  └── installmentRoutes.js               # All routes (user + admin)
controllers/
  ├── installmentOrderController.js      # HTTP request handling
  ├── installmentPaymentController.js    # Payment request handling
  └── installmentAdminController.js      # Admin request handling
services/
  ├── installmentOrderService.js         # Order business logic
  ├── installmentPaymentService.js       # Payment business logic
  └── installmentWalletService.js        # Wallet operations
models/
  ├── InstallmentOrder.js                # Order schema with methods
  └── PaymentRecord.js                   # Payment schema with methods
middlewares/
  └── installmentValidation.js           # Request validation
utils/
  ├── installmentHelpers.js              # Helper functions
  └── customErrors.js                    # Custom error classes
```

---

## 🔧 DATABASE SCHEMA COMPARISON

### **OLD System Schema**

```javascript
// Order.js
{
  orderId: String,                       // Custom ID
  userId: ObjectId,
  product: ObjectId,
  orderAmount: Number,
  totalEmis: Number,
  currentEmiNumber: Number,
  totalPaid: Number,
  orderStatus: String,                   // pending, confirmed, completed
  paymentStatus: String,                 // pending, partial, completed
  deliveryAddress: Object,               // Optional
  createdAt: Date,
  updatedAt: Date
}

// Transaction.js
{
  transaction_id: String,
  user_id: ObjectId,
  order_id: ObjectId,
  amount: Number,
  status: String,                        // pending, success, failed
  payment_method: String,
  razorpay_order_id: String,
  razorpay_payment_id: String,
  createdAt: Date
}
```

### **NEW System Schema**

```javascript
// InstallmentOrder.js
{
  orderId: String,                       // ✅ Auto-generated ORD-YYYYMMDD-XXXX
  user: ObjectId,
  product: ObjectId,
  productPrice: Number,
  productName: String,
  productSnapshot: Object,               // ✅ Full product data snapshot

  // Variant support
  variantId: String,
  variantDetails: {
    sku: String,
    attributes: Object,
    price: Number
  },

  // Coupon support
  couponCode: String,
  couponDiscount: Number,
  originalPrice: Number,

  // Installment details
  totalDays: Number,
  dailyPaymentAmount: Number,
  totalInstallments: Number,             // ✅ Calculated
  paidInstallments: Number,
  totalPaidAmount: Number,
  remainingAmount: Number,

  // Payment schedule
  paymentSchedule: [{                    // ✅ Complete schedule
    installmentNumber: Number,
    dueDate: Date,
    amount: Number,
    status: String,                      // PENDING, PAID, SKIPPED
    paidDate: Date,
    paymentId: ObjectId
  }],

  // Status
  status: String,                        // PENDING, ACTIVE, COMPLETED, CANCELLED

  // Delivery
  deliveryAddress: {                     // ✅ Required with validation
    name: String,
    phoneNumber: String,
    addressLine1: String,
    city: String,
    state: String,
    pincode: String
  },
  deliveryStatus: String,                // PENDING, APPROVED, SHIPPED, DELIVERED

  // Referral
  referrer: ObjectId,
  productCommissionPercentage: Number,
  totalCommissionPaid: Number,

  // First payment
  firstPaymentMethod: String,            // RAZORPAY, WALLET
  firstPaymentId: ObjectId,
  firstPaymentCompletedAt: Date,

  // Metadata
  orderNotes: String,
  adminNotes: String,
  cancelledAt: Date,
  cancelledBy: ObjectId,
  cancellationReason: String,
  completedAt: Date,

  createdAt: Date,
  updatedAt: Date
}

// PaymentRecord.js
{
  paymentId: String,                     // ✅ Auto PAY-YYYYMMDD-XXXX
  order: ObjectId,
  user: ObjectId,
  amount: Number,
  installmentNumber: Number,
  paymentMethod: String,                 // RAZORPAY, WALLET

  // Razorpay details
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  razorpayVerified: Boolean,

  // Wallet details
  walletTransactionId: ObjectId,

  // Status
  status: String,                        // PENDING, COMPLETED, FAILED

  // Commission
  commissionCalculated: Boolean,
  commissionAmount: Number,
  commissionPercentage: Number,
  commissionCreditedToReferrer: Boolean,
  commissionTransactionId: ObjectId,

  // Idempotency
  idempotencyKey: String,                // ✅ Prevents duplicates

  // Timestamps
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,
  errorMessage: String,

  createdAt: Date,
  updatedAt: Date
}
```

---

## ⚡ PERFORMANCE & RELIABILITY

| Aspect | OLD System | NEW System |
|--------|-----------|-----------|
| **Transaction Safety** | ❌ No transactions | ✅ MongoDB transactions |
| **Idempotency** | ❌ Can duplicate | ✅ Guaranteed once |
| **Error Recovery** | ❌ Manual | ✅ Auto rollback |
| **Data Consistency** | ❌ Partial updates possible | ✅ ACID compliant |
| **Duplicate Prevention** | ❌ No | ✅ Idempotency keys |
| **Race Conditions** | ❌ Possible | ✅ Prevented |

---

## 🐛 CURRENT BUGS & FIXES

### **OLD System**
- ✅ No major bugs
- ✅ Working perfectly
- ⚠️ Missing advanced features

### **NEW System**
- ❌ **Bug:** orderId validation error (FIXED in code)
- ✅ **Fix Applied:** Added `generateOrderId()` in service
- ⚠️ **Status:** Fixed locally, needs production deployment

---

## 📱 API ENDPOINTS SUMMARY

### **OLD System Endpoints**

```
POST   /api/orders                      # Create order
GET    /api/orders/user/history         # Get user orders
POST   /api/orders/:id/create-payment   # Create payment
POST   /api/orders/:id/verify-payment   # Verify payment
GET    /api/wallet/transactions          # Get transactions
```

### **NEW System Endpoints**

**User Endpoints:**
```
# Orders
POST   /api/installments/orders                          # Create order
GET    /api/installments/orders                          # Get user orders
GET    /api/installments/orders/stats                    # Order statistics
GET    /api/installments/orders/overall-status           # Overall investment status
GET    /api/installments/orders/:orderId                 # Get order details
GET    /api/installments/orders/:orderId/summary         # Order summary
GET    /api/installments/orders/:orderId/schedule        # Payment schedule
POST   /api/installments/orders/:orderId/cancel          # Cancel order
POST   /api/installments/validate-coupon                 # Validate coupon

# Payments
POST   /api/installments/payments/create-razorpay-order  # Create Razorpay order
POST   /api/installments/payments/process                # Process payment
GET    /api/installments/payments/my-payments            # Payment history
GET    /api/installments/payments/stats                  # Payment statistics
GET    /api/installments/payments/history/:orderId       # Order payment history
GET    /api/installments/payments/next-due/:orderId      # Next due payment
GET    /api/installments/payments/daily-pending          # ✅ Daily pending payments
POST   /api/installments/payments/:paymentId/retry       # Retry failed payment
```

**Admin Endpoints:**
```
# Dashboard
GET    /api/installments/admin/orders/dashboard/stats         # Dashboard statistics

# Orders Management
GET    /api/installments/admin/orders/all                     # All orders
GET    /api/installments/admin/orders/completed               # Completed orders
GET    /api/installments/admin/orders/pending-approval        # Pending approval
GET    /api/installments/admin/orders/:orderId                # Order details

# Order Actions
POST   /api/installments/admin/orders/:orderId/approve-delivery    # Approve delivery
PUT    /api/installments/admin/orders/:orderId/delivery-status     # Update delivery
PUT    /api/installments/admin/orders/:orderId/notes               # Add notes

# Payments
GET    /api/installments/admin/payments/all                   # All payments
```

---

## 💡 RECOMMENDATION FOR MERGER

### **Strategy: Hybrid Approach**

**Phase 1: Keep Both Systems (Current)**
- OLD system: Continue serving existing 6 orders
- NEW system: Use for all new orders (after production deployment)
- Gradual migration

**Phase 2: Feature Parity**
- Add missing OLD system features to NEW system:
  - Simpler order creation (optional fields)
  - Backward compatibility endpoints

**Phase 3: Data Migration**
- Migrate OLD orders to NEW system
- Maintain data integrity
- Test thoroughly

**Phase 4: Deprecate OLD System**
- Stop accepting new orders in OLD system
- Complete all pending OLD orders
- Archive OLD system code

### **Key Features to Keep from Each**

**From OLD System:**
- ✅ Simple API (less required fields)
- ✅ Flexible payment details structure
- ✅ Proven reliability

**From NEW System:**
- ✅ Advanced features (variants, coupons, wallet)
- ✅ Better data structure
- ✅ Transaction safety
- ✅ Daily pending API
- ✅ Admin features
- ✅ Payment schedule

---

## 📝 NEXT STEPS

1. **Deploy Fixed Code to Production**
   - Apply orderId fix to production server
   - Test NEW system with real orders

2. **Create Hybrid Endpoints**
   - `/api/orders/v2` → Uses NEW system, OLD structure
   - Maintains backward compatibility

3. **Data Migration Script**
   - Convert OLD Order → InstallmentOrder
   - Preserve all payment history

4. **Documentation**
   - API migration guide
   - Developer documentation

---

**Document Created:** November 26, 2025
**Systems Analyzed:** OLD (/api/orders) + NEW (/api/installments)
**Purpose:** Decision making for system merger

---
