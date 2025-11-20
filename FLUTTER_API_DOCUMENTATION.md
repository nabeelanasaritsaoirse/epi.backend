# Flutter API Documentation - Installment Orders

## 📚 Complete Guide for Flutter Team

This document contains **all API endpoints** you need to integrate the installment order system.

---

## 🔗 Base URL

```
http://your-server.com/api/installment
```

**Authentication Required:** Most endpoints require Bearer token
```
Authorization: Bearer <user_token>
```

---

## 📋 Table of Contents

1. [Order Creation Flow](#order-creation-flow)
2. [Coupon Validation](#1-validate-coupon-optional)
3. [Create Order](#2-create-order)
4. [Get Order Details](#3-get-order-details)
5. [Get User Orders](#4-get-user-orders)
6. [Get Payment Schedule](#5-get-payment-schedule)
7. [Process Payment](#6-process-payment)
8. [Create Razorpay Order for Installment](#7-create-razorpay-order-for-installment)
9. [Cancel Order](#8-cancel-order)
10. [Complete Examples](#complete-examples)

---

## 🔄 Order Creation Flow

```
Step 1: User selects product
    ↓
Step 2: [Optional] User enters coupon → Validate coupon
    ↓
Step 3: User selects days (30, 60, etc.)
    ↓
Step 4: User selects payment method (Wallet/Razorpay)
    ↓
Step 5: Create order
    ↓
    ├─ If WALLET → Order created, first payment done ✅
    │
    └─ If RAZORPAY → Open Razorpay SDK → User pays → Verify payment ✅
```

---

## 1. Validate Coupon (Optional)

**Use this before creating order to show discount preview to user**

### Endpoint
```
POST /api/installment/validate-coupon
```

### Authentication
**Not required** (Public endpoint)

### Request Body
```json
{
  "couponCode": "SAVE20",
  "productPrice": 120000
}
```

**Note:** Use **variant price** if user selected a variant, otherwise use **product price**.

### Success Response (200)
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "code": "SAVE20",
      "discountType": "percentage",
      "discountValue": 20,
      "discountAmount": 24000,
      "originalPrice": 120000,
      "finalPrice": 96000
    }
  }
}
```

### Error Responses

**Coupon Not Found (404)**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' not found"
}
```

**Coupon Expired (400)**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' has expired"
}
```

**Minimum Order Value Not Met (400)**
```json
{
  "success": false,
  "message": "Minimum order value of ₹50000 is required for this coupon",
  "minOrderValue": 50000
}
```

**Coupon Not Active (400)**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' is not active"
}
```

---

## 2. Create Order

**Main endpoint to create installment order**

### Endpoint
```
POST /api/installment/orders
```

### Authentication
**Required:** Bearer token

### Request Body

**Basic Request (No variant, no coupon):**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "totalDays": 30,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Apartment 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "landmark": "Near Central Mall"
  }
}
```

**With Variant:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "variantId": "var_001",
  "totalDays": 30,
  "paymentMethod": "WALLET",
  "deliveryAddress": { ... }
}
```

**With Coupon:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "couponCode": "SAVE20",
  "totalDays": 30,
  "paymentMethod": "WALLET",
  "deliveryAddress": { ... }
}
```

**With Variant AND Coupon:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "variantId": "var_001",
  "couponCode": "SAVE20",
  "totalDays": 30,
  "paymentMethod": "RAZORPAY",
  "deliveryAddress": { ... }
}
```

### Field Requirements

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `productId` | ✅ Yes | String | Product MongoDB ID |
| `variantId` | ❌ Optional | String | Variant ID (if product has variants) |
| `couponCode` | ❌ Optional | String | Coupon code for discount |
| `totalDays` | ✅ Yes | Number | Installment days (min: 5) |
| `paymentMethod` | ✅ Yes | String | "WALLET" or "RAZORPAY" |
| `deliveryAddress` | ✅ Yes | Object | Delivery address details |

**Delivery Address Required Fields:**
- `name` (String)
- `phoneNumber` (String, 10 digits)
- `addressLine1` (String)
- `city` (String)
- `state` (String)
- `pincode` (String)

**Delivery Address Optional Fields:**
- `addressLine2` (String)
- `landmark` (String)

### Success Response - WALLET Payment (201)

```json
{
  "success": true,
  "message": "Order created successfully. First payment completed via wallet.",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "user": "64a1b2c3d4e5f6789012345",
      "product": "64a1b2c3d4e5f6789012345",
      "productName": "Premium Laptop",
      "productPrice": 96000,
      "originalPrice": 120000,
      "couponCode": "SAVE20",
      "couponDiscount": 24000,
      "variantId": "var_001",
      "variantDetails": {
        "sku": "LAP-001-BLK",
        "attributes": {
          "color": "Black",
          "size": "15 inch"
        },
        "price": 120000
      },
      "totalDays": 30,
      "dailyPaymentAmount": 3200,
      "paidInstallments": 1,
      "totalPaidAmount": 3200,
      "remainingAmount": 92800,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "createdAt": "2024-11-20T10:30:00.000Z"
    },
    "firstPayment": {
      "_id": "64a1b2c3d4e5f6789012346",
      "amount": 3200,
      "installmentNumber": 1,
      "paymentMethod": "WALLET",
      "status": "COMPLETED"
    }
  }
}
```

### Success Response - RAZORPAY Payment (201)

**Order created, awaiting first payment:**

```json
{
  "success": true,
  "message": "Order created successfully. Please complete payment via Razorpay.",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "Premium Laptop",
      "productPrice": 96000,
      "dailyPaymentAmount": 3200,
      "totalDays": 30,
      "paidInstallments": 0,
      "totalPaidAmount": 0,
      "remainingAmount": 96000,
      "status": "PENDING"
    },
    "firstPayment": {
      "_id": "64a1b2c3d4e5f6789012346",
      "amount": 3200,
      "installmentNumber": 1,
      "paymentMethod": "RAZORPAY",
      "status": "PENDING",
      "razorpayOrderId": "order_MXkj8d9sKLm2Pq"
    },
    "razorpayOrder": {
      "id": "order_MXkj8d9sKLm2Pq",
      "amount": 320000,
      "currency": "INR",
      "keyId": "rzp_live_rqOS9AG74ADgsB"
    }
  }
}
```

**Next Step for Razorpay:** Open Razorpay SDK with these details:
- `key`: razorpayOrder.keyId
- `amount`: razorpayOrder.amount
- `order_id`: razorpayOrder.id

### Error Responses

**Insufficient Wallet Balance (400)**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance. Required: ₹3200, Available: ₹1000"
  }
}
```

**Product Not Found (404)**
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID 64a1b2c3d4e5f6789012345 not found"
  }
}
```

**Invalid Installment Duration (400)**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INSTALLMENT_DURATION",
    "message": "Invalid installment duration. Must be between 5 and 100 days"
  }
}
```

**Variant Not Found (400)**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Variant with ID var_001 not found for this product"
  }
}
```

