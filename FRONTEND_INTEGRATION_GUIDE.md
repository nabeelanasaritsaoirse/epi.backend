# Installment System - Frontend Integration Guide

## Quick Overview

Users can buy products by paying daily installments. First payment happens immediately when order is created. Users can then pay remaining installments daily.

**Two Payment Methods:**
- **Razorpay** - Online payment gateway
- **Wallet** - User's wallet balance

---

## Flow Diagram

```
User selects product
    ↓
Creates order (with first payment)
    ↓
Order becomes ACTIVE
    ↓
User pays daily installments
    ↓
All payments complete → Order COMPLETED
    ↓
Admin approves delivery
    ↓
Product shipped to user
```

---

## API Base URL

```
http://localhost:3000/api/installment
```

**Authentication:** All requests need `Authorization: Bearer <token>` header

---

## 1️⃣ CREATE ORDER FLOW

### Step 1: User Selects Product & Payment Plan

**Frontend Action:** User chooses:
- Product
- Number of days (min 5 days)
- Payment method (Razorpay or Wallet)
- Delivery address

---

### Step 2A: Create Order with WALLET Payment

**Endpoint:** `POST /orders`

**Request:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "totalDays": 30,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

**Response (Success):**
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
    }
  }
}
```

**Frontend Action:**
- ✅ Show success message
- ✅ Redirect to order details page
- ✅ Show remaining installments: 29

---

### Step 2B: Create Order with RAZORPAY Payment

**Endpoint:** `POST /orders`

**Request:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "totalDays": 30,
  "paymentMethod": "RAZORPAY",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Order created successfully. Please complete payment via Razorpay.",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "PENDING"
    },
    "razorpayOrder": {
      "id": "order_MXkj8d9sKLm2Pq",
      "amount": 400000,
      "currency": "INR",
      "keyId": "rzp_test_xxxxx"
    }
  }
}
```

**Frontend Action:**
1. ✅ Open Razorpay checkout with order details
2. ✅ User completes payment on Razorpay
3. ✅ Razorpay returns payment details
4. ✅ Verify payment (next step below)

---

### Step 3: Verify Razorpay Payment (First Payment)

**Endpoint:** `POST /payments/process`

**Request:**
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
  "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
  "razorpaySignature": "signature_from_razorpay"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully. 29 installment(s) remaining.",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "ACTIVE",
      "totalPaidAmount": 4000,
      "remainingAmount": 116000,
      "progress": 3.33
    }
  }
}
```

**Frontend Action:**
- ✅ Show payment success
- ✅ Redirect to order details
- ✅ Order is now ACTIVE

---

## 2️⃣ VIEW ORDER DETAILS

**Endpoint:** `GET /orders/{orderId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "iPhone 15 Pro",
      "productPrice": 120000,
      "dailyPaymentAmount": 4000,
      "totalDays": 30,
      "paidInstallments": 3,
      "totalPaidAmount": 12000,
      "remainingAmount": 108000,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "progress": 10
    }
  }
}
```

**Frontend Display:**
```
Product: iPhone 15 Pro
Total Price: ₹120,000
Daily Payment: ₹4,000
Progress: 10% (3/30 installments paid)
Remaining: ₹108,000

[Pay Next Installment Button]
```

---

## 3️⃣ GET PAYMENT SCHEDULE

**Endpoint:** `GET /orders/{orderId}/schedule`

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "installmentNumber": 1,
        "dueDate": "2024-11-15",
        "amount": 4000,
        "status": "PAID",
        "paidDate": "2024-11-15T10:30:00Z"
      },
      {
        "installmentNumber": 2,
        "dueDate": "2024-11-16",
        "amount": 4000,
        "status": "PAID",
        "paidDate": "2024-11-16T14:20:00Z"
      },
      {
        "installmentNumber": 3,
        "dueDate": "2024-11-17",
        "amount": 4000,
        "status": "PENDING",
        "paidDate": null
      }
    ],
    "summary": {
      "totalInstallments": 30,
      "paidInstallments": 2,
      "pendingInstallments": 28
    }
  }
}
```

**Frontend Display:**
```
✅ Day 1 - ₹4,000 (Paid on 15 Nov)
✅ Day 2 - ₹4,000 (Paid on 16 Nov)
⏳ Day 3 - ₹4,000 (Pending)
⏳ Day 4 - ₹4,000 (Pending)
...
```

