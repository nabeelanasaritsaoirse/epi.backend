# Quick API Reference - Installment System

## 🚀 All Endpoints You Need

**Base URL:** `http://localhost:3000/api/installment`

**Auth:** Add `Authorization: Bearer <token>` to all requests

---

## 📋 Endpoints List

| # | Method | Endpoint | Use Case |
|---|--------|----------|----------|
| 1 | POST | `/orders` | Create new order |
| 2 | GET | `/orders` | Get user's all orders |
| 3 | GET | `/orders/:orderId` | Get single order details |
| 4 | GET | `/orders/:orderId/schedule` | Get payment schedule |
| 5 | POST | `/orders/:orderId/cancel` | Cancel order |
| 6 | POST | `/payments/create-razorpay-order` | Create Razorpay order for payment |
| 7 | POST | `/payments/process` | Process payment (Wallet/Razorpay) |
| 8 | GET | `/payments/my-payments` | Get user's payment history |

---

## 1. Create Order

```
POST /orders
```

**Request:**
```json
{
  "productId": "PRODUCT_ID_HERE",
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

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "ACTIVE",
      "productPrice": 120000,
      "dailyPaymentAmount": 4000,
      "totalDays": 30,
      "paidInstallments": 1,
      "remainingAmount": 116000
    }
  }
}
```

---

## 2. Get All Orders

```
GET /orders?status=ACTIVE&page=1&limit=20
```

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
        "progress": 10,
        "totalPaidAmount": 12000,
        "remainingAmount": 108000
      }
    ]
  }
}
```

---

## 3. Get Order Details

```
GET /orders/ORD-20241120-A3F2
```

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

## 4. Get Payment Schedule

```
GET /orders/ORD-20241120-A3F2/schedule
```

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
    ],
    "summary": {
      "totalInstallments": 30,
      "paidInstallments": 1,
      "pendingInstallments": 29
    }
  }
}
```

---

## 5. Pay with Wallet

```
POST /payments/process
```

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
      "status": "COMPLETED"
    },
    "order": {
      "totalPaidAmount": 16000,
      "remainingAmount": 104000,
      "progress": 13.33
    }
  }
}
```

---

## 6. Pay with Razorpay (2 Steps)

### Step 1: Create Razorpay Order

```
POST /payments/create-razorpay-order
```

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
    "keyId": "rzp_test_xxxxx",
    "installmentNumber": 2
  }
}
```

### Step 2: Verify Payment

```
POST /payments/process
```

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

---

## 7. Cancel Order

```
POST /orders/ORD-20241120-A3F2/cancel
```

**Request:**
```json
{
  "reason": "Found a better deal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully"
}
```

---

## Common Errors

### Insufficient Balance
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

### Order Not Found
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
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

---

## Important Rules

✅ **Min Days:** 5 days
✅ **Min Daily Amount:** ₹50
✅ **Max Days:**
  - ≤ ₹10,000 → 100 days
  - ≤ ₹50,000 → 180 days
  - > ₹50,000 → 365 days

✅ **First Payment:** Happens immediately when order is created
✅ **Order Status:** PENDING → ACTIVE → COMPLETED
✅ **Payment Methods:** RAZORPAY or WALLET

---

## Testing URLs

Replace `{orderId}` with actual order ID like `ORD-20241120-A3F2`

```
GET /orders
GET /orders/ORD-20241120-A3F2
GET /orders/ORD-20241120-A3F2/schedule
POST /orders
POST /payments/process
POST /orders/ORD-20241120-A3F2/cancel
```

---

**Need the complete guide?** See `FRONTEND_INTEGRATION_GUIDE.md`
