# Installment Order - First Payment Verification Guide

## For Flutter Team

**Date:** December 29, 2025
**Version:** 1.0

---

## What Changed?

Previously, when a user created an installment order with **Razorpay** payment method, the order was immediately created in the database even before the user completed the payment. This caused issues because:

- Orders were being created without actual payment
- Users could abandon the payment page and still have an order in the system
- The order status was showing as "PENDING" but the order existed in the database

### The Fix

We have introduced a **two-step process** for Razorpay payments:

1. **Step 1:** Create order (status = `PENDING`)
2. **Step 2:** Verify payment and activate order (status = `ACTIVE`)

For **Wallet** payments, the flow remains the same (single step) because wallet deduction happens immediately.

---

## New API Endpoint

### POST `/api/installments/orders/verify-first-payment`

This endpoint must be called after the Razorpay payment is successful.

#### Request Headers

```
Content-Type: application/json
Authorization: Bearer <user_token>
```

#### Request Body

```json
{
  "orderId": "string",           // Required - Order ID from create order response (_id or orderId)
  "razorpayOrderId": "string",   // Required - Razorpay order ID
  "razorpayPaymentId": "string", // Required - From Razorpay success callback
  "razorpaySignature": "string"  // Required - From Razorpay success callback
}
```

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "success": true,
    "order": {
      "orderId": "ORD-20251229-12345",
      "_id": "507f1f77bcf86cd799439011",
      "status": "ACTIVE",
      "productName": "iPhone 15",
      "dailyPaymentAmount": 500,
      "totalDays": 100,
      "paidInstallments": 1,
      "totalPaidAmount": 500,
      "remainingAmount": 49500
    },
    "payment": {
      "paymentId": "507f1f77bcf86cd799439012",
      "amount": 500,
      "status": "COMPLETED",
      "completedAt": "2025-12-29T10:30:00.000Z"
    },
    "message": "First payment verified successfully. Order is now ACTIVE."
  },
  "message": "First payment verified successfully. Order is now ACTIVE."
}
```

#### Error Responses

| Status Code | Message | Reason |
|-------------|---------|--------|
| 400 | "orderId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required" | Missing required fields |
| 404 | "Order not found" | Invalid order ID or order doesn't belong to user |
| 400 | "Order is already ACTIVE. First payment was already processed." | Payment already verified |
| 400 | "First payment record not found or already processed" | Payment record issue |
| 400 | "Razorpay order ID mismatch" | Wrong Razorpay order ID |
| 400 | "Invalid payment signature. Payment verification failed." | Signature verification failed |

---

## Complete Flow for Flutter

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RAZORPAY PAYMENT FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User selects product and chooses RAZORPAY                       │
│                        │                                            │
│                        ▼                                            │
│  2. Call POST /api/installments/orders                              │
│     Body: { productId, totalDays, paymentMethod: "RAZORPAY", ... }  │
│                        │                                            │
│                        ▼                                            │
│  3. Response contains:                                              │
│     - order._id (Save this!)                                        │
│     - razorpayOrder.id                                              │
│     - razorpayOrder.amount                                          │
│     - order.status = "PENDING"                                      │
│                        │                                            │
│                        ▼                                            │
│  4. Open Razorpay Payment Sheet                                     │
│     - Use razorpayOrder.id as order_id                              │
│     - Use razorpayOrder.amount as amount                            │
│                        │                                            │
│              ┌────────┴────────┐                                    │
│              │                 │                                    │
│              ▼                 ▼                                    │
│     Payment Success      Payment Failed                             │
│              │                 │                                    │
│              ▼                 ▼                                    │
│  5. Call verify-first-payment  Show error message                   │
│     POST /api/installments/orders/verify-first-payment              │
│     Body: {                                                         │
│       orderId: order._id,                                           │
│       razorpayOrderId,                                              │
│       razorpayPaymentId,                                            │
│       razorpaySignature                                             │
│     }                                                               │
│              │                                                      │
│              ▼                                                      │
│  6. Order is now ACTIVE!                                            │
│     Navigate to Order Success Screen                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow for Wallet Payment (No Change)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WALLET PAYMENT FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User selects product and chooses WALLET                         │
│                        │                                            │
│                        ▼                                            │
│  2. Call POST /api/installments/orders                              │
│     Body: { productId, totalDays, paymentMethod: "WALLET", ... }    │
│                        │                                            │
│                        ▼                                            │
│  3. Response contains:                                              │
│     - order._id                                                     │
│     - order.status = "ACTIVE" (Already active!)                     │
│     - firstPayment.status = "COMPLETED"                             │
│                        │                                            │
│                        ▼                                            │
│  4. Navigate to Order Success Screen                                │
│     (No additional API call needed)                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flutter Code Example

### Step 1: Create Order

```dart
Future<Map<String, dynamic>> createInstallmentOrder({
  required String productId,
  required int totalDays,
  required String paymentMethod,
  required Map<String, dynamic> deliveryAddress,
  String? variantId,
  String? couponCode,
  int quantity = 1,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/orders'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $userToken',
    },
    body: jsonEncode({
      'productId': productId,
      'totalDays': totalDays,
      'paymentMethod': paymentMethod,
      'deliveryAddress': deliveryAddress,
      'variantId': variantId,
      'couponCode': couponCode,
      'quantity': quantity,
    }),
  );

  if (response.statusCode == 201) {
    return jsonDecode(response.body);
  } else {
    throw Exception('Failed to create order');
  }
}
```

### Step 2: Handle Razorpay Payment

```dart
void initiateRazorpayPayment(Map<String, dynamic> orderResponse) {
  final razorpayOrder = orderResponse['data']['razorpayOrder'];
  final order = orderResponse['data']['order'];

  // Save order ID for later use
  String orderId = order['_id'];

  var options = {
    'key': 'your_razorpay_key_id',
    'amount': razorpayOrder['amount'], // Amount in paise
    'name': 'Your App Name',
    'description': 'Installment Order - ${order['productName']}',
    'order_id': razorpayOrder['id'],
    'prefill': {
      'contact': userPhone,
      'email': userEmail,
    },
  };

  try {
    _razorpay.open(options);
  } catch (e) {
    debugPrint('Error: $e');
  }
}
```

### Step 3: Handle Payment Success - Call Verify API

```dart
void _handlePaymentSuccess(PaymentSuccessResponse response) async {
  // IMPORTANT: Call verify-first-payment API here

  try {
    final verifyResponse = await verifyFirstPayment(
      orderId: savedOrderId, // Order ID saved from Step 1
      razorpayOrderId: response.orderId!,
      razorpayPaymentId: response.paymentId!,
      razorpaySignature: response.signature!,
    );

    if (verifyResponse['success'] == true) {
      // Payment verified successfully
      // Order is now ACTIVE
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => OrderSuccessScreen(
            order: verifyResponse['data']['order'],
          ),
        ),
      );
    }
  } catch (e) {
    // Show error to user
    showErrorDialog('Payment verification failed. Please contact support.');
  }
}

