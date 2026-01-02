# Bulk Order API Documentation

## Overview

The Bulk Order API allows users to purchase multiple products with different quantities and installment plans in a single transaction. Instead of making separate payments for each product, users pay once for all items combined.

---

## Key Features

| Feature | Description |
|---------|-------------|
| Multiple Products | Order different products in one transaction |
| Different Plans | Same product with different installment durations (e.g., iPhone 100 days + iPhone 200 days) |
| Single Payment | One Razorpay/Wallet transaction for all first payments combined |
| Per-Product Coupons | Apply different coupons to each product |
| Partial Success | If some items fail validation, valid items still get processed |

---

## Database Structure

```
BULK ORDER REQUEST
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    DATABASE RECORDS                          │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ InstallmentOrder│  │ InstallmentOrder│  │InstallmentOrder│
│  │ ORD-001         │  │ ORD-002         │  │ ORD-003      │ │
│  │ bulkOrderId:    │  │ bulkOrderId:    │  │ bulkOrderId: │ │
│  │ BULK-20260102-XY│  │ BULK-20260102-XY│  │BULK-20260102-XY│
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│           │                    │                   │        │
│           ▼                    ▼                   ▼        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ PaymentRecord   │  │ PaymentRecord   │  │PaymentRecord │ │
│  │ Amount: ₹800    │  │ Amount: ₹400    │  │ Amount: ₹100 │ │
│  │ bulkOrderId:    │  │ bulkOrderId:    │  │ bulkOrderId: │ │
│  │ BULK-20260102-XY│  │ BULK-20260102-XY│  │BULK-20260102-XY│
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
│  SINGLE RAZORPAY ORDER: ₹1,300 (800 + 400 + 100)            │
└──────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Create Bulk Order

**Endpoint:** `POST /api/installments/orders/bulk`

**Authentication:** Required (Bearer Token)

**Description:** Creates multiple installment orders and returns a single Razorpay order for combined first payment.

#### Request Body

```json
{
  "items": [
    {
      "productId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "variantId": "VAR-001",
      "quantity": 2,
      "totalDays": 100,
      "couponCode": "SAVE10"
    },
    {
      "productId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "quantity": 1,
      "totalDays": 200
    },
    {
      "productId": "75b2c3d4e5f6g7h8i9j0k2l3",
      "quantity": 1,
      "totalDays": 50
    }
  ],
  "paymentMethod": "RAZORPAY",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India",
    "landmark": "Near Central Mall"
  }
}
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | Array | Yes | Array of order items (max 10) |
| `items[].productId` | String | Yes | Product ID (MongoDB _id or custom productId) |
| `items[].variantId` | String | No | Product variant ID |
| `items[].quantity` | Number | No | Quantity (1-10, default: 1) |
| `items[].totalDays` | Number | Yes | Installment duration in days |
| `items[].couponCode` | String | No | Coupon code for this item |
| `paymentMethod` | String | Yes | `RAZORPAY` or `WALLET` |
| `deliveryAddress` | Object | Yes | Delivery address details |

#### Success Response (RAZORPAY)

```json
{
  "success": true,
  "data": {
    "bulkOrderId": "BULK-20260102-A1B2",
    "success": true,
    "summary": {
      "totalItems": 3,
      "successfulOrders": 3,
      "failedItems": 0,
      "totalFirstPayment": 1300,
      "paymentMethod": "RAZORPAY"
    },
    "orders": [
      {
        "orderId": "ORD-20260102-X1Y2",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "productName": "iPhone 15 Pro",
        "quantity": 2,
        "totalDays": 100,
        "dailyPaymentAmount": 800,
        "productPrice": 80000,
        "status": "PENDING"
      },
      {
        "orderId": "ORD-20260102-X2Y3",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
        "productName": "iPhone 15 Pro",
        "quantity": 1,
        "totalDays": 200,
        "dailyPaymentAmount": 400,
        "productPrice": 80000,
        "status": "PENDING"
      },
      {
        "orderId": "ORD-20260102-X3Y4",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
        "productName": "AirPods Pro",
        "quantity": 1,
        "totalDays": 50,
        "dailyPaymentAmount": 100,
        "productPrice": 5000,
        "status": "PENDING"
      }
    ],
    "payments": [
      {
        "paymentId": "65f1a2b3c4d5e6f7g8h9i0p1",
        "orderId": "65f1a2b3c4d5e6f7g8h9i0j1",
        "amount": 800
      },
      {
        "paymentId": "65f1a2b3c4d5e6f7g8h9i0p2",
        "orderId": "65f1a2b3c4d5e6f7g8h9i0j2",
        "amount": 400
      },
      {
        "paymentId": "65f1a2b3c4d5e6f7g8h9i0p3",
        "orderId": "65f1a2b3c4d5e6f7g8h9i0j3",
        "amount": 100
      }
    ],
    "failedItems": [],
    "razorpayOrder": {
      "id": "order_N1234567890",
      "amount": 130000,
      "currency": "INR",
      "keyId": "rzp_live_xxxxxxxxxxxxx"
    },
    "message": "Bulk order created. Please complete payment via Razorpay."
  },
  "message": "Bulk order created. Please complete payment via Razorpay."
}
```