**Coupon Not Valid (400)**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Coupon 'SAVE20' has expired"
  }
}
```

---

## 3. Get Order Details

**Get complete order information including payment progress**

### Endpoint
```
GET /api/installment/orders/:orderId
```

### Authentication
**Required:** Bearer token

### URL Parameters
- `orderId`: Order ID (e.g., "ORD-20241120-A3F2")

### Request Example
```
GET /api/installment/orders/ORD-20241120-A3F2
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "Premium Laptop",
      "productPrice": 96000,
      "originalPrice": 120000,
      "couponCode": "SAVE20",
      "couponDiscount": 24000,
      "variantDetails": {
        "sku": "LAP-001-BLK",
        "attributes": {
          "color": "Black",
          "size": "15 inch"
        }
      },
      "totalDays": 30,
      "dailyPaymentAmount": 3200,
      "paidInstallments": 5,
      "totalPaidAmount": 16000,
      "remainingAmount": 80000,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "deliveryAddress": {
        "name": "John Doe",
        "phoneNumber": "9876543210",
        "addressLine1": "123 Main Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
      },
      "createdAt": "2024-11-20T10:30:00.000Z",
      "updatedAt": "2024-11-25T10:30:00.000Z"
    }
  }
}
```

### Order Status Values
- `PENDING`: First payment not completed
- `ACTIVE`: Accepting installment payments
- `COMPLETED`: All payments done, awaiting delivery
- `CANCELLED`: Order cancelled

### Delivery Status Values
- `PENDING`: Awaiting approval
- `APPROVED`: Approved by admin
- `SHIPPED`: Product shipped
- `DELIVERED`: Product delivered

### Error Response

**Order Not Found (404)**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with ID ORD-20241120-A3F2 not found"
  }
}
```

---

## 4. Get User Orders

**Get all orders for logged-in user**

### Endpoint
```
GET /api/installment/orders
```

### Authentication
**Required:** Bearer token

### Query Parameters (Optional)
- `status`: Filter by status ("ACTIVE", "COMPLETED", "PENDING", "CANCELLED")
- `limit`: Number of orders per page (default: 50)
- `skip`: Number of orders to skip (for pagination)

