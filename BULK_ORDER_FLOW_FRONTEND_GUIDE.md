# 🛒 Bulk/Multiple Product Order Flow - Frontend Guide

## Current System vs Proposed Solution

### ❌ Current Limitation
- Ek order = Ek product (with 1-10 quantity)
- Different products ke liye alag-alag orders banana padta hai
- Har order ka first payment separately karna padta hai

### ✅ 2 Solutions Available

---

## 📌 SOLUTION 1: Sequential Orders (Current System - Recommended)

**Best For:** Simple implementation, already working

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                         CART PAGE                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Product A (Qty: 2) - ₹5000 - 30 Days Plan                │   │
│  │ Product B (Qty: 1) - ₹3000 - 60 Days Plan                │   │
│  │ Product C (Qty: 3) - ₹2000 - 15 Days Plan                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    [PLACE ORDER Button]                          │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LOGIC                                │
│                                                                  │
│  Step 1: Create orders one by one (parallel API calls)          │
│  Step 2: Collect all Razorpay order IDs                         │
│  Step 3: Calculate total first payment amount                   │
│  Step 4: Show single payment modal with total amount            │
│  Step 5: Process payments sequentially OR use combined API      │
└──────────────────────────────────────────────────────────────────┘
```

### API Calls Sequence

#### Step 1: Create All Orders (Parallel)
```javascript
// Frontend Code
const cartItems = [
  { productId: "abc123", quantity: 2, totalDays: 30 },
  { productId: "xyz456", quantity: 1, totalDays: 60 },
  { productId: "pqr789", quantity: 3, totalDays: 15 }
];

// Create all orders in parallel
const orderPromises = cartItems.map(item =>
  fetch('/api/installment-orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      totalDays: item.totalDays,
      paymentMethod: 'RAZORPAY',  // Always RAZORPAY for first payment
      deliveryAddress: {
        name: "Customer Name",
        phoneNumber: "9876543210",
        addressLine1: "Address Line 1",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India"
      }
    })
  }).then(res => res.json())
);

const orderResults = await Promise.all(orderPromises);
```

#### Step 2: Collect Order Details
```javascript
// Extract order info from responses
const createdOrders = orderResults.map(result => ({
  orderId: result.data.order._id,
  orderDisplayId: result.data.order.orderId,
  productName: result.data.order.productName,
  firstPaymentAmount: result.data.order.dailyPaymentAmount,
  razorpayOrderId: result.data.razorpayOrder.id,
  razorpayAmount: result.data.razorpayOrder.amount  // in paise
}));

// Calculate total
const totalFirstPayment = createdOrders.reduce(
  (sum, order) => sum + order.firstPaymentAmount, 0
);
```

#### Step 3: Show Payment Summary Modal
```javascript
// Display to user
const paymentSummary = {
  orders: createdOrders,
  totalAmount: totalFirstPayment,
  itemCount: createdOrders.length
};

// Show modal with breakdown:
// - Product A: ₹167 (Day 1 of 30)
// - Product B: ₹50 (Day 1 of 60)
// - Product C: ₹134 (Day 1 of 15)
// -----------------------
// Total: ₹351
```

#### Step 4: Process Payments (Two Options)

**Option A: Sequential Razorpay Payments (Simple)**
```javascript
// Pay each order one by one
for (const order of createdOrders) {
  const options = {
    key: RAZORPAY_KEY_ID,
    amount: order.razorpayAmount,
    currency: 'INR',
    order_id: order.razorpayOrderId,
    name: 'EPI Store',
    description: `First payment for ${order.productName}`,
    handler: async function(response) {
      // Verify payment
      await fetch('/api/installment-payments/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: order.orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        })
      });
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();

  // Wait for payment to complete before next
  await waitForPaymentCompletion();
}
```

**Option B: Wallet Payment (If Sufficient Balance)**
```javascript
// If user has enough wallet balance, use wallet for all
const walletOrderPromises = cartItems.map(item =>
  fetch('/api/installment-orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...item,
      paymentMethod: 'WALLET',  // Use wallet instead
      deliveryAddress: deliveryAddress
    })
  }).then(res => res.json())
);

