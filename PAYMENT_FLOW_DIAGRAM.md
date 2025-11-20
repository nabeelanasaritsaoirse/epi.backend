# Payment Flow - Simple Diagrams

## 🔵 Wallet Payment Flow

```
┌─────────────┐
│  Flutter    │
│    App      │
└──────┬──────┘
       │
       │ 1. POST /orders
       │    {
       │      productId,
       │      totalDays: 30,
       │      paymentMethod: "WALLET"
       │    }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Creates order in database               │
│  ✅ Deducts ₹4000 from wallet               │
│  ✅ Marks 1st installment PAID              │
│  ✅ Calculates commission (20%)             │
│  ✅ Credits ₹720 to referrer (90%)          │
│  ✅ Locks ₹80 for investment (10%)          │
│  ✅ Order status → ACTIVE                   │
└──────────────────────────────────────────────┘
       │
       │ 2. Response
       │    {
       │      success: true,
       │      order: { orderId, status: "ACTIVE" }
       │    }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Shows:     │
│  "Order     │
│  Created!"  │
└─────────────┘

✅ DONE IN 1 API CALL!
```

---

## 🟢 Razorpay Payment Flow

```
┌─────────────┐
│  Flutter    │
│    App      │
└──────┬──────┘
       │
       │ STEP 1: Create Order
       │ POST /orders
       │ { productId, totalDays: 30, paymentMethod: "RAZORPAY" }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Creates order (status: PENDING)         │
│  ✅ Calls Razorpay API                      │
│  ✅ Creates Razorpay order                  │
│  ✅ Returns Razorpay details                │
└──────────────────────────────────────────────┘
       │
       │ Response:
       │ {
       │   razorpayOrder: {
       │     id: "order_123",
       │     amount: 400000,
       │     keyId: "rzp_test_xxx"
       │   }
       │ }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Opens      │
│  Razorpay   │
│  SDK        │
└──────┬──────┘
       │
       │ User pays on Razorpay
       │
       ▼
┌─────────────┐
│  Razorpay   │
│  Returns:   │
│  - order_id │
│  - payment_id│
│  - signature│
└──────┬──────┘
       │
       │ STEP 2: Verify Payment
       │ POST /payments/process
       │ {
       │   orderId: "ORD-xxx",
       │   paymentMethod: "RAZORPAY",
       │   razorpayOrderId: "order_123",
       │   razorpayPaymentId: "pay_456",
       │   razorpaySignature: "abc..."
       │ }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Verifies Razorpay signature (security)  │
│  ✅ Marks 1st installment PAID              │
│  ✅ Order status → ACTIVE                   │
│  ✅ Calculates commission                   │
│  ✅ Credits referrer wallet (90-10)         │
└──────────────────────────────────────────────┘
       │
       │ Response:
       │ { success: true, message: "Payment successful" }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Shows:     │
│  "Payment   │
│  Success!"  │
└─────────────┘

✅ DONE IN 2 API CALLS!
```

---

## 💰 Daily Payment Flow (Wallet)

```
User on Order Details Page
       │
       │ Clicks "Pay Next Installment"
       │
       ▼
┌─────────────┐
│  Flutter    │
└──────┬──────┘
       │
       │ POST /payments/process
       │ {
       │   orderId: "ORD-xxx",
       │   paymentMethod: "WALLET"
       │ }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Deducts ₹4000 from wallet               │
│  ✅ Marks next installment PAID             │
│  ✅ Updates: paidInstallments = 2           │
│  ✅ Updates: totalPaidAmount = ₹8000        │
│  ✅ Calculates commission                   │
│  ✅ Credits referrer wallet                 │
│  ✅ Checks: Is order complete?              │
│     - If yes: status → COMPLETED            │
└──────────────────────────────────────────────┘
       │
       │ Response:
       │ {
       │   message: "Payment successful. 28 installments remaining",
       │   order: { progress: 6.66%, remainingAmount: ₹112000 }
       │ }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Updates    │
│  Progress   │
│  Bar        │
└─────────────┘

✅ DONE IN 1 API CALL!
```

---

## 💳 Daily Payment Flow (Razorpay)

```
User on Order Details Page
       │
       │ Clicks "Pay Next Installment"
       │
       ▼
┌─────────────┐
│  Flutter    │
└──────┬──────┘
       │
       │ STEP 1: Create Razorpay Order
       │ POST /payments/create-razorpay-order
       │ { orderId: "ORD-xxx" }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Calls Razorpay API                      │
│  ✅ Creates Razorpay order for ₹4000        │
│  ✅ Returns order details                   │
└──────────────────────────────────────────────┘
       │
       │ Response:
       │ { razorpayOrderId, amount, keyId }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Opens SDK  │
└──────┬──────┘
       │
       │ User pays
       │
       ▼
┌─────────────┐
│  Razorpay   │
│  Returns    │
│  Response   │
└──────┬──────┘
       │
       │ STEP 2: Verify
       │ POST /payments/process
       │ { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
       │
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND DOES:                      │
│                                              │
│  ✅ Verifies signature                      │
│  ✅ Marks installment PAID                  │
│  ✅ Updates order                           │
│  ✅ Credits commission                      │
└──────────────────────────────────────────────┘
       │
       │ Response: { success: true }
       │
       ▼
┌─────────────┐
│  Flutter    │
│  Updates UI │
└─────────────┘

✅ DONE IN 2 API CALLS!
```

