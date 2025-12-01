# 💰 Combined Daily Payment API

## Overview

Yeh API multiple installment orders ki daily payments ek saath (in one transaction) process karne ke liye hai. Instead of paying each order separately, user ab multiple orders select kar ke ek hi payment mein sabhi ka daily installment pay kar sakta hai.

## Benefits

✅ **Convenience** - Ek click mein multiple orders pay karo
✅ **Faster** - Ek hi transaction, ek hi API call
✅ **Razorpay & Wallet** - Dono payment methods support
✅ **Commission** - Automatically har order ka commission calculate hota hai
✅ **Atomic** - Ya to sabhi orders pay honge, ya koi nahi (transaction safety)

---

## 🔗 API Endpoints

### 1. Get Daily Pending Payments

**Endpoint:** `GET /api/installments/payments/daily-pending`

**Description:** Aaj ki saari pending payments ka list, jinhe pay karna hai.

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "Daily pending installment payments retrieved successfully",
  "data": {
    "count": 3,
    "totalAmount": 600,
    "payments": [
      {
        "orderId": "ORD-20251127-A1F3",
        "productName": "Bouquet",
        "installmentNumber": 2,
        "amount": 200,
        "dueDate": "2025-11-28T06:06:46.718Z"
      },
      {
        "orderId": "ORD-20251127-B2F4",
        "productName": "Rose Plant",
        "installmentNumber": 3,
        "amount": 200,
        "dueDate": "2025-11-28T07:15:22.123Z"
      },
      {
        "orderId": "ORD-20251126-C3D5",
        "productName": "Tulip",
        "installmentNumber": 1,
        "amount": 200,
        "dueDate": "2025-11-28T08:30:11.456Z"
      }
    ]
  }
}
```

---

### 2. Create Combined Razorpay Order

**Endpoint:** `POST /api/installments/payments/create-combined-razorpay`

**Description:** Multiple orders ke liye ek combined Razorpay order create karta hai.

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "selectedOrders": [
    "ORD-20251127-A1F3",
    "ORD-20251127-B2F4",
    "ORD-20251126-C3D5"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Combined Razorpay order created successfully. Proceed with payment.",
  "data": {
    "razorpayOrderId": "order_ABC123XYZ456",
    "amount": 60000,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx",
    "totalAmount": 600,
    "orderCount": 3,
    "orders": [
      {
        "orderId": "ORD-20251127-A1F3",
        "productName": "Bouquet",
        "dailyAmount": 200
      },
      {
        "orderId": "ORD-20251127-B2F4",
        "productName": "Rose Plant",
        "dailyAmount": 200
      },
      {
        "orderId": "ORD-20251126-C3D5",
        "productName": "Tulip",
        "dailyAmount": 200
      }
    ]
  }
}
```

---

### 3. Process Combined Daily Payment

**Endpoint:** `POST /api/installments/payments/pay-daily-selected`

**Description:** Multiple orders ki daily payments ko ek transaction mein process karta hai.

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

**Request Body (Wallet Payment):**
```json
{
  "selectedOrders": [
    "ORD-20251127-A1F3",
    "ORD-20251127-B2F4",
    "ORD-20251126-C3D5"
  ],
  "paymentMethod": "WALLET"
}
```

**Request Body (Razorpay Payment):**
```json
{
  "selectedOrders": [
    "ORD-20251127-A1F3",
    "ORD-20251127-B2F4",
    "ORD-20251126-C3D5"
  ],
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_ABC123XYZ456",
  "razorpayPaymentId": "pay_DEF789GHI012",
  "razorpaySignature": "signature_string_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 3 order payment(s). Total amount: ₹600",
  "data": {
    "success": true,
    "totalAmount": 600,
    "ordersProcessed": 3,
    "payments": [
      {
        "orderId": "ORD-20251127-A1F3",
        "paymentId": "PAY-20251128-F1G2",
        "amount": 200,
        "installmentNumber": 2,
        "orderStatus": "ACTIVE"
      },
      {
        "orderId": "ORD-20251127-B2F4",
        "paymentId": "PAY-20251128-G2H3",
        "amount": 200,
        "installmentNumber": 3,
        "orderStatus": "ACTIVE"
      },
      {
        "orderId": "ORD-20251126-C3D5",
        "paymentId": "PAY-20251128-H3I4",
        "amount": 200,
        "installmentNumber": 1,
        "orderStatus": "COMPLETED"
      }
    ],
    "commissions": [
      {
        "orderId": "ORD-20251127-A1F3",
        "commissionCalculated": true,
        "commissionAmount": 20
      },
      {
        "orderId": "ORD-20251127-B2F4",
        "commissionCalculated": true,
        "commissionAmount": 20
      },
      {
        "orderId": "ORD-20251126-C3D5",
        "commissionCalculated": true,
        "commissionAmount": 20
      }
    ]
  }
}
```

---

## 🔄 Complete Flow

### Option 1: Wallet Payment