#### Success Response (WALLET)

```json
{
  "success": true,
  "data": {
    "bulkOrderId": "BULK-20260102-A1B2",
    "success": true,
    "summary": {
      "totalItems": 3,
      "successfulOrders": 3,
      "failedItems": 0,
      "totalFirstPayment": 1300,
      "paymentMethod": "WALLET"
    },
    "orders": [
      {
        "orderId": "ORD-20260102-X1Y2",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "productName": "iPhone 15 Pro",
        "quantity": 2,
        "totalDays": 100,
        "dailyPaymentAmount": 800,
        "productPrice": 80000,
        "status": "ACTIVE"
      }
    ],
    "payments": [...],
    "failedItems": [],
    "walletTransactionIds": [
      "65f1a2b3c4d5e6f7g8h9w0t1",
      "65f1a2b3c4d5e6f7g8h9w0t2",
      "65f1a2b3c4d5e6f7g8h9w0t3"
    ],
    "message": "Bulk order created and paid successfully via wallet."
  },
  "message": "Bulk order created and paid successfully via wallet."
}
```

#### Partial Success Response

When some items fail validation but others succeed:

```json
{
  "success": true,
  "data": {
    "bulkOrderId": "BULK-20260102-A1B2",
    "summary": {
      "totalItems": 3,
      "successfulOrders": 2,
      "failedItems": 1,
      "totalFirstPayment": 1200,
      "paymentMethod": "RAZORPAY"
    },
    "orders": [...],
    "payments": [...],
    "failedItems": [
      {
        "index": 2,
        "error": "Item 3: Product 'xyz123' not found"
      }
    ],
    "razorpayOrder": {...}
  }
}
```

#### Error Responses

**All Items Failed Validation:**
```json
{
  "success": false,
  "error": {
    "code": "BULK_ORDER_ERROR",
    "message": "All items failed validation",
    "details": {
      "successfulOrders": [],
      "failedItems": [
        { "index": 0, "error": "Item 1: Product not found" },
        { "index": 1, "error": "Item 2: Daily amount below minimum ₹50" }
      ],
      "successCount": 0,
      "failedCount": 2
    }
  }
}
```

**Insufficient Wallet Balance:**
```json
{
  "success": false,
  "error": {
    "code": "BULK_ORDER_ERROR",
    "message": "Insufficient wallet balance. Required: ₹1300, Available: ₹500",
    "details": {
      "failedItems": [
        { "error": "INSUFFICIENT_BALANCE", "required": 1300, "available": 500 }
      ]
    }
  }
}
```

---

### 2. Verify Bulk Order Payment

**Endpoint:** `POST /api/installments/orders/bulk/verify-payment`

**Authentication:** Required (Bearer Token)

**Description:** Verifies Razorpay payment and activates all orders in the bulk order.

#### Request Body

```json
{
  "bulkOrderId": "BULK-20260102-A1B2",
  "razorpayOrderId": "order_N1234567890",
  "razorpayPaymentId": "pay_N1234567890",
  "razorpaySignature": "signature_hash_here"
}
```

#### Success Response