Future<Map<String, dynamic>> verifyFirstPayment({
  required String orderId,
  required String razorpayOrderId,
  required String razorpayPaymentId,
  required String razorpaySignature,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/orders/verify-first-payment'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $userToken',
    },
    body: jsonEncode({
      'orderId': orderId,
      'razorpayOrderId': razorpayOrderId,
      'razorpayPaymentId': razorpayPaymentId,
      'razorpaySignature': razorpaySignature,
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    final error = jsonDecode(response.body);
    throw Exception(error['message'] ?? 'Verification failed');
  }
}
```

### Step 4: Handle Payment Failure

```dart
void _handlePaymentError(PaymentFailureResponse response) {
  // Payment failed
  // The order remains in PENDING status
  // User can retry payment later or the order will be cleaned up

  showErrorDialog(
    'Payment failed. Please try again.\nError: ${response.message}',
  );
}
```

---

## Important Notes

1. **Always save the `order._id`** from the create order response. You will need it for the verify API.

2. **For WALLET payments**, you don't need to call the verify API. The order is already ACTIVE after the create order call.

3. **For RAZORPAY payments**, you MUST call the verify API after successful payment. Otherwise, the order will remain in PENDING status.

4. **Order Status Flow:**
   - `PENDING` - Order created, waiting for first payment (Razorpay only)
   - `ACTIVE` - First payment done, user can make daily payments
   - `COMPLETED` - All payments done
   - `CANCELLED` - Order cancelled

5. **Error Handling:** If the verify API fails, show an error message to the user and suggest contacting support. The payment was successful on Razorpay's side, so the backend team can manually verify and activate the order if needed.

---

## Testing Checklist

- [ ] Create order with RAZORPAY - verify order status is PENDING
- [ ] Complete Razorpay payment
- [ ] Call verify-first-payment API
- [ ] Verify order status changes to ACTIVE
- [ ] Verify first payment record is COMPLETED
- [ ] Verify commission is credited to referrer (if applicable)
- [ ] Create order with WALLET - verify order status is ACTIVE immediately
- [ ] Test payment failure scenario - order should remain PENDING

---

## Support

If you have any questions or face issues during implementation, please contact the backend team.