// All orders created and first payment done instantly!
const results = await Promise.all(walletOrderPromises);
```

---

## 📌 SOLUTION 2: Bulk Order API (New Feature - Needs Backend Work)

**Best For:** Better UX, single transaction

### Proposed New Endpoint
```
POST /api/installment-orders/bulk
```

### Request Body
```javascript
{
  "items": [
    {
      "productId": "abc123",
      "variantId": "var-001",  // optional
      "quantity": 2,
      "totalDays": 30,
      "couponCode": "SAVE10"  // optional, per product
    },
    {
      "productId": "xyz456",
      "quantity": 1,
      "totalDays": 60
    },
    {
      "productId": "pqr789",
      "quantity": 3,
      "totalDays": 15
    }
  ],
  "paymentMethod": "RAZORPAY",
  "deliveryAddress": {
    "name": "Customer Name",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India"
  }
}
```

### Response
```javascript
{
  "success": true,
  "data": {
    "bulkOrderId": "BULK-20240102-XYZ",
    "orders": [
      {
        "orderId": "ORD-20240102-A1B2",
        "_id": "65f1a2b3...",
        "productName": "Product A",
        "quantity": 2,
        "dailyPaymentAmount": 167,
        "totalDays": 30,
        "status": "PENDING"
      },
      {
        "orderId": "ORD-20240102-C3D4",
        "_id": "65f1a2b4...",
        "productName": "Product B",
        "quantity": 1,
        "dailyPaymentAmount": 50,
        "totalDays": 60,
        "status": "PENDING"
      },
      {
        "orderId": "ORD-20240102-E5F6",
        "_id": "65f1a2b5...",
        "productName": "Product C",
        "quantity": 3,
        "dailyPaymentAmount": 134,
        "totalDays": 15,
        "status": "PENDING"
      }
    ],
    "payment": {
      "totalFirstPayment": 351,
      "razorpayOrder": {
        "id": "order_XXXXX",
        "amount": 35100,  // in paise
        "currency": "INR"
      }
    }
  },
  "message": "Bulk order created. Complete payment to activate all orders."
}
```

### Payment Verification
```
POST /api/installment-orders/bulk/verify-payment
```

```javascript
{
  "bulkOrderId": "BULK-20240102-XYZ",
  "razorpayOrderId": "order_XXXXX",
  "razorpayPaymentId": "pay_XXXXX",
  "razorpaySignature": "signature_here"
}
```

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1️⃣  BROWSE & ADD TO CART                                               │
│  ────────────────────────────────────────────────────────────────────── │
│  • User browses products                                                │
│  • Selects variant (if applicable)                                      │
│  • Chooses quantity (1-10)                                              │
│  • Selects installment plan (totalDays)                                 │
│  • Adds to cart                                                         │
│  • Repeats for multiple products                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2️⃣  CART REVIEW                                                        │
│  ────────────────────────────────────────────────────────────────────── │
│  Cart Items:                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📦 iPhone 15 (Qty: 1)                                              │ │
│  │    Price: ₹80,000 | Plan: 100 Days | Daily: ₹800                   │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 📦 AirPods Pro (Qty: 2)                                            │ │
│  │    Price: ₹50,000 | Plan: 50 Days | Daily: ₹1,000                  │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 📦 MacBook Case (Qty: 1)                                           │ │
│  │    Price: ₹2,500 | Plan: 25 Days | Daily: ₹100                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  First Payment Summary:                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ iPhone 15 - Day 1:        ₹800                                     │ │
│  │ AirPods Pro - Day 1:      ₹1,000                                   │ │
│  │ MacBook Case - Day 1:     ₹100                                     │ │
│  │ ─────────────────────────────────                                  │ │
│  │ TOTAL FIRST PAYMENT:      ₹1,900                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [Apply Coupon]  [Choose Address]  [💳 PAY ₹1,900]                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3️⃣  ADDRESS SELECTION                                                  │
│  ────────────────────────────────────────────────────────────────────── │
│  • Select from saved addresses OR                                       │
│  • Add new delivery address                                             │
│  • Same address used for all products                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4️⃣  PAYMENT METHOD SELECTION                                           │
│  ────────────────────────────────────────────────────────────────────── │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │  💳 RAZORPAY        │  │  👛 WALLET          │                       │
│  │  UPI/Card/NetBanking│  │  Balance: ₹5,000   │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                         │
│  If Wallet >= ₹1,900 → Can use wallet                                   │
│  Otherwise → Use Razorpay                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  5A️⃣  RAZORPAY FLOW          │   │  5B️⃣  WALLET FLOW            │
│  ─────────────────────────── │   │  ─────────────────────────── │
│                              │   │                              │
│  FOR EACH CART ITEM:         │   │  FOR EACH CART ITEM:         │
│  1. Create Order API         │   │  1. Create Order API         │
│  2. Get Razorpay Order ID    │   │     (paymentMethod: WALLET)  │
│  3. Open Razorpay Modal      │   │  2. Auto-deducts from wallet │
│  4. User completes payment   │   │  3. Order goes ACTIVE        │
│  5. Verify payment           │   │                              │
│  6. Order goes ACTIVE        │   │  ✅ All orders created &     │
│                              │   │     paid instantly!          │
│  OR (Better UX):             │   │                              │
│  Use bulk create + single    │   │                              │
│  Razorpay payment            │   │                              │
└──────────────────────────────┘   └──────────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6️⃣  ORDER CONFIRMATION                                                 │
│  ────────────────────────────────────────────────────────────────────── │
│  ✅ Orders Created Successfully!                                        │
│                                                                         │
│  Order 1: ORD-20240102-A1B2 - iPhone 15                                 │
│  Order 2: ORD-20240102-C3D4 - AirPods Pro                               │
│  Order 3: ORD-20240102-E5F6 - MacBook Case                              │
│                                                                         │
│  Next Payment Due: Tomorrow                                             │
│  Daily Payment: ₹1,900                                                  │
│                                                                         │
│  [View Orders]  [Continue Shopping]                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  7️⃣  DAILY PAYMENTS (After Day 1)                                       │
│  ────────────────────────────────────────────────────────────────────── │
│  User can pay for multiple orders together using:                       │
│                                                                         │
│  POST /api/installment-payments/create-combined-razorpay                │
│  POST /api/installment-payments/pay-daily-selected                      │
│                                                                         │
│  This is already implemented! ✅                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Frontend Implementation Checklist

### Cart Page
- [ ] Store cart items with: productId, variantId, quantity, totalDays
- [ ] Calculate daily amount for each item: `Math.ceil(totalPrice / totalDays)`
- [ ] Show first payment breakdown
- [ ] Validate minimum daily amount (₹50 per product)

### Checkout Page
- [ ] Address selection/creation
- [ ] Payment method selection (Razorpay/Wallet)
- [ ] Check wallet balance before showing wallet option
- [ ] Show total first payment amount

### Order Creation (Current System)
```javascript
// Pseudo-code for checkout
async function handleCheckout(cartItems, address, paymentMethod) {
  // Show loading
  setLoading(true);

  try {
    if (paymentMethod === 'WALLET') {
      // Create all orders with wallet payment
      const results = await Promise.all(
        cartItems.map(item => createOrder({
          ...item,
          paymentMethod: 'WALLET',
          deliveryAddress: address
        }))
      );

      // All done! Orders are ACTIVE
      showSuccess('Orders placed successfully!');

    } else {
      // RAZORPAY flow
      // Step 1: Create all orders (get Razorpay order IDs)
      const orders = await Promise.all(
        cartItems.map(item => createOrder({
          ...item,
          paymentMethod: 'RAZORPAY',
          deliveryAddress: address
        }))
      );

      // Step 2: Process payments one by one
      for (const order of orders) {
        await processRazorpayPayment(order);
      }

      showSuccess('All orders placed successfully!');
    }

    // Clear cart
    clearCart();

    // Redirect to orders page
    navigateTo('/my-orders');

  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}
```

---

## 🎯 API Reference Summary

### Order Creation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/installment-orders` | POST | Create single order |
| `/api/installment-orders?status=ACTIVE` | GET | Get user's active orders |

### Payment
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/installment-payments/process` | POST | Verify Razorpay payment |
| `/api/installment-payments/create-combined-razorpay` | POST | Create combined Razorpay for daily payments |
| `/api/installment-payments/pay-daily-selected` | POST | Process multiple daily payments |

### Wallet
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallet/balance` | GET | Get wallet balance |

---

## ❓ FAQ

**Q: Can user have different delivery addresses for different products?**
A: Currently no. One address per order. If needed, create orders separately.

**Q: What if one order creation fails?**
A: Handle gracefully. Show which orders succeeded/failed. Allow retry.

**Q: Minimum order value?**
A: Daily amount must be ₹50 minimum per order.

**Q: Maximum quantity?**
A: 10 units per product per order.

**Q: Can user apply different coupons to different products?**
A: Yes! Each order can have its own coupon.

---

## 🚀 Recommendation

**For Now:** Use Solution 1 (Sequential Orders)
- Already works
- No backend changes needed
- Frontend handles the logic

**Future Enhancement:** Implement Solution 2 (Bulk Order API)
- Better UX
- Single transaction
- Atomic operation (all succeed or all fail)

---

*Document Created: January 2, 2026*
*For: Frontend Team*