### Request Examples
```
GET /api/installment/orders
GET /api/installment/orders?status=ACTIVE
GET /api/installment/orders?limit=10&skip=0
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": {
    "orders": [
      {
        "orderId": "ORD-20241120-A3F2",
        "productName": "Premium Laptop",
        "productPrice": 96000,
        "dailyPaymentAmount": 3200,
        "totalDays": 30,
        "paidInstallments": 5,
        "totalPaidAmount": 16000,
        "remainingAmount": 80000,
        "status": "ACTIVE",
        "deliveryStatus": "PENDING",
        "createdAt": "2024-11-20T10:30:00.000Z"
      },
      {
        "orderId": "ORD-20241118-B2E1",
        "productName": "Smartphone",
        "productPrice": 30000,
        "dailyPaymentAmount": 1000,
        "totalDays": 30,
        "paidInstallments": 30,
        "totalPaidAmount": 30000,
        "remainingAmount": 0,
        "status": "COMPLETED",
        "deliveryStatus": "SHIPPED",
        "createdAt": "2024-11-18T10:30:00.000Z"
      }
    ],
    "total": 2
  }
}
```

---

## 5. Get Payment Schedule

**Get detailed payment schedule showing all installments**

### Endpoint
```
GET /api/installment/orders/:orderId/schedule
```

### Authentication
**Required:** Bearer token

### Request Example
```
GET /api/installment/orders/ORD-20241120-A3F2/schedule
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Payment schedule retrieved successfully",
  "data": {
    "schedule": [
      {
        "installmentNumber": 1,
        "dueDate": "2024-11-20T10:30:00.000Z",
        "amount": 3200,
        "status": "PAID",
        "paidDate": "2024-11-20T10:35:00.000Z"
      },
      {
        "installmentNumber": 2,
        "dueDate": "2024-11-21T10:30:00.000Z",
        "amount": 3200,
        "status": "PAID",
        "paidDate": "2024-11-21T11:00:00.000Z"
      },
      {
        "installmentNumber": 3,
        "dueDate": "2024-11-22T10:30:00.000Z",
        "amount": 3200,
        "status": "PENDING",
        "paidDate": null
      }
    ],
    "summary": {
      "totalInstallments": 30,
      "paidInstallments": 2,
      "pendingInstallments": 28,
      "skippedInstallments": 0
    }
  }
}
```

### Schedule Status Values
- `PENDING`: Not yet paid
- `PAID`: Payment completed
- `SKIPPED`: User skipped this day (can still pay later)

---

## 6. Process Payment

**Process installment payment (used for both first payment verification and daily payments)**

### Endpoint
```
POST /api/installment/payments/process
```

### Authentication
**Required:** Bearer token

### Request Body - WALLET Payment
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "WALLET"
}
```

### Request Body - RAZORPAY Payment
```json
{
  "orderId": "ORD-20241120-A3F2",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
  "razorpayPaymentId": "pay_MXkjN8kLm2PqRs",
  "razorpaySignature": "a1b2c3d4e5f6..."
}
```

**Get these 3 fields from Razorpay SDK success callback:**
- `razorpayOrderId`: From `response.razorpay_order_id`
- `razorpayPaymentId`: From `response.razorpay_payment_id`
- `razorpaySignature`: From `response.razorpay_signature`

### Success Response - WALLET (200)
```json
{
  "success": true,
  "message": "Payment successful. 28 installments remaining.",
  "data": {
    "payment": {
      "_id": "64a1b2c3d4e5f6789012347",
      "amount": 3200,
      "installmentNumber": 3,
      "paymentMethod": "WALLET",
      "status": "COMPLETED"
    },
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "paidInstallments": 3,
      "totalPaidAmount": 9600,
      "remainingAmount": 86400,
      "progress": 10,
      "status": "ACTIVE"
    },
    "commission": {
      "amount": 640,
      "availableAmount": 576,
      "lockedAmount": 64
    }
  }
}
```

### Success Response - RAZORPAY (200)
```json
{
  "success": true,
  "message": "Payment verified and processed successfully",
  "data": {
    "payment": {
      "_id": "64a1b2c3d4e5f6789012347",
      "amount": 3200,
      "installmentNumber": 1,
      "paymentMethod": "RAZORPAY",
      "status": "COMPLETED",
      "razorpayPaymentId": "pay_MXkjN8kLm2PqRs"
    },
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "paidInstallments": 1,
      "totalPaidAmount": 3200,
      "remainingAmount": 92800,
      "status": "ACTIVE"
    }
  }
}
```

### Error Responses

**Insufficient Balance (400)**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient wallet balance. Required: ₹3200, Available: ₹1000"
  }
}
```

