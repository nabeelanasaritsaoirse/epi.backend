# API Endpoints Summary - For Flutter Team

## 🎯 Key Point

**Backend handles EVERYTHING:**
- ✅ Creates Razorpay orders
- ✅ Verifies payment signatures
- ✅ Processes wallet payments
- ✅ Calculates commissions
- ✅ Updates order status

**Flutter just:**
- Calls APIs
- Opens Razorpay SDK with backend-provided details
- Sends payment response to backend

---

## Base URL
```
http://your-server.com/api/installment
```

**All requests need:** `Authorization: Bearer <token>`

---

## Quick Flow

### Wallet Payment (1 API call)
```
POST /orders (paymentMethod: WALLET)
    ↓
✅ Done! Order created, payment deducted
```

### Razorpay Payment (2 API calls)
```
POST /orders (paymentMethod: RAZORPAY)
    ↓
Backend returns Razorpay order details
    ↓
Open Razorpay SDK (user pays)
    ↓
POST /payments/process (send payment response)
    ↓
✅ Done! Backend verifies & completes
```

---

## All Endpoints

### 1. Create Order

**POST** `/orders`

```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "totalDays": 30,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

**Wallet Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "ACTIVE",
      "dailyPaymentAmount": 4000,
      "paidInstallments": 1
    }
  }
}
```

**Razorpay Response:**
```json
{
  "success": true,
  "data": {
    "order": { "orderId": "ORD-20241120-A3F2" },
    "razorpayOrder": {
      "id": "order_MXkj8d9sKLm2Pq",
      "amount": 400000,
      "keyId": "rzp_test_xxxxx"
    }
  }
}
```

---

### 2. Process Payment (Verify Razorpay)

**POST** `/payments/process`

```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
  "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
  "razorpaySignature": "signature_from_sdk"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "order": {
      "status": "ACTIVE",
      "progress": 10
    }
  }
}
```

---

### 3. Get Order Details

**GET** `/orders/:orderId`

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
      "progress": 10
    }
  }
}
```

---

### 4. Get Payment Schedule

**GET** `/orders/:orderId/schedule`

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": [
      {
        "installmentNumber": 1,
        "amount": 4000,
        "status": "PAID",
        "paidDate": "2024-11-15"
      },
      {
        "installmentNumber": 2,
        "amount": 4000,
        "status": "PENDING",
        "paidDate": null
      }
    ]
  }
}
```

---

### 5. Get User's Orders

**GET** `/orders?status=ACTIVE&page=1`

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "ORD-20241120-A3F2",
        "productName": "iPhone 15 Pro",
        "status": "ACTIVE",
        "progress": 10
      }
    ]
  }
}
```

---

### 6. Pay Daily Installment (Wallet)

**POST** `/payments/process`

```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "WALLET"
}
```

---

### 7. Pay Daily Installment (Razorpay)

**Step 1:** Create Razorpay order

**POST** `/payments/create-razorpay-order`

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
    "keyId": "rzp_test_xxxxx"
  }
}
```

**Step 2:** After user pays, verify (same as endpoint #2)

---

### 8. Cancel Order

**POST** `/orders/:orderId/cancel`

```json
{
  "reason": "Found better deal"
}
```

---

## Common Errors

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance",
    "details": {
      "required": 4000,
      "available": 2500
    }
  }
}
```

Error Codes:
- `INSUFFICIENT_BALANCE` - Not enough wallet balance
- `ORDER_NOT_FOUND` - Invalid order ID
- `ORDER_ALREADY_COMPLETED` - Order fully paid
- `VALIDATION_ERROR` - Check details.errors array

---

## Important Rules

- Min days: 5
- Min daily amount: ₹50
- Max days: 100-365 (based on price)
- First payment: Immediate
- Commission: Auto-credited on every payment

---

## What Backend Auto-Handles

✅ Creates Razorpay orders
✅ Verifies Razorpay signatures
✅ Deducts wallet balance
✅ Calculates daily amount
✅ Generates payment schedule
✅ Calculates commission (90-10 split)
✅ Credits referrer wallet
✅ Updates order status
✅ Marks installments paid

**Flutter just calls APIs and shows Razorpay SDK!**