---

## 📊 Complete User Journey

```
┌──────────────────────────────────────────────────────┐
│                  USER JOURNEY                        │
└──────────────────────────────────────────────────────┘

1. Browse Product
        │
        ▼
2. Select "Buy with Installments"
        │
        ├─► Choose Days (30)
        ├─► Daily Amount: Auto-calculated (₹4000)
        └─► Choose Payment Method (Wallet/Razorpay)
        │
        ▼
3. Create Order (API Call #1)
        │
        ├─► WALLET: Done! ✅
        │
        └─► RAZORPAY: Open SDK → Pay → Verify (API Call #2) → Done! ✅
        │
        ▼
4. Order Status: ACTIVE
   Progress: 3.33% (1/30 paid)
        │
        │
   ┌────┴────┐
   │  WAIT   │ (User can pay anytime)
   └────┬────┘
        │
        ▼
5. Pay Next Installment (Day 2, 3, 4... whenever)
        │
        ├─► WALLET: 1 API call ✅
        └─► RAZORPAY: 2 API calls ✅
        │
        ▼
6. Progress Updates (10%, 20%, 30%...)
        │
        │
   ┌────┴────┐
   │  WAIT   │
   └────┬────┘
        │
        ▼
7. Last Payment (30/30)
        │
        ▼
8. Order Status: COMPLETED ✅
   Show: "Awaiting Delivery Approval"
        │
        ▼
9. Admin Approves
        │
        ▼
10. Product Shipped
        │
        ▼
11. User Receives Product ✅
```

---

## 🎯 Commission Auto-Flow (Backend)

```
Every Payment Triggers:

Payment: ₹4000
    ↓
Commission Calculation
    ↓
Product has 20% commission
    ↓
Commission = ₹4000 × 20% = ₹800
    ↓
Split Commission
    ├─► 90% = ₹720 (Available)
    └─► 10% = ₹80 (Locked)
    ↓
Update Referrer Wallet
    ├─► wallet.balance += ₹720
    └─► wallet.holdBalance += ₹80
    ↓
Create Wallet Transactions
    ├─► Transaction 1: ₹720 (referral_bonus)
    └─► Transaction 2: ₹80 (investment)
    ↓
✅ Commission Credited!

This happens on EVERY payment automatically!
```

---

## 🔄 Order Status Flow

```
Order Created
    ↓
PENDING (waiting for first payment)
    ↓
First Payment Complete
    ↓
ACTIVE (user can pay installments)
    ↓
Daily Payments...
    ↓
All Payments Complete
    ↓
COMPLETED (awaiting admin approval)
    ↓
Admin Approves
    ↓
APPROVED (ready to ship)
    ↓
Admin Ships
    ↓
SHIPPED (in transit)
    ↓
User Receives
    ↓
DELIVERED ✅
```

---

## 🎨 UI States

### Order List Screen
```
┌──────────────────────────────────────┐
│  Active Orders                       │
├──────────────────────────────────────┤
│  📱 iPhone 15 Pro                    │
│  Progress: [████░░░░] 25%           │
│  ₹30,000 / ₹120,000                 │
│  [Pay Next ₹4,000] →                │
├──────────────────────────────────────┤
│  💻 MacBook Pro                      │
│  Progress: [████████] 100%          │
│  Status: Awaiting Approval          │
└──────────────────────────────────────┘
```

### Order Details Screen
```
┌──────────────────────────────────────┐
│  Order: ORD-20241120-A3F2            │
│  iPhone 15 Pro                       │
├──────────────────────────────────────┤
│  Total: ₹120,000                     │
│  Daily: ₹4,000 × 30 days            │
│                                      │
│  Progress: [█████░░░░░] 16.6%       │
│  Paid: ₹20,000 / ₹120,000           │
│  Installments: 5/30                  │
│                                      │
│  Next Due: Day 6                     │
│  Amount: ₹4,000                      │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Pay with Wallet    ▶          │ │
│  │  Pay with Razorpay  ▶          │ │
│  └────────────────────────────────┘ │
│                                      │
│  Payment History ▼                   │
│  ✅ Day 1 - ₹4,000 (15 Nov)        │
│  ✅ Day 2 - ₹4,000 (16 Nov)        │
│  ✅ Day 3 - ₹4,000 (17 Nov)        │
│  ✅ Day 4 - ₹4,000 (18 Nov)        │
│  ✅ Day 5 - ₹4,000 (19 Nov)        │
│  ⏳ Day 6 - ₹4,000 (Pending)       │
│  ⏳ Day 7 - ₹4,000 (Pending)       │
└──────────────────────────────────────┘
```

---

## Summary

**Flutter Calls:** Simple API calls
**Backend Handles:** Everything complex
**Result:** Clean, secure, easy integration! ✅