**Order Already Completed (400)**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_COMPLETED",
    "message": "Order ORD-20241120-A3F2 is already completed"
  }
}
```

**Razorpay Verification Failed (400)**
```json
{
  "success": false,
  "error": {
    "code": "RAZORPAY_VERIFICATION_ERROR",
    "message": "Payment verification failed. Invalid signature."
  }
}
```

**Payment Already Processed (400)**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_ALREADY_PROCESSED",
    "message": "This payment has already been processed"
  }
}
```

---

## 7. Create Razorpay Order for Installment

**Create Razorpay order for daily installment payment**

**Use Case:** When user clicks "Pay Next Installment" and selects Razorpay

### Endpoint
```
POST /api/installment/payments/create-razorpay-order
```

### Authentication
**Required:** Bearer token

### Request Body
```json
{
  "orderId": "ORD-20241120-A3F2"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Razorpay order created successfully",
  "data": {
    "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
    "amount": 320000,
    "currency": "INR",
    "keyId": "rzp_live_rqOS9AG74ADgsB",
    "installmentNumber": 3,
    "orderId": "ORD-20241120-A3F2"
  }
}
```

**Next Steps:**
1. Open Razorpay SDK with these details
2. User completes payment
3. Call `/payments/process` with Razorpay response

### Error Response

**Order Not Found (404)**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with ID ORD-20241120-A3F2 not found"
  }
}
```

**No Pending Installments (400)**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "No pending installments found for this order"
  }
}
```

---

## 8. Cancel Order

**Cancel an active order**

### Endpoint
```
POST /api/installment/orders/:orderId/cancel
```

### Authentication
**Required:** Bearer token

### Request Example
```
POST /api/installment/orders/ORD-20241120-A3F2/cancel
```

### Request Body (Optional)
```json
{
  "reason": "Changed my mind"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "status": "CANCELLED",
      "cancelledAt": "2024-11-25T10:30:00.000Z",
      "cancellationReason": "Changed my mind"
    }
  }
}
```

### Error Response

**Order Cannot Be Cancelled (400)**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Order cannot be cancelled. Order is already completed."
  }
}
```

---

## 🎯 Complete Examples

### Example 1: Simple Order with Wallet

```dart
// Step 1: Create order
final response = await http.post(
  Uri.parse('$baseUrl/installment/orders'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'productId': '64a1b2c3d4e5f6789012345',
    'totalDays': 30,
    'paymentMethod': 'WALLET',
    'deliveryAddress': {
      'name': 'John Doe',
      'phoneNumber': '9876543210',
      'addressLine1': '123 Main Street',
      'city': 'Mumbai',
      'state': 'Maharashtra',
      'pincode': '400001'
    }
  }),
);

final data = jsonDecode(response.body);

if (data['success']) {
  // Order created! First payment done via wallet
  final orderId = data['data']['order']['orderId'];
  final paidAmount = data['data']['order']['totalPaidAmount'];

  print('Order created: $orderId');
  print('First payment done: ₹$paidAmount');

  // Navigate to order details page
  Navigator.push(context, MaterialPageRoute(
    builder: (_) => OrderDetailsPage(orderId: orderId)
  ));
}
```

---

### Example 2: Order with Variant and Coupon (Razorpay)

```dart
// Step 1: Validate coupon (optional but recommended)
final couponResponse = await http.post(
  Uri.parse('$baseUrl/installment/validate-coupon'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'couponCode': 'SAVE20',
    'productPrice': 120000
  }),
);

final couponData = jsonDecode(couponResponse.body);

if (couponData['success']) {
  final discount = couponData['data']['coupon']['discountAmount'];
  final finalPrice = couponData['data']['coupon']['finalPrice'];

  // Show discount to user
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: Text('Coupon Applied!'),
      content: Text('You save ₹$discount\nFinal Price: ₹$finalPrice'),
    )
  );
}

// Step 2: Create order with variant and coupon
final orderResponse = await http.post(
  Uri.parse('$baseUrl/installment/orders'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'productId': '64a1b2c3d4e5f6789012345',
    'variantId': 'var_001',
    'couponCode': 'SAVE20',
    'totalDays': 30,
    'paymentMethod': 'RAZORPAY',
    'deliveryAddress': { /* ... */ }
  }),
);

final orderData = jsonDecode(orderResponse.body);

if (orderData['success']) {
  // Step 3: Open Razorpay SDK
  final razorpayOrder = orderData['data']['razorpayOrder'];

  var options = {
    'key': razorpayOrder['keyId'],
    'amount': razorpayOrder['amount'],
    'order_id': razorpayOrder['id'],
    'name': 'Your Store Name',
    'description': 'First Installment Payment',
  };

  _razorpay.open(options);
}