```json
{
  "success": true,
  "data": {
    "success": true,
    "bulkOrderId": "BULK-20260102-A1B2",
    "ordersActivated": 3,
    "totalOrdersInBulk": 3,
    "orders": [
      {
        "orderId": "ORD-20260102-X1Y2",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "productName": "iPhone 15 Pro",
        "status": "ACTIVE",
        "dailyPaymentAmount": 800
      },
      {
        "orderId": "ORD-20260102-X2Y3",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
        "productName": "iPhone 15 Pro",
        "status": "ACTIVE",
        "dailyPaymentAmount": 400
      },
      {
        "orderId": "ORD-20260102-X3Y4",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j3",
        "productName": "AirPods Pro",
        "status": "ACTIVE",
        "dailyPaymentAmount": 100
      }
    ],
    "payments": [
      { "paymentId": "...", "amount": 800, "status": "COMPLETED" },
      { "paymentId": "...", "amount": 400, "status": "COMPLETED" },
      { "paymentId": "...", "amount": 100, "status": "COMPLETED" }
    ],
    "message": "Payment verified. 3 orders are now ACTIVE."
  },
  "message": "Payment verified. 3 orders are now ACTIVE."
}
```

---

### 3. Get Bulk Order Details

**Endpoint:** `GET /api/installments/orders/bulk/:bulkOrderId`

**Authentication:** Required (Bearer Token)

**Description:** Retrieves detailed information about a bulk order and all its associated orders.

#### Success Response

```json
{
  "success": true,
  "data": {
    "bulkOrderId": "BULK-20260102-A1B2",
    "summary": {
      "totalOrders": 3,
      "totalAmount": 165000,
      "totalPaid": 1300,
      "totalFirstPayment": 1300,
      "remainingAmount": 163700,
      "statusCounts": {
        "PENDING": 0,
        "ACTIVE": 3,
        "COMPLETED": 0,
        "CANCELLED": 0
      }
    },
    "orders": [
      {
        "orderId": "ORD-20260102-X1Y2",
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "productName": "iPhone 15 Pro",
        "productImage": "https://example.com/iphone.jpg",
        "quantity": 2,
        "totalDays": 100,
        "dailyPaymentAmount": 800,
        "productPrice": 80000,
        "totalPaidAmount": 800,
        "remainingAmount": 79200,
        "paidInstallments": 1,
        "status": "ACTIVE",
        "createdAt": "2026-01-02T10:30:00.000Z"
      }
    ],
    "payments": [
      {
        "paymentId": "65f1a2b3c4d5e6f7g8h9i0p1",
        "orderId": "65f1a2b3c4d5e6f7g8h9i0j1",
        "amount": 800,
        "status": "COMPLETED",
        "razorpayOrderId": "order_N1234567890",
        "completedAt": "2026-01-02T10:35:00.000Z"
      }
    ]
  },
  "message": "Bulk order details retrieved successfully"
}
```

---

### 4. Get My Bulk Orders

**Endpoint:** `GET /api/installments/orders/my-bulk-orders`

**Authentication:** Required (Bearer Token)

**Description:** Retrieves all bulk orders for the authenticated user.

#### Success Response