```javascript
// Step 1: Get pending payments
const pendingResponse = await fetch('/api/installments/payments/daily-pending', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const pending = await pendingResponse.json();

// Step 2: Select orders to pay (or use all)
const selectedOrders = pending.data.payments.map(p => p.orderId);

// Step 3: Process payment via wallet
const paymentResponse = await fetch('/api/installments/payments/pay-daily-selected', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    selectedOrders,
    paymentMethod: 'WALLET'
  })
});

const result = await paymentResponse.json();
console.log(`Paid ${result.data.ordersProcessed} orders, Total: ₹${result.data.totalAmount}`);
```

### Option 2: Razorpay Payment

```javascript
// Step 1: Get pending payments
const pendingResponse = await fetch('/api/installments/payments/daily-pending', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const pending = await pendingResponse.json();

// Step 2: Select orders
const selectedOrders = pending.data.payments.map(p => p.orderId);

// Step 3: Create combined Razorpay order
const razorpayOrderResponse = await fetch('/api/installments/payments/create-combined-razorpay', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ selectedOrders })
});

const razorpayData = await razorpayOrderResponse.json();

// Step 4: Show Razorpay checkout
const options = {
  key: razorpayData.data.keyId,
  amount: razorpayData.data.amount,
  currency: razorpayData.data.currency,
  order_id: razorpayData.data.razorpayOrderId,
  name: 'Epi Backend',
  description: `Payment for ${razorpayData.data.orderCount} orders`,
  handler: async function(response) {
    // Step 5: Verify and process payment
    const verifyResponse = await fetch('/api/installments/payments/pay-daily-selected', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selectedOrders,
        paymentMethod: 'RAZORPAY',
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature
      })
    });

    const result = await verifyResponse.json();
    console.log('Payment successful!', result);
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

## 🚨 Error Responses

### No Orders Selected
```json
{
  "success": false,
  "message": "selectedOrders array is required and must not be empty"
}
```

### Invalid Payment Method
```json
{
  "success": false,
  "message": "paymentMethod must be either RAZORPAY or WALLET"
}
```

### Order Already Paid Today
```json
{
  "success": false,
  "message": "Order ORD-20251127-A1F3 has already been paid today"
}
```

### Insufficient Wallet Balance
```json
{
  "success": false,
  "message": "Insufficient wallet balance"
}
```

### Invalid Razorpay Signature
```json
{
  "success": false,
  "message": "Razorpay signature verification failed"
}
```

---

## 📱 Flutter/Dart Example

```dart
class CombinedPaymentService {
  final String baseUrl = 'https://api.epielio.com/api/installments';

  Future<void> payMultipleOrders(List<String> orderIds) async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();

    // Step 1: Create Razorpay order
    final razorpayResponse = await http.post(
      Uri.parse('$baseUrl/payments/create-combined-razorpay'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({'selectedOrders': orderIds}),
    );

    final razorpayData = json.decode(razorpayResponse.body)['data'];

    // Step 2: Show Razorpay checkout
    var options = {
      'key': razorpayData['keyId'],
      'amount': razorpayData['amount'],
      'currency': razorpayData['currency'],
      'order_id': razorpayData['razorpayOrderId'],
      'name': 'Epi Backend',
      'description': 'Payment for ${razorpayData['orderCount']} orders',
    };

    _razorpay.open(options);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();

    // Step 3: Verify payment
    final verifyResponse = await http.post(
      Uri.parse('$baseUrl/payments/pay-daily-selected'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'selectedOrders': selectedOrderIds,
        'paymentMethod': 'RAZORPAY',
        'razorpayOrderId': response.orderId,
        'razorpayPaymentId': response.paymentId,
        'razorpaySignature': response.signature,
      }),
    );

    final result = json.decode(verifyResponse.body);
    print('Payment successful: ${result['message']}');
  }
}
```

---

## ⚡ Key Features

1. **One-Payment-Per-Day Rule**: Har order ke liye ek din mein sirf ek payment ho sakti hai
2. **Atomic Transaction**: Agar ek bhi order fail ho, to sabhi orders rollback ho jayenge
3. **Commission Auto-calculated**: Har order ka commission automatically calculate aur credit hota hai
4. **Milestone Rewards**: Agar milestone coupon applied hai, to automatic free days apply honge
5. **Order Completion**: Agar last payment hai, to order automatically COMPLETED status mein chala jayega

---

## 🧪 Testing

Test script run karne ke liye:

```bash
# Install dependencies (if not already installed)
npm install axios

# Set your access token in test-combined-payment-api.js
# Then run:
node test-combined-payment-api.js
```

---

## 📝 Notes

- **Starting Point**: `/api/installments/orders/` se order list milti hai
- **Daily Pending**: `/api/installments/payments/daily-pending` se aaj ki pending payments milti hain
- **Combined Payment**: Ab multiple orders ek saath pay kar sakte hain
- **Safety**: One payment per order per day rule ensure karta hai duplicate payments nahi hongi

---

**Version:** 1.0
**Last Updated:** November 28, 2025
**Status:** ✅ Ready for Integration