---

## 4️⃣ DAILY PAYMENT FLOW

### Option A: Pay with WALLET

**Endpoint:** `POST /payments/process`

**Request:**
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
  "message": "Payment processed successfully. 27 installment(s) remaining.",
  "data": {
    "payment": {
      "paymentId": "PAY-20241120-C8D2",
      "amount": 4000,
      "installmentNumber": 3,
      "status": "COMPLETED"
    },
    "order": {
      "totalPaidAmount": 12000,
      "remainingAmount": 108000,
      "progress": 10,
      "isCompleted": false
    }
  }
}
```

**Frontend Action:**
- ✅ Deduct from wallet balance display
- ✅ Update progress bar
- ✅ Show success message
- ✅ Update payment schedule

---

### Option B: Pay with RAZORPAY

**Step 1:** Create Razorpay Order

**Endpoint:** `POST /payments/create-razorpay-order`

**Request:**
```json
{
  "orderId": "ORD-20241120-A3F2"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
    "amount": 400000,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx",
    "installmentNumber": 3
  }
}
```

**Frontend Action:**
1. ✅ Open Razorpay checkout
2. ✅ User pays
3. ✅ Razorpay returns payment details

---

**Step 2:** Verify Payment

**Endpoint:** `POST /payments/process`

**Request:**
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
  "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
  "razorpaySignature": "signature_from_razorpay"
}
```

**Response:** Same as wallet payment response

---

## 5️⃣ VIEW USER'S ALL ORDERS

**Endpoint:** `GET /orders`

**Query Params (Optional):**
- `status` - ACTIVE, COMPLETED, CANCELLED
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Example:** `GET /orders?status=ACTIVE&page=1&limit=10`

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "ORD-20241120-A3F2",
        "productName": "iPhone 15 Pro",
        "productPrice": 120000,
        "totalPaidAmount": 12000,
        "remainingAmount": 108000,
        "status": "ACTIVE",
        "progress": 10,
        "createdAt": "2024-11-15T10:00:00Z"
      },
      {
        "orderId": "ORD-20241118-B5X9",
        "productName": "MacBook Pro",
        "productPrice": 200000,
        "totalPaidAmount": 200000,
        "remainingAmount": 0,
        "status": "COMPLETED",
        "progress": 100,
        "createdAt": "2024-10-20T08:00:00Z"
      }
    ],
    "count": 2,
    "page": 1
  }
}
```

**Frontend Display:**
```
Active Orders:
- iPhone 15 Pro (10% paid) → [Pay Now]

Completed Orders:
- MacBook Pro (100% paid) → [View Details]
```

---

## 6️⃣ CANCEL ORDER

**Endpoint:** `POST /orders/{orderId}/cancel`

**Request:**
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
      "status": "CANCELLED"
    }
  }
}
```

**Frontend Action:**
- ✅ Show cancellation confirmation
- ✅ Update order list
- ✅ Show cancelled status

---

## 🎨 UI/UX Recommendations

### Product Page
```
┌─────────────────────────────┐
│ iPhone 15 Pro - ₹120,000   │
│                             │
│ Pay in installments:        │
│ ┌─────────────────────────┐ │
│ │ Days: [30] ▼           │ │
│ │ Daily: ₹4,000          │ │
│ └─────────────────────────┘ │
│                             │
│ Payment Method:             │
│ ○ Razorpay  ○ Wallet       │
│                             │
│ [Create Order]              │
└─────────────────────────────┘
```

### Order Details Page
```
┌─────────────────────────────┐
│ Order: ORD-20241120-A3F2   │
│ iPhone 15 Pro              │
│                             │
│ Progress: [████░░░░] 10%   │
│ ₹12,000 / ₹120,000         │
│                             │
│ Paid: 3/30 installments    │
│ Daily: ₹4,000              │
│                             │
│ [Pay Next Installment]     │
│                             │
│ Payment History ▼          │
│ ✅ 15 Nov - ₹4,000         │
│ ✅ 16 Nov - ₹4,000         │
│ ✅ 17 Nov - ₹4,000         │
└─────────────────────────────┘
```

---

## ⚠️ Error Handling

**Common Errors:**