```json
{
  "success": true,
  "data": {
    "bulkOrders": [
      {
        "bulkOrderId": "BULK-20260102-A1B2",
        "orders": [
          {
            "orderId": "ORD-20260102-X1Y2",
            "productName": "iPhone 15 Pro",
            "status": "ACTIVE",
            "dailyPaymentAmount": 800,
            "totalDays": 100
          },
          {
            "orderId": "ORD-20260102-X2Y3",
            "productName": "iPhone 15 Pro",
            "status": "ACTIVE",
            "dailyPaymentAmount": 400,
            "totalDays": 200
          }
        ],
        "totalOrders": 2,
        "totalFirstPayment": 1200,
        "createdAt": "2026-01-02T10:30:00.000Z",
        "statuses": {
          "ACTIVE": 2
        }
      }
    ],
    "totalBulkOrders": 1
  },
  "message": "Bulk orders retrieved successfully"
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND IMPLEMENTATION                           │
└─────────────────────────────────────────────────────────────────────────┘

STEP 1: USER ADDS PRODUCTS TO CART
──────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────┐
│  Cart:                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Product: iPhone 15 Pro                                             │ │
│  │ Quantity: 2                                                        │ │
│  │ Plan: 100 days                                                     │ │
│  │ Daily Amount: ₹800                                                 │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ Product: iPhone 15 Pro (Same product, different plan!)            │ │
│  │ Quantity: 1                                                        │ │
│  │ Plan: 200 days                                                     │ │
│  │ Daily Amount: ₹400                                                 │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ Product: AirPods Pro                                               │ │
│  │ Quantity: 1                                                        │ │
│  │ Plan: 50 days                                                      │ │
│  │ Daily Amount: ₹100                                                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Total First Payment: ₹1,300                                           │
│                                                                         │
│  [PROCEED TO CHECKOUT]                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 2: CALL BULK ORDER API
───────────────────────────
┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/installments/orders/bulk                                     │
│                                                                         │
│  Request:                                                               │
│  {                                                                      │
│    "items": [                                                           │
│      { "productId": "iphone-id", "quantity": 2, "totalDays": 100 },    │
│      { "productId": "iphone-id", "quantity": 1, "totalDays": 200 },    │
│      { "productId": "airpods-id", "quantity": 1, "totalDays": 50 }     │
│    ],                                                                   │
│    "paymentMethod": "RAZORPAY",                                        │
│    "deliveryAddress": { ... }                                          │
│  }                                                                      │
│                                                                         │
│  Response:                                                              │
│  - bulkOrderId: "BULK-20260102-A1B2"                                   │
│  - 3 orders created (status: PENDING)                                  │
│  - 3 payment records created                                           │
│  - 1 Razorpay order for ₹1,300                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 3: OPEN RAZORPAY CHECKOUT (ONCE!)
──────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────┐
│  const options = {                                                      │
│    key: response.razorpayOrder.keyId,                                  │
│    amount: response.razorpayOrder.amount,  // 130000 paise             │
│    currency: "INR",                                                    │
│    order_id: response.razorpayOrder.id,                                │
│    name: "EPI Store",                                                  │
│    description: "Bulk Order Payment",                                  │
│    handler: function(paymentResponse) {                                │
│      // Call verify API                                                │
│    }                                                                   │
│  };                                                                    │
│                                                                         │
│  const rzp = new Razorpay(options);                                    │
│  rzp.open();  // Opens ONCE for total ₹1,300                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 4: VERIFY PAYMENT
──────────────────────
┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/installments/orders/bulk/verify-payment                      │
│                                                                         │
│  Request:                                                               │
│  {                                                                      │
│    "bulkOrderId": "BULK-20260102-A1B2",                                │
│    "razorpayOrderId": "order_N1234567890",                             │
│    "razorpayPaymentId": "pay_N1234567890",                             │
│    "razorpaySignature": "..."                                          │
│  }                                                                      │
│                                                                         │
│  What happens:                                                          │
│  1. Verify Razorpay signature                                          │
│  2. Update all 3 orders: PENDING → ACTIVE                              │
│  3. Update all 3 payment records: PENDING → COMPLETED                  │
│  4. Credit commission to referrer (if applicable)                      │
│  5. Update payment schedules                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STEP 5: SUCCESS! ALL ORDERS ACTIVE
──────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────┐
│  ✅ Order 1: iPhone 15 Pro (100 days) - ACTIVE                         │
│  ✅ Order 2: iPhone 15 Pro (200 days) - ACTIVE                         │
│  ✅ Order 3: AirPods Pro (50 days) - ACTIVE                            │
│                                                                         │
│  Daily payments from tomorrow:                                          │
│  - Use existing combined payment API:                                   │
│    POST /api/installment-payments/create-combined-razorpay             │
│    POST /api/installment-payments/pay-daily-selected                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Code Example

### React/JavaScript Implementation

```javascript
// 1. Create Bulk Order
async function createBulkOrder(cartItems, address) {
  const items = cartItems.map(item => ({
    productId: item.productId,
    variantId: item.variantId || undefined,
    quantity: item.quantity,
    totalDays: item.selectedPlan.days,
    couponCode: item.couponCode || undefined
  }));

  const response = await fetch('/api/installments/orders/bulk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items,
      paymentMethod: 'RAZORPAY',
      deliveryAddress: address
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to create bulk order');
  }

  return data.data;
}