// Step 4: Handle Razorpay success callback
void _handlePaymentSuccess(PaymentSuccessResponse response) async {
  // Verify payment with backend
  final verifyResponse = await http.post(
    Uri.parse('$baseUrl/installment/payments/process'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'orderId': currentOrderId,
      'paymentMethod': 'RAZORPAY',
      'razorpayOrderId': response.orderId,
      'razorpayPaymentId': response.paymentId,
      'razorpaySignature': response.signature,
    }),
  );

  final verifyData = jsonDecode(verifyResponse.body);

  if (verifyData['success']) {
    // Payment verified! Order is now ACTIVE
    showSuccess('Payment successful!');
  }
}
```

---

### Example 3: Pay Daily Installment with Wallet

```dart
// User clicks "Pay Next Installment"
Future<void> payNextInstallment(String orderId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/installment/payments/process'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'orderId': orderId,
      'paymentMethod': 'WALLET'
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    final remaining = data['data']['order']['remainingAmount'];
    final progress = data['data']['order']['progress'];

    showSuccess('Payment successful!\n$progress% complete');

    // Refresh order details
    fetchOrderDetails(orderId);
  } else {
    // Handle error
    if (data['error']['code'] == 'INSUFFICIENT_BALANCE') {
      showError('Insufficient wallet balance. Please add money.');
    }
  }
}
```

---

### Example 4: Pay Daily Installment with Razorpay

```dart
// Step 1: Create Razorpay order for installment
Future<void> payInstallmentWithRazorpay(String orderId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/installment/payments/create-razorpay-order'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'orderId': orderId}),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Step 2: Open Razorpay SDK
    final razorpayData = data['data'];

    var options = {
      'key': razorpayData['keyId'],
      'amount': razorpayData['amount'],
      'order_id': razorpayData['razorpayOrderId'],
      'name': 'Your Store Name',
      'description': 'Installment ${razorpayData['installmentNumber']}',
    };

    _razorpay.open(options);
  }
}

// Step 3: Same verification as Example 2 Step 4
```

---

## ⚠️ Important Notes

### 1. **Payment Method Selection**
- **WALLET**: Instant payment, order becomes ACTIVE immediately
- **RAZORPAY**: Requires user to complete payment in Razorpay SDK

### 2. **Order Status Flow**
```
PENDING → ACTIVE → COMPLETED
```
- **PENDING**: First payment not done (only for Razorpay orders)
- **ACTIVE**: Accepting installment payments
- **COMPLETED**: All payments done, awaiting delivery

### 3. **Daily Payments**
- Users can skip days (no penalty)
- Users can pay multiple installments in one day
- Payment amount is fixed (dailyPaymentAmount)

### 4. **Coupon Application**
- Validate coupon BEFORE creating order (to show discount)
- Coupon discount is applied to final product price
- Daily amount is calculated from discounted price

### 5. **Variant Selection**
- If product has variants, variantId is required
- If no variants, omit variantId field
- Backend uses variant price if variantId provided

### 6. **Error Handling**
Always check `success` field:
```dart
if (data['success']) {
  // Success flow
} else {
  // Error flow
  final errorCode = data['error']['code'];
  final errorMessage = data['error']['message'];

  // Handle specific errors
  switch (errorCode) {
    case 'INSUFFICIENT_BALANCE':
      showAddMoneyDialog();
      break;
    case 'ORDER_NOT_FOUND':
      showError('Order not found');
      break;
    // ... handle other errors
  }
}
```

---

## 🚀 Quick Reference

### All Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/validate-coupon` | ❌ | Validate coupon code |
| POST | `/orders` | ✅ | Create installment order |
| GET | `/orders` | ✅ | Get user's orders |
| GET | `/orders/:orderId` | ✅ | Get order details |
| GET | `/orders/:orderId/schedule` | ✅ | Get payment schedule |
| POST | `/orders/:orderId/cancel` | ✅ | Cancel order |
| POST | `/payments/process` | ✅ | Process payment (wallet/razorpay) |
| POST | `/payments/create-razorpay-order` | ✅ | Create Razorpay order for installment |

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (order created successfully) |
| 400 | Bad Request (validation error, insufficient balance, etc.) |
| 401 | Unauthorized (invalid/missing token) |
| 404 | Not Found (order/product not found) |
| 500 | Server Error |

---

**Documentation Version:** 1.0
**Last Updated:** 2024-11-20
**Status:** ✅ Production Ready

For support, contact the backend team.