### Insufficient Wallet Balance
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
  }
}
```

**Frontend:** Show "Add ₹1,500 to wallet to continue"

---

### Order Already Completed
```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_COMPLETED",
    "message": "Order has already been completed. All payments received."
  }
}
```

**Frontend:** Redirect to order details, show "Awaiting delivery approval"

---

### Validation Error
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
          "message": "Total days must be at least 5"
        }
      ]
    }
  }
}
```

**Frontend:** Show field-specific error messages

---

## 📱 Razorpay Integration Code

### Frontend (JavaScript)

```javascript
// Step 1: Create order and get Razorpay order ID
const createOrder = async () => {
  const response = await fetch('http://localhost:3000/api/installment/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: '64a1b2c3d4e5f6789012345',
      totalDays: 30,
      paymentMethod: 'RAZORPAY',
      deliveryAddress: { /* address */ }
    })
  });

  const data = await response.json();
  return data.data.razorpayOrder;
};

// Step 2: Open Razorpay checkout
const openRazorpay = (razorpayOrder) => {
  const options = {
    key: razorpayOrder.keyId,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    order_id: razorpayOrder.id,
    name: 'Your Store Name',
    description: 'Installment Payment',
    handler: function(response) {
      // Step 3: Verify payment
      verifyPayment(response);
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
};

// Step 3: Verify payment
const verifyPayment = async (razorpayResponse) => {
  const response = await fetch('http://localhost:3000/api/installment/payments/process', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: 'ORD-20241120-A3F2',
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: razorpayResponse.razorpay_order_id,
      razorpayPaymentId: razorpayResponse.razorpay_payment_id,
      razorpaySignature: razorpayResponse.razorpay_signature
    })
  });

  const data = await response.json();
  if (data.success) {
    // Show success message
    alert('Payment successful!');
  }
};
```

---

## 🔄 Complete User Journey

### First Time Order
```
1. User browses product
2. Clicks "Buy with Installments"
3. Selects days (e.g., 30 days)
4. Enters delivery address
5. Chooses payment method
6. Pays first installment
7. Order created with status ACTIVE
8. Redirected to order details
```

### Daily Payment
```
1. User opens "My Orders"
2. Clicks on active order
3. Sees payment schedule
4. Clicks "Pay Next Installment"
5. Chooses payment method
6. Completes payment
7. Progress bar updates
8. Payment marked in schedule
```

### Order Completion
```
1. User pays last installment
2. Order status → COMPLETED
3. Show "Awaiting delivery approval"
4. Admin approves delivery
5. Order status → APPROVED
6. Admin ships product
7. Show "Order shipped"
8. User receives product
```

---

## 📊 Key Data Points to Display

**On Product Page:**
- Daily payment amount
- Total days
- Total price

**On Order Details:**
- Progress percentage
- Amount paid / Total amount
- Installments paid / Total installments
- Next due date (optional)
- Payment schedule with status

**On Order List:**
- Order ID
- Product name
- Progress bar
- Status badge (ACTIVE/COMPLETED)
- Quick pay button for active orders

---

## ✅ Testing Checklist

- [ ] Create order with wallet payment
- [ ] Create order with Razorpay payment
- [ ] View order details
- [ ] View payment schedule
- [ ] Pay installment with wallet
- [ ] Pay installment with Razorpay
- [ ] View order list
- [ ] Cancel order
- [ ] Handle insufficient balance error
- [ ] Handle validation errors

---

## 🆘 Quick Troubleshooting

**Payment fails with "Insufficient Balance"**
→ Check wallet balance first, show "Add Money" option

**Razorpay popup doesn't open**
→ Ensure Razorpay script is loaded: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`

**Order not found error**
→ Verify orderId is correct (use the orderId from response, not _id)

**Payment already processed**
→ This is normal, prevents duplicate payments. Refresh order details to see latest status

---

## 📞 Need Help?

**Backend Issues:**
- Check API response `error.code` and `error.message`
- Review `error.details` for specific information

**Integration Issues:**
- Verify authorization token is valid
- Check request body matches sample JSON
- Ensure content-type is `application/json`

---

**Quick Reference:**
- Base URL: `http://localhost:3000/api/installment`
- Auth Header: `Authorization: Bearer <token>`
- All responses have `success: true/false`
- Error details in `error.code` and `error.message`

---

**Status:** Ready for Integration ✅