// 2. Open Razorpay Checkout
function openRazorpayCheckout(bulkOrderData) {
  return new Promise((resolve, reject) => {
    const options = {
      key: bulkOrderData.razorpayOrder.keyId,
      amount: bulkOrderData.razorpayOrder.amount,
      currency: bulkOrderData.razorpayOrder.currency,
      order_id: bulkOrderData.razorpayOrder.id,
      name: 'Your Store Name',
      description: `Bulk Order: ${bulkOrderData.summary.successfulOrders} items`,
      handler: function(response) {
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        });
      },
      modal: {
        ondismiss: function() {
          reject(new Error('Payment cancelled by user'));
        }
      },
      prefill: {
        name: address.name,
        contact: address.phoneNumber
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  });
}

// 3. Verify Payment
async function verifyBulkPayment(bulkOrderId, paymentDetails) {
  const response = await fetch('/api/installments/orders/bulk/verify-payment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      bulkOrderId,
      razorpayOrderId: paymentDetails.razorpayOrderId,
      razorpayPaymentId: paymentDetails.razorpayPaymentId,
      razorpaySignature: paymentDetails.razorpaySignature
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Payment verification failed');
  }

  return data.data;
}

// 4. Complete Checkout Flow
async function handleCheckout(cartItems, address) {
  try {
    setLoading(true);

    // Step 1: Create bulk order
    const bulkOrder = await createBulkOrder(cartItems, address);

    // Check for failed items
    if (bulkOrder.failedItems.length > 0) {
      console.warn('Some items failed:', bulkOrder.failedItems);
      // Optionally show warning to user
    }

    // Step 2: Open Razorpay (if RAZORPAY method)
    if (bulkOrder.razorpayOrder) {
      const paymentDetails = await openRazorpayCheckout(bulkOrder);

      // Step 3: Verify payment
      const verificationResult = await verifyBulkPayment(
        bulkOrder.bulkOrderId,
        paymentDetails
      );

      // Success!
      showSuccess(`${verificationResult.ordersActivated} orders placed successfully!`);
      clearCart();
      navigateTo('/my-orders');
    } else {
      // Wallet payment - already completed
      showSuccess('Orders placed successfully via wallet!');
      clearCart();
      navigateTo('/my-orders');
    }

  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}
```

---

## Business Rules

| Rule | Value | Description |
|------|-------|-------------|
| Maximum Items | 10 | Maximum 10 items per bulk order |
| Quantity per Item | 1-10 | Each item can have 1-10 quantity |
| Minimum Daily Amount | ₹50 | Per order, daily payment must be at least ₹50 |
| Maximum Duration | Based on price | ≤₹10k: 100 days, ≤₹50k: 180 days, >₹50k: 365 days |
| Commission | 10% | Referrer gets 10% commission on each payment |
| Payment Methods | RAZORPAY, WALLET | Choose one for all items |

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BULK_ORDER_ERROR` | 400 | Generic bulk order error (check failedItems) |
| `BULK_ORDER_NOT_FOUND` | 404 | Bulk order ID not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `USER_NOT_FOUND` | 404 | User not found |
| `PRODUCT_NOT_FOUND` | 404 | Product not found |
| `PRODUCT_OUT_OF_STOCK` | 400 | Product not available |

---

## Daily Payments After First Payment

After bulk order is created and first payment is done, daily payments work the same as single orders:

```javascript
// Get all pending daily payments
GET /api/installment-payments/daily-pending

// Create combined Razorpay for multiple orders
POST /api/installment-payments/create-combined-razorpay
{
  "selectedOrders": ["order_id_1", "order_id_2", "order_id_3"]
}

// Process combined daily payment
POST /api/installment-payments/pay-daily-selected
{
  "selectedOrders": ["order_id_1", "order_id_2", "order_id_3"],
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "...",
  "razorpayPaymentId": "...",
  "razorpaySignature": "..."
}
```

---

*Document Version: 1.0*
*Last Updated: January 2, 2026*
