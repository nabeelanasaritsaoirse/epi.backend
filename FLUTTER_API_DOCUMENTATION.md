# 📱 Flutter Frontend API Documentation
## Installment Order System - Complete Integration Guide

**Backend Base URL:** `https://your-api-domain.com`
**API Version:** v1
**Last Updated:** November 27, 2025
**Status:** ✅ Production Ready

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [User Order Endpoints](#user-order-endpoints)
3. [Payment Endpoints](#payment-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Models & Data Structures](#models--data-structures)
6. [Complete Order Flow](#complete-order-flow)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## 🔐 Authentication

All endpoints (except public ones) require authentication via Firebase JWT token.

### Headers Required:
```dart
Map<String, String> headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ${firebaseToken}',
};
```

### Getting Firebase Token:
```dart
final user = FirebaseAuth.instance.currentUser;
final token = await user?.getIdToken();
```

---

## 👤 USER ORDER ENDPOINTS

### 1. Create New Installment Order

**Endpoint:** `POST /api/installments/orders`
**Authentication:** ✅ Required
**Description:** Creates a new installment order with first payment

#### Request Body:
```json
{
  "productId": "692724041480b2fbb2e85a6d",
  "quantity": 2,
  "totalDays": 20,
  "dailyAmount": 100,
  "paymentMethod": "WALLET",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "9876543210",
    "addressLine1": "123 Main Street",
    "addressLine2": "Near City Mall",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "couponCode": "SAVE10",
  "variantId": "variant-123"
}
```

#### Field Descriptions:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | ✅ Yes | MongoDB ObjectId of the product |
| `quantity` | Number | ❌ No | Number of items (1-10), default: 1 |
| `totalDays` | Number | ✅ Yes | Total installment days (minimum: 5) |
| `dailyAmount` | Number | ✅ Yes | Daily payment amount (minimum: ₹50) |
| `paymentMethod` | String | ✅ Yes | Either "WALLET" or "RAZORPAY" |
| `deliveryAddress` | Object | ✅ Yes | Delivery address details |
| `couponCode` | String | ❌ No | Optional coupon code |
| `variantId` | String | ❌ No | Product variant ID (for different colors/sizes) |

#### Success Response (WALLET):
```json
{
  "success": true,
  "message": "Order created successfully. First payment completed via wallet.",
  "data": {
    "order": {
      "_id": "692758902e6db52eedd792da",
      "orderId": "ORD-20251126-F5C1",
      "user": "692724041480b2fbb2e85a6c",
      "product": {
        "_id": "692724041480b2fbb2e85a6d",
        "name": "Premium Wireless Headphones",
        "price": 400,
        "images": ["image1.jpg", "image2.jpg"]
      },
      "quantity": 2,
      "pricePerUnit": 400,
      "totalProductPrice": 800,
      "productPrice": 800,
      "totalDays": 20,
      "dailyPaymentAmount": 100,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "paidInstallments": 1,
      "totalPaidAmount": 100,
      "remainingAmount": 700,
      "firstPaymentMethod": "WALLET",
      "deliveryAddress": {
        "name": "John Doe",
        "phoneNumber": "9876543210",
        "addressLine1": "123 Main Street",
        "addressLine2": "Near City Mall",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
      },
      "createdAt": "2025-11-26T10:30:45.123Z",
      "updatedAt": "2025-11-26T10:30:45.123Z"
    },
    "firstPayment": {
      "_id": "692758912e6db52eedd792db",
      "paymentId": "PAY-20251126-621E",
      "amount": 100,
      "installmentNumber": 1,
      "status": "COMPLETED",
      "paymentMethod": "WALLET",
      "completedAt": "2025-11-26T10:30:45.123Z"
    },
    "commission": {
      "amount": 10,
      "referrerId": "692724041480b2fbb2e85a6e",
      "credited": true
    }
  }
}
```

#### Success Response (RAZORPAY):
```json
{
  "success": true,
  "message": "Order created. Complete payment via Razorpay.",
  "data": {
    "order": {
      "_id": "692758982e6db52eedd792fd",
      "orderId": "ORD-20251126-A498",
      "status": "PENDING",
      "totalProductPrice": 400,
      "dailyPaymentAmount": 50,
      "totalDays": 20
    },
    "razorpayOrder": {
      "id": "order_NJy8zXMz1q9Z5Y",
      "entity": "order",
      "amount": 5000,
      "amount_due": 5000,
      "currency": "INR",
      "receipt": "ORD-20251126-A498-1",
      "status": "created"
    },
    "firstPayment": {
      "_id": "692758992e6db52eedd792fe",
      "paymentId": "PAY-20251126-8F3A",
      "status": "PENDING",
      "amount": 50
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> createOrder({
  required String productId,
  required int totalDays,
  required double dailyAmount,
  required String paymentMethod,
  required Map<String, dynamic> deliveryAddress,
  int quantity = 1,
  String? couponCode,
  String? variantId,
}) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/orders'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'productId': productId,
      'quantity': quantity,
      'totalDays': totalDays,
      'dailyAmount': dailyAmount,
      'paymentMethod': paymentMethod,
      'deliveryAddress': deliveryAddress,
      if (couponCode != null) 'couponCode': couponCode,
      if (variantId != null) 'variantId': variantId,
    }),
  );

  if (response.statusCode == 201) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 2. Get User's All Orders

**Endpoint:** `GET /api/installments/orders`
**Authentication:** ✅ Required
**Description:** Fetch all orders for the logged-in user with pagination

#### Query Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Number | 1 | Page number |
| `limit` | Number | 10 | Orders per page |
| `status` | String | - | Filter by status: PENDING, ACTIVE, COMPLETED, CANCELLED |
| `sortBy` | String | createdAt | Sort field |
| `sortOrder` | String | desc | Sort order: asc or desc |

#### Example Request:
```
GET /api/installments/orders?page=1&limit=10&status=ACTIVE&sortOrder=desc
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "692758902e6db52eedd792da",
        "orderId": "ORD-20251126-F5C1",
        "product": {
          "_id": "692724041480b2fbb2e85a6d",
          "name": "Premium Wireless Headphones",
          "price": 400,
          "images": ["image1.jpg"]
        },
        "quantity": 2,
        "totalProductPrice": 800,
        "status": "ACTIVE",
        "deliveryStatus": "PENDING",
        "paidInstallments": 5,
        "totalDays": 20,
        "totalPaidAmount": 500,
        "remainingAmount": 300,
        "createdAt": "2025-11-26T10:30:45.123Z"
      },
      {
        "_id": "692758922e6db52eedd792e7",
        "orderId": "ORD-20251126-1DCF",
        "product": {
          "_id": "692724041480b2fbb2e85a6d",
          "name": "Smart Watch Pro",
          "price": 500,
          "images": ["watch1.jpg"]
        },
        "quantity": 1,
        "totalProductPrice": 500,
        "status": "COMPLETED",
        "deliveryStatus": "DELIVERED",
        "paidInstallments": 10,
        "totalDays": 10,
        "totalPaidAmount": 500,
        "remainingAmount": 0,
        "createdAt": "2025-11-20T08:15:30.456Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalOrders": 25,
      "ordersPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getUserOrders({
  int page = 1,
  int limit = 10,
  String? status,
}) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final queryParams = {
    'page': page.toString(),
    'limit': limit.toString(),
    if (status != null) 'status': status,
  };

  final uri = Uri.parse('$baseUrl/api/installments/orders')
      .replace(queryParameters: queryParams);

  final response = await http.get(
    uri,
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 3. Get Single Order Details

**Endpoint:** `GET /api/installments/orders/:orderId`
**Authentication:** ✅ Required
**Description:** Get detailed information about a specific order

#### Example Request:
```
GET /api/installments/orders/ORD-20251126-F5C1
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "692758902e6db52eedd792da",
      "orderId": "ORD-20251126-F5C1",
      "user": {
        "_id": "692724041480b2fbb2e85a6c",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "product": {
        "_id": "692724041480b2fbb2e85a6d",
        "name": "Premium Wireless Headphones",
        "description": "High-quality wireless headphones with noise cancellation",
        "price": 400,
        "images": ["image1.jpg", "image2.jpg"],
        "category": "Electronics"
      },
      "quantity": 2,
      "pricePerUnit": 400,
      "totalProductPrice": 800,
      "productPrice": 720,
      "couponCode": "SAVE10",
      "couponDiscount": 80,
      "couponType": "INSTANT",
      "totalDays": 20,
      "dailyPaymentAmount": 100,
      "status": "ACTIVE",
      "deliveryStatus": "PENDING",
      "paidInstallments": 5,
      "totalPaidAmount": 500,
      "remainingAmount": 220,
      "firstPaymentMethod": "WALLET",
      "firstPaymentCompletedAt": "2025-11-26T10:30:45.123Z",
      "lastPaymentDate": "2025-11-30T12:00:00.000Z",
      "deliveryAddress": {
        "name": "John Doe",
        "phoneNumber": "9876543210",
        "addressLine1": "123 Main Street",
        "addressLine2": "Near City Mall",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
      },
      "referrer": {
        "_id": "692724041480b2fbb2e85a6e",
        "name": "Jane Smith"
      },
      "commissionPercentage": 10,
      "totalCommissionPaid": 50,
      "createdAt": "2025-11-26T10:30:45.123Z",
      "updatedAt": "2025-11-30T12:00:00.000Z"
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getOrderDetails(String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/orders/$orderId'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 4. Get Order Summary with Progress

**Endpoint:** `GET /api/installments/orders/:orderId/summary`
**Authentication:** ✅ Required
**Description:** Get order summary with payment progress, next payment info, and timeline

#### Example Request:
```
GET /api/installments/orders/ORD-20251126-F5C1/summary
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "orderId": "ORD-20251126-F5C1",
      "status": "ACTIVE",
      "product": {
        "name": "Premium Wireless Headphones",
        "image": "image1.jpg"
      },
      "paymentProgress": {
        "totalDays": 20,
        "paidInstallments": 5,
        "remainingInstallments": 15,
        "progressPercentage": 25,
        "totalAmount": 800,
        "paidAmount": 500,
        "remainingAmount": 300,
        "dailyAmount": 100
      },
      "nextPayment": {
        "installmentNumber": 6,
        "dueDate": "2025-12-01T00:00:00.000Z",
        "amount": 100,
        "status": "PENDING",
        "canPayToday": true
      },
      "deliveryInfo": {
        "status": "PENDING",
        "address": "123 Main Street, Near City Mall, Mumbai, Maharashtra - 400001",
        "expectedDelivery": "After all payments complete"
      },
      "timeline": [
        {
          "event": "Order Created",
          "date": "2025-11-26T10:30:45.123Z",
          "status": "completed"
        },
        {
          "event": "First Payment",
          "date": "2025-11-26T10:30:45.123Z",
          "status": "completed",
          "amount": 100
        },
        {
          "event": "5 Payments Completed",
          "date": "2025-11-30T12:00:00.000Z",
          "status": "completed",
          "amount": 500
        },
        {
          "event": "15 Payments Remaining",
          "status": "pending",
          "amount": 300
        }
      ]
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getOrderSummary(String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/orders/$orderId/summary'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 5. Get Payment Schedule

**Endpoint:** `GET /api/installments/orders/:orderId/schedule`
**Authentication:** ✅ Required
**Description:** Get complete payment schedule with all installments

#### Example Request:
```
GET /api/installments/orders/ORD-20251126-F5C1/schedule
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "schedule": {
      "orderId": "ORD-20251126-F5C1",
      "totalInstallments": 20,
      "dailyAmount": 100,
      "installments": [
        {
          "installmentNumber": 1,
          "dueDate": "2025-11-26T00:00:00.000Z",
          "amount": 100,
          "status": "PAID",
          "isCouponBenefit": false,
          "paidDate": "2025-11-26T10:30:45.123Z",
          "paymentId": {
            "_id": "692758912e6db52eedd792db",
            "paymentId": "PAY-20251126-621E",
            "paymentMethod": "WALLET"
          }
        },
        {
          "installmentNumber": 2,
          "dueDate": "2025-11-27T00:00:00.000Z",
          "amount": 100,
          "status": "PAID",
          "isCouponBenefit": false,
          "paidDate": "2025-11-27T09:15:20.456Z",
          "paymentId": {
            "_id": "692758922e6db52eedd792e7",
            "paymentId": "PAY-20251127-A3B1",
            "paymentMethod": "WALLET"
          }
        },
        {
          "installmentNumber": 3,
          "dueDate": "2025-11-28T00:00:00.000Z",
          "amount": 100,
          "status": "PENDING",
          "isCouponBenefit": false
        },
        {
          "installmentNumber": 20,
          "dueDate": "2025-12-15T00:00:00.000Z",
          "amount": 0,
          "status": "FREE",
          "isCouponBenefit": true,
          "note": "Free day from REDUCE_DAYS coupon"
        }
      ],
      "summary": {
        "paid": 2,
        "pending": 17,
        "free": 1,
        "totalPaid": 200,
        "totalRemaining": 600
      }
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getPaymentSchedule(String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/orders/$orderId/schedule'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 6. Get Order Statistics

**Endpoint:** `GET /api/installments/orders/stats`
**Authentication:** ✅ Required
**Description:** Get order statistics for the logged-in user

#### Example Request:
```
GET /api/installments/orders/stats
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalOrders": 15,
      "activeOrders": 5,
      "completedOrders": 8,
      "cancelledOrders": 2,
      "totalInvested": 12500,
      "totalPending": 3500,
      "ordersAwaitingDelivery": 3,
      "ordersDelivered": 8
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getOrderStats() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/orders/stats'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 7. Get Overall Investment Status

**Endpoint:** `GET /api/installments/orders/overall-status`
**Authentication:** ✅ Required
**Description:** Get comprehensive investment overview across all orders

#### Example Request:
```
GET /api/installments/orders/overall-status
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "overallStatus": {
      "totalInvestment": 25000,
      "totalPaid": 18500,
      "totalRemaining": 6500,
      "activeInvestments": 5,
      "completedInvestments": 10,
      "totalProducts": 15,
      "averageProgress": 74,
      "upcomingPayments": {
        "today": 2,
        "thisWeek": 14,
        "thisMonth": 60,
        "totalAmount": 6500
      },
      "commissionEarned": 1850,
      "deliveryPending": 3
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getOverallStatus() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/orders/overall-status'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 8. Cancel Order

**Endpoint:** `POST /api/installments/orders/:orderId/cancel`
**Authentication:** ✅ Required
**Description:** Cancel an active order (with refund if applicable)

#### Request Body:
```json
{
  "reason": "Changed my mind",
  "additionalNotes": "Will order later"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Order cancelled successfully. Refund will be processed.",
  "data": {
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "status": "CANCELLED",
      "cancelledAt": "2025-11-27T14:30:00.000Z",
      "cancelReason": "Changed my mind"
    },
    "refund": {
      "amount": 500,
      "refundMethod": "WALLET",
      "status": "PROCESSED",
      "refundedAt": "2025-11-27T14:30:00.000Z"
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> cancelOrder({
  required String orderId,
  required String reason,
  String? additionalNotes,
}) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/orders/$orderId/cancel'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'reason': reason,
      if (additionalNotes != null) 'additionalNotes': additionalNotes,
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 9. Validate Coupon

**Endpoint:** `POST /api/installments/validate-coupon`
**Authentication:** ❌ Not Required (Public)
**Description:** Validate a coupon code before order creation

#### Request Body:
```json
{
  "couponCode": "SAVE10",
  "productId": "692724041480b2fbb2e85a6d",
  "quantity": 2,
  "totalDays": 20
}
```

#### Success Response (INSTANT Discount):
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "code": "SAVE10",
      "type": "INSTANT",
      "discountValue": 10,
      "discountType": "PERCENTAGE",
      "maxDiscount": 500,
      "minOrderValue": 500,
      "description": "Get 10% off on orders above ₹500"
    },
    "pricing": {
      "originalPrice": 800,
      "discountAmount": 80,
      "finalPrice": 720,
      "dailyAmount": 36,
      "totalDays": 20,
      "savings": 80
    }
  }
}
```

#### Success Response (REDUCE_DAYS):
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "code": "FREEWEEK",
      "type": "REDUCE_DAYS",
      "discountValue": 7,
      "description": "Get 7 free days on your payment plan"
    },
    "pricing": {
      "originalPrice": 800,
      "finalPrice": 800,
      "paidDays": 13,
      "freeDays": 7,
      "totalDays": 20,
      "dailyAmount": 40,
      "note": "Last 7 days will be marked as FREE"
    }
  }
}
```

#### Error Response (Invalid):
```json
{
  "success": false,
  "message": "Coupon validation failed",
  "error": {
    "code": "COUPON_EXPIRED",
    "message": "This coupon has expired"
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> validateCoupon({
  required String couponCode,
  required String productId,
  required int totalDays,
  int quantity = 1,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/validate-coupon'),
    headers: {
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'couponCode': couponCode,
      'productId': productId,
      'quantity': quantity,
      'totalDays': totalDays,
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

## 💳 PAYMENT ENDPOINTS

### 10. Create Razorpay Order for Next Installment

**Endpoint:** `POST /api/installments/payments/create-razorpay-order`
**Authentication:** ✅ Required
**Description:** Create Razorpay order for paying next installment

#### Request Body:
```json
{
  "orderId": "ORD-20251126-F5C1"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Razorpay order created successfully",
  "data": {
    "razorpayOrder": {
      "id": "order_NJy8zXMz1q9Z5Y",
      "entity": "order",
      "amount": 10000,
      "amount_due": 10000,
      "currency": "INR",
      "receipt": "ORD-20251126-F5C1-6",
      "status": "created"
    },
    "paymentRecord": {
      "_id": "692758a02e6db52eedd792ff",
      "paymentId": "PAY-20251127-B4C2",
      "amount": 100,
      "installmentNumber": 6,
      "status": "PENDING"
    },
    "orderDetails": {
      "orderId": "ORD-20251126-F5C1",
      "productName": "Premium Wireless Headphones",
      "installmentNumber": 6,
      "totalInstallments": 20
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> createRazorpayOrder(String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/payments/create-razorpay-order'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'orderId': orderId,
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 11. Process Payment

**Endpoint:** `POST /api/installments/payments/process`
**Authentication:** ✅ Required
**Description:** Process an installment payment (Razorpay or Wallet)

#### Request Body (RAZORPAY):
```json
{
  "orderId": "ORD-20251126-F5C1",
  "paymentMethod": "RAZORPAY",
  "razorpayOrderId": "order_NJy8zXMz1q9Z5Y",
  "razorpayPaymentId": "pay_NJy9KHqP5zR3aB",
  "razorpaySignature": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

#### Request Body (WALLET):
```json
{
  "orderId": "ORD-20251126-F5C1",
  "paymentMethod": "WALLET"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "payment": {
      "_id": "692758a02e6db52eedd792ff",
      "paymentId": "PAY-20251127-B4C2",
      "amount": 100,
      "installmentNumber": 6,
      "status": "COMPLETED",
      "paymentMethod": "WALLET",
      "completedAt": "2025-11-27T10:15:30.456Z",
      "idempotencyKey": "692758902e6db52eedd792da-6-1764186930456"
    },
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "status": "ACTIVE",
      "paidInstallments": 6,
      "totalPaidAmount": 600,
      "remainingAmount": 200,
      "progressPercentage": 75
    },
    "commission": {
      "amount": 10,
      "percentage": 10,
      "creditedToReferrer": true,
      "referrerId": "692724041480b2fbb2e85a6e"
    },
    "nextPayment": {
      "installmentNumber": 7,
      "dueDate": "2025-11-28T00:00:00.000Z",
      "amount": 100,
      "canPayToday": false,
      "note": "You can pay your next installment tomorrow"
    }
  }
}
```

#### Success Response (Order Completed):
```json
{
  "success": true,
  "message": "Payment processed successfully. Order completed!",
  "data": {
    "payment": {
      "paymentId": "PAY-20251215-X9Y8",
      "amount": 100,
      "installmentNumber": 20,
      "status": "COMPLETED"
    },
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "status": "COMPLETED",
      "deliveryStatus": "PENDING",
      "paidInstallments": 20,
      "totalPaidAmount": 800,
      "remainingAmount": 0,
      "progressPercentage": 100,
      "completedAt": "2025-12-15T12:00:00.000Z"
    },
    "message": "Your order is complete! Awaiting delivery approval from admin."
  }
}
```

#### Error Response (Already Paid Today):
```json
{
  "success": false,
  "message": "You have already made a payment for this order today. Please try again tomorrow.",
  "error": {
    "code": "PAYMENT_ALREADY_DONE_TODAY",
    "lastPaymentDate": "2025-11-27T10:15:30.456Z",
    "nextPaymentDate": "2025-11-28T00:00:00.000Z"
  }
}
```

#### Flutter Implementation with Razorpay:
```dart
import 'package:razorpay_flutter/razorpay_flutter.dart';

class PaymentService {
  late Razorpay _razorpay;
  String currentOrderId = '';

  void initRazorpay() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  }

  Future<void> makePayment(String orderId) async {
    try {
      currentOrderId = orderId;

      // Step 1: Create Razorpay order from backend
      final razorpayData = await createRazorpayOrder(orderId);
      final razorpayOrderId = razorpayData['data']['razorpayOrder']['id'];
      final amount = razorpayData['data']['razorpayOrder']['amount'];

      // Step 2: Open Razorpay checkout
      var options = {
        'key': 'YOUR_RAZORPAY_KEY_ID',
        'amount': amount,
        'order_id': razorpayOrderId,
        'name': 'Your App Name',
        'description': 'Installment Payment',
        'timeout': 300, // 5 minutes
        'prefill': {
          'contact': '9876543210',
          'email': 'user@example.com'
        }
      };

      _razorpay.open(options);
    } catch (e) {
      print('Error: $e');
    }
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    // Step 3: Verify payment on backend
    try {
      final result = await processPayment(
        orderId: currentOrderId,
        paymentMethod: 'RAZORPAY',
        razorpayOrderId: response.orderId!,
        razorpayPaymentId: response.paymentId!,
        razorpaySignature: response.signature!,
      );

      // Show success message
      print('Payment successful: ${result['message']}');
    } catch (e) {
      print('Payment verification failed: $e');
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    print('Payment failed: ${response.message}');
  }

  Future<Map<String, dynamic>> processPayment({
    required String orderId,
    required String paymentMethod,
    String? razorpayOrderId,
    String? razorpayPaymentId,
    String? razorpaySignature,
  }) async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();

    final response = await http.post(
      Uri.parse('$baseUrl/api/installments/payments/process'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'orderId': orderId,
        'paymentMethod': paymentMethod,
        if (razorpayOrderId != null) 'razorpayOrderId': razorpayOrderId,
        if (razorpayPaymentId != null) 'razorpayPaymentId': razorpayPaymentId,
        if (razorpaySignature != null) 'razorpaySignature': razorpaySignature,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception(jsonDecode(response.body)['message']);
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
```

---

### 12. Get Payment History for Order

**Endpoint:** `GET /api/installments/payments/history/:orderId`
**Authentication:** ✅ Required
**Description:** Get all payment records for a specific order

#### Example Request:
```
GET /api/installments/payments/history/ORD-20251126-F5C1
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "692758912e6db52eedd792db",
        "paymentId": "PAY-20251126-621E",
        "amount": 100,
        "installmentNumber": 1,
        "paymentMethod": "WALLET",
        "status": "COMPLETED",
        "commissionAmount": 10,
        "commissionCreditedToReferrer": true,
        "completedAt": "2025-11-26T10:30:45.123Z",
        "createdAt": "2025-11-26T10:30:45.123Z"
      },
      {
        "_id": "692758922e6db52eedd792e7",
        "paymentId": "PAY-20251127-A3B1",
        "amount": 100,
        "installmentNumber": 2,
        "paymentMethod": "RAZORPAY",
        "razorpayPaymentId": "pay_ABC123XYZ",
        "status": "COMPLETED",
        "commissionAmount": 10,
        "completedAt": "2025-11-27T09:15:20.456Z",
        "createdAt": "2025-11-27T09:00:00.000Z"
      },
      {
        "_id": "692758a02e6db52eedd792ff",
        "paymentId": "PAY-20251128-B4C2",
        "amount": 100,
        "installmentNumber": 3,
        "paymentMethod": "RAZORPAY",
        "status": "FAILED",
        "errorMessage": "Payment cancelled by user",
        "failedAt": "2025-11-28T10:00:00.000Z",
        "retryCount": 0,
        "createdAt": "2025-11-28T09:45:00.000Z"
      }
    ],
    "summary": {
      "totalPayments": 3,
      "completedPayments": 2,
      "failedPayments": 1,
      "totalAmount": 200,
      "totalCommission": 20
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getPaymentHistory(String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/payments/history/$orderId'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 13. Get All User Payments

**Endpoint:** `GET /api/installments/payments/my-payments`
**Authentication:** ✅ Required
**Description:** Get all payment records across all orders for the user

#### Query Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | Number | 1 | Page number |
| `limit` | Number | 20 | Payments per page |
| `status` | String | - | Filter: COMPLETED, FAILED, PENDING |
| `paymentMethod` | String | - | Filter: WALLET, RAZORPAY |

#### Example Request:
```
GET /api/installments/payments/my-payments?page=1&limit=20&status=COMPLETED
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "692758a02e6db52eedd792ff",
        "paymentId": "PAY-20251127-B4C2",
        "order": {
          "_id": "692758902e6db52eedd792da",
          "orderId": "ORD-20251126-F5C1",
          "product": {
            "name": "Premium Wireless Headphones",
            "image": "image1.jpg"
          }
        },
        "amount": 100,
        "installmentNumber": 6,
        "paymentMethod": "WALLET",
        "status": "COMPLETED",
        "commissionAmount": 10,
        "completedAt": "2025-11-27T10:15:30.456Z",
        "createdAt": "2025-11-27T10:15:30.456Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalPayments": 95,
      "paymentsPerPage": 20
    },
    "summary": {
      "totalPaid": 9500,
      "totalCommissionGenerated": 950,
      "walletPayments": 60,
      "razorpayPayments": 35
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getMyPayments({
  int page = 1,
  int limit = 20,
  String? status,
  String? paymentMethod,
}) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final queryParams = {
    'page': page.toString(),
    'limit': limit.toString(),
    if (status != null) 'status': status,
    if (paymentMethod != null) 'paymentMethod': paymentMethod,
  };

  final uri = Uri.parse('$baseUrl/api/installments/payments/my-payments')
      .replace(queryParameters: queryParams);

  final response = await http.get(
    uri,
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 14. Get Payment Statistics

**Endpoint:** `GET /api/installments/payments/stats`
**Authentication:** ✅ Required
**Description:** Get payment statistics for the user

#### Example Request:
```
GET /api/installments/payments/stats
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPayments": 95,
      "completedPayments": 90,
      "failedPayments": 3,
      "pendingPayments": 2,
      "totalAmountPaid": 9500,
      "totalCommissionGenerated": 950,
      "paymentMethods": {
        "WALLET": 60,
        "RAZORPAY": 35
      },
      "monthlyPayments": [
        {
          "month": "November 2025",
          "payments": 30,
          "amount": 3000
        },
        {
          "month": "October 2025",
          "payments": 31,
          "amount": 3100
        }
      ],
      "averagePaymentAmount": 100,
      "successRate": 94.74
    }
  }
}
```

---

### 15. Get Next Due Payment

**Endpoint:** `GET /api/installments/payments/next-due/:orderId`
**Authentication:** ✅ Required
**Description:** Get details of the next due payment for an order

#### Example Request:
```
GET /api/installments/payments/next-due/ORD-20251126-F5C1
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "nextPayment": {
      "installmentNumber": 7,
      "dueDate": "2025-11-28T00:00:00.000Z",
      "amount": 100,
      "status": "PENDING",
      "daysUntilDue": 1,
      "isOverdue": false,
      "canPayToday": false,
      "lastPaymentDate": "2025-11-27T10:15:30.456Z",
      "message": "You can pay your next installment tomorrow"
    },
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "productName": "Premium Wireless Headphones",
      "totalInstallments": 20,
      "paidInstallments": 6,
      "remainingInstallments": 14,
      "progressPercentage": 30
    }
  }
}
```

#### Error Response (No Pending Payment):
```json
{
  "success": false,
  "message": "No pending payments found",
  "data": {
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "status": "COMPLETED",
      "allPaymentsCompleted": true
    }
  }
}
```

---

### 16. Get Daily Pending Payments

**Endpoint:** `GET /api/installments/payments/daily-pending`
**Authentication:** ✅ Required
**Description:** Get all orders with pending payments for today (one payment per day rule)

#### Example Request:
```
GET /api/installments/payments/daily-pending
```

#### Success Response:
```json
{
  "success": true,
  "data": {
    "pendingPayments": [
      {
        "order": {
          "_id": "692758902e6db52eedd792da",
          "orderId": "ORD-20251126-F5C1",
          "product": {
            "name": "Premium Wireless Headphones",
            "image": "image1.jpg"
          },
          "paidInstallments": 6,
          "totalDays": 20,
          "progressPercentage": 30
        },
        "nextPayment": {
          "installmentNumber": 7,
          "amount": 100,
          "dueDate": "2025-11-27T00:00:00.000Z",
          "canPayToday": true
        }
      },
      {
        "order": {
          "_id": "692758922e6db52eedd792e7",
          "orderId": "ORD-20251120-A3B1",
          "product": {
            "name": "Smart Watch Pro",
            "image": "watch1.jpg"
          },
          "paidInstallments": 3,
          "totalDays": 10,
          "progressPercentage": 30
        },
        "nextPayment": {
          "installmentNumber": 4,
          "amount": 50,
          "dueDate": "2025-11-27T00:00:00.000Z",
          "canPayToday": true
        }
      }
    ],
    "summary": {
      "totalOrders": 2,
      "totalAmountDue": 150,
      "overduePayments": 0
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> getDailyPendingPayments() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/installments/payments/daily-pending'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

### 17. Retry Failed Payment

**Endpoint:** `POST /api/installments/payments/:paymentId/retry`
**Authentication:** ✅ Required
**Description:** Retry a failed payment

#### Example Request:
```
POST /api/installments/payments/PAY-20251128-B4C2/retry
```

#### Request Body:
```json
{
  "paymentMethod": "WALLET"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Payment retry successful",
  "data": {
    "payment": {
      "paymentId": "PAY-20251128-B4C2",
      "amount": 100,
      "status": "COMPLETED",
      "retryCount": 1,
      "completedAt": "2025-11-28T14:30:00.000Z"
    },
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "paidInstallments": 7,
      "remainingAmount": 300
    }
  }
}
```

#### Flutter Implementation:
```dart
Future<Map<String, dynamic>> retryPayment({
  required String paymentId,
  required String paymentMethod,
}) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/installments/payments/$paymentId/retry'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'paymentMethod': paymentMethod,
    }),
  );

  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  } else {
    throw Exception(jsonDecode(response.body)['message']);
  }
}
```

---

## 🛡️ ADMIN ENDPOINTS

*Note: These endpoints require admin role. Check with backend team for admin authentication.*

### 18. Get Dashboard Statistics

**Endpoint:** `GET /api/installments/admin/orders/dashboard/stats`
**Authentication:** ✅ Required (Admin)
**Description:** Get comprehensive dashboard statistics

#### Success Response:
```json
{
  "success": true,
  "data": {
    "stats": {
      "orders": {
        "total": 1250,
        "active": 450,
        "completed": 650,
        "cancelled": 100,
        "pending": 50
      },
      "revenue": {
        "total": 5000000,
        "thisMonth": 350000,
        "thisWeek": 85000,
        "today": 12000
      },
      "payments": {
        "totalProcessed": 15000,
        "completedToday": 120,
        "failedToday": 5,
        "pendingApproval": 25
      },
      "delivery": {
        "pendingApproval": 45,
        "approved": 30,
        "shipped": 15,
        "delivered": 550
      },
      "users": {
        "totalActiveUsers": 850,
        "newUsersToday": 12,
        "newUsersThisMonth": 145
      }
    }
  }
}
```

---

### 19. Get All Orders (Admin)

**Endpoint:** `GET /api/installments/admin/orders/all`
**Authentication:** ✅ Required (Admin)
**Description:** Get all orders with advanced filtering

#### Query Parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | Number | Page number |
| `limit` | Number | Orders per page |
| `status` | String | PENDING, ACTIVE, COMPLETED, CANCELLED |
| `deliveryStatus` | String | PENDING, APPROVED, SHIPPED, DELIVERED |
| `search` | String | Search by order ID, user name, email |
| `startDate` | String | Filter from date (ISO format) |
| `endDate` | String | Filter to date (ISO format) |

---

### 20. Approve Delivery

**Endpoint:** `POST /api/installments/admin/orders/:orderId/approve-delivery`
**Authentication:** ✅ Required (Admin)
**Description:** Approve delivery after all payments complete

#### Request Body:
```json
{
  "notes": "All payments verified. Ready for delivery."
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Delivery approved successfully",
  "data": {
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "deliveryStatus": "APPROVED",
      "deliveryApprovedBy": "admin-user-id",
      "deliveryApprovedAt": "2025-12-15T14:30:00.000Z"
    }
  }
}
```

---

### 21. Update Delivery Status

**Endpoint:** `PUT /api/installments/admin/orders/:orderId/delivery-status`
**Authentication:** ✅ Required (Admin)
**Description:** Update delivery status (SHIPPED, DELIVERED, etc.)

#### Request Body:
```json
{
  "deliveryStatus": "SHIPPED",
  "trackingNumber": "TRACK123456",
  "courierService": "BlueDart",
  "notes": "Shipped via BlueDart"
}
```

#### Success Response:
```json
{
  "success": true,
  "message": "Delivery status updated successfully",
  "data": {
    "order": {
      "orderId": "ORD-20251126-F5C1",
      "deliveryStatus": "SHIPPED",
      "trackingInfo": {
        "trackingNumber": "TRACK123456",
        "courierService": "BlueDart"
      }
    }
  }
}
```

---

## 📊 MODELS & DATA STRUCTURES

### InstallmentOrder Model

```dart
class InstallmentOrder {
  final String id;
  final String orderId;
  final String userId;
  final Product product;
  final int quantity;
  final double pricePerUnit;
  final double totalProductPrice;
  final double productPrice;
  final int totalDays;
  final double dailyPaymentAmount;
  final String status; // PENDING, ACTIVE, COMPLETED, CANCELLED
  final String deliveryStatus; // PENDING, APPROVED, SHIPPED, DELIVERED
  final int paidInstallments;
  final double totalPaidAmount;
  final double remainingAmount;
  final String firstPaymentMethod;
  final DeliveryAddress deliveryAddress;
  final String? couponCode;
  final double? couponDiscount;
  final String? couponType; // INSTANT, REDUCE_DAYS
  final DateTime createdAt;
  final DateTime updatedAt;

  InstallmentOrder({
    required this.id,
    required this.orderId,
    required this.userId,
    required this.product,
    required this.quantity,
    required this.pricePerUnit,
    required this.totalProductPrice,
    required this.productPrice,
    required this.totalDays,
    required this.dailyPaymentAmount,
    required this.status,
    required this.deliveryStatus,
    required this.paidInstallments,
    required this.totalPaidAmount,
    required this.remainingAmount,
    required this.firstPaymentMethod,
    required this.deliveryAddress,
    this.couponCode,
    this.couponDiscount,
    this.couponType,
    required this.createdAt,
    required this.updatedAt,
  });

  factory InstallmentOrder.fromJson(Map<String, dynamic> json) {
    return InstallmentOrder(
      id: json['_id'],
      orderId: json['orderId'],
      userId: json['user'],
      product: Product.fromJson(json['product']),
      quantity: json['quantity'] ?? 1,
      pricePerUnit: json['pricePerUnit'].toDouble(),
      totalProductPrice: json['totalProductPrice'].toDouble(),
      productPrice: json['productPrice'].toDouble(),
      totalDays: json['totalDays'],
      dailyPaymentAmount: json['dailyPaymentAmount'].toDouble(),
      status: json['status'],
      deliveryStatus: json['deliveryStatus'],
      paidInstallments: json['paidInstallments'],
      totalPaidAmount: json['totalPaidAmount'].toDouble(),
      remainingAmount: json['remainingAmount'].toDouble(),
      firstPaymentMethod: json['firstPaymentMethod'],
      deliveryAddress: DeliveryAddress.fromJson(json['deliveryAddress']),
      couponCode: json['couponCode'],
      couponDiscount: json['couponDiscount']?.toDouble(),
      couponType: json['couponType'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}
```

### PaymentRecord Model

```dart
class PaymentRecord {
  final String id;
  final String paymentId;
  final String orderId;
  final double amount;
  final int installmentNumber;
  final String paymentMethod; // WALLET, RAZORPAY
  final String status; // PENDING, COMPLETED, FAILED
  final String? razorpayOrderId;
  final String? razorpayPaymentId;
  final double? commissionAmount;
  final bool commissionCreditedToReferrer;
  final DateTime? completedAt;
  final DateTime? failedAt;
  final String? errorMessage;
  final int retryCount;
  final DateTime createdAt;

  PaymentRecord({
    required this.id,
    required this.paymentId,
    required this.orderId,
    required this.amount,
    required this.installmentNumber,
    required this.paymentMethod,
    required this.status,
    this.razorpayOrderId,
    this.razorpayPaymentId,
    this.commissionAmount,
    required this.commissionCreditedToReferrer,
    this.completedAt,
    this.failedAt,
    this.errorMessage,
    required this.retryCount,
    required this.createdAt,
  });

  factory PaymentRecord.fromJson(Map<String, dynamic> json) {
    return PaymentRecord(
      id: json['_id'],
      paymentId: json['paymentId'],
      orderId: json['order'],
      amount: json['amount'].toDouble(),
      installmentNumber: json['installmentNumber'],
      paymentMethod: json['paymentMethod'],
      status: json['status'],
      razorpayOrderId: json['razorpayOrderId'],
      razorpayPaymentId: json['razorpayPaymentId'],
      commissionAmount: json['commissionAmount']?.toDouble(),
      commissionCreditedToReferrer: json['commissionCreditedToReferrer'] ?? false,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
      failedAt: json['failedAt'] != null
          ? DateTime.parse(json['failedAt'])
          : null,
      errorMessage: json['errorMessage'],
      retryCount: json['retryCount'] ?? 0,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
```

### DeliveryAddress Model

```dart
class DeliveryAddress {
  final String name;
  final String phoneNumber;
  final String addressLine1;
  final String? addressLine2;
  final String city;
  final String state;
  final String pincode;

  DeliveryAddress({
    required this.name,
    required this.phoneNumber,
    required this.addressLine1,
    this.addressLine2,
    required this.city,
    required this.state,
    required this.pincode,
  });

  factory DeliveryAddress.fromJson(Map<String, dynamic> json) {
    return DeliveryAddress(
      name: json['name'],
      phoneNumber: json['phoneNumber'],
      addressLine1: json['addressLine1'],
      addressLine2: json['addressLine2'],
      city: json['city'],
      state: json['state'],
      pincode: json['pincode'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phoneNumber': phoneNumber,
      'addressLine1': addressLine1,
      if (addressLine2 != null) 'addressLine2': addressLine2,
      'city': city,
      'state': state,
      'pincode': pincode,
    };
  }
}
```

---

## 🔄 COMPLETE ORDER FLOW

### Step-by-Step Integration Guide

#### Step 1: User Selects Product & Plan
```dart
// User views product details
final product = await getProductDetails(productId);

// User selects quantity and payment plan
int quantity = 2;
int totalDays = 20;
double dailyAmount = calculateDailyAmount(
  product.price * quantity,
  totalDays
);
```

#### Step 2: Validate Coupon (Optional)
```dart
if (couponCode != null) {
  try {
    final couponData = await validateCoupon(
      couponCode: couponCode,
      productId: productId,
      quantity: quantity,
      totalDays: totalDays,
    );

    // Show discount to user
    final discount = couponData['data']['pricing']['discountAmount'];
    final finalPrice = couponData['data']['pricing']['finalPrice'];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Coupon Applied!'),
        content: Text('You saved ₹$discount'),
      ),
    );
  } catch (e) {
    // Show error
    showErrorDialog(e.toString());
  }
}
```

#### Step 3: Create Order
```dart
Future<void> createNewOrder() async {
  try {
    // Collect delivery address
    final address = await getDeliveryAddress();

    // Choose payment method
    final paymentMethod = await showPaymentMethodDialog(); // WALLET or RAZORPAY

    // Create order
    final result = await createOrder(
      productId: productId,
      totalDays: totalDays,
      dailyAmount: dailyAmount,
      paymentMethod: paymentMethod,
      deliveryAddress: address.toJson(),
      quantity: quantity,
      couponCode: couponCode,
    );

    if (paymentMethod == 'WALLET') {
      // Order created, first payment completed
      showSuccessDialog('Order created successfully!');
      navigateToOrderDetails(result['data']['order']['orderId']);
    } else if (paymentMethod == 'RAZORPAY') {
      // Open Razorpay for first payment
      final razorpayOrder = result['data']['razorpayOrder'];
      await openRazorpayCheckout(razorpayOrder);
    }
  } catch (e) {
    showErrorDialog(e.toString());
  }
}
```

#### Step 4: Process Razorpay Payment (If Applicable)
```dart
void openRazorpayCheckout(Map<String, dynamic> razorpayOrder) {
  var options = {
    'key': 'YOUR_RAZORPAY_KEY',
    'amount': razorpayOrder['amount'],
    'order_id': razorpayOrder['id'],
    'name': 'Your App Name',
    'description': 'First Installment Payment',
  };

  _razorpay.open(options);
}

void _handlePaymentSuccess(PaymentSuccessResponse response) async {
  try {
    // Verify payment on backend
    await processPayment(
      orderId: currentOrderId,
      paymentMethod: 'RAZORPAY',
      razorpayOrderId: response.orderId!,
      razorpayPaymentId: response.paymentId!,
      razorpaySignature: response.signature!,
    );

    showSuccessDialog('Payment successful! Order is now active.');
    navigateToOrderDetails(currentOrderId);
  } catch (e) {
    showErrorDialog('Payment verification failed: $e');
  }
}
```

#### Step 5: Daily Payment Reminder
```dart
// Fetch pending payments for today
Future<void> checkDailyPayments() async {
  try {
    final result = await getDailyPendingPayments();
    final pendingPayments = result['data']['pendingPayments'];

    if (pendingPayments.isNotEmpty) {
      // Show notification
      showLocalNotification(
        title: 'Payment Due Today',
        body: 'You have ${pendingPayments.length} payment(s) due today',
      );
    }
  } catch (e) {
    print('Error fetching daily payments: $e');
  }
}
```

#### Step 6: Make Daily Payment
```dart
Future<void> makeInstallmentPayment(String orderId) async {
  try {
    // Check if payment already made today
    final nextPayment = await getNextDuePayment(orderId);

    if (!nextPayment['data']['nextPayment']['canPayToday']) {
      showErrorDialog('You have already made a payment today. Try tomorrow!');
      return;
    }

    // Choose payment method
    final paymentMethod = await showPaymentMethodDialog();

    if (paymentMethod == 'WALLET') {
      // Direct wallet payment
      final result = await processPayment(
        orderId: orderId,
        paymentMethod: 'WALLET',
      );

      showSuccessDialog(result['message']);
      refreshOrderDetails();
    } else {
      // Create Razorpay order first
      final razorpayData = await createRazorpayOrder(orderId);
      await openRazorpayCheckout(razorpayData['data']['razorpayOrder']);
    }
  } catch (e) {
    showErrorDialog(e.toString());
  }
}
```

#### Step 7: Track Order Progress
```dart
Future<void> showOrderProgress(String orderId) async {
  try {
    final summary = await getOrderSummary(orderId);
    final progress = summary['data']['summary']['paymentProgress'];

    // Display progress
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Order Progress'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LinearProgressIndicator(
              value: progress['progressPercentage'] / 100,
            ),
            SizedBox(height: 16),
            Text('${progress['paidInstallments']} / ${progress['totalDays']} days paid'),
            Text('₹${progress['paidAmount']} / ₹${progress['totalAmount']}'),
            Text('Remaining: ₹${progress['remainingAmount']}'),
          ],
        ),
      ),
    );
  } catch (e) {
    showErrorDialog(e.toString());
  }
}
```

#### Step 8: Track Delivery
```dart
Future<void> trackDelivery(String orderId) async {
  try {
    final orderData = await getOrderDetails(orderId);
    final order = orderData['data']['order'];

    String deliveryMessage;

    switch (order['deliveryStatus']) {
      case 'PENDING':
        if (order['status'] == 'COMPLETED') {
          deliveryMessage = 'All payments complete! Awaiting admin approval for delivery.';
        } else {
          deliveryMessage = 'Complete all payments to initiate delivery.';
        }
        break;
      case 'APPROVED':
        deliveryMessage = 'Delivery approved! Your order will be shipped soon.';
        break;
      case 'SHIPPED':
        deliveryMessage = 'Order shipped! Tracking: ${order['trackingNumber']}';
        break;
      case 'DELIVERED':
        deliveryMessage = 'Order delivered successfully!';
        break;
      default:
        deliveryMessage = 'Unknown delivery status';
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delivery Status'),
        content: Text(deliveryMessage),
      ),
    );
  } catch (e) {
    showErrorDialog(e.toString());
  }
}
```

---

## ⚠️ ERROR HANDLING

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `PRODUCT_NOT_FOUND` | Product doesn't exist | Verify productId |
| `INSUFFICIENT_WALLET_BALANCE` | Not enough wallet balance | Add money or use Razorpay |
| `PAYMENT_ALREADY_DONE_TODAY` | Already paid today | Wait until tomorrow |
| `ORDER_NOT_FOUND` | Order doesn't exist | Verify orderId |
| `UNAUTHORIZED_ACCESS` | User not authorized | Check authentication |
| `COUPON_EXPIRED` | Coupon expired | Use valid coupon |
| `COUPON_INVALID` | Invalid coupon code | Check coupon code |
| `MIN_ORDER_VALUE_NOT_MET` | Order value too low | Increase quantity or choose different product |
| `INVALID_INSTALLMENT_DURATION` | Duration < 5 days | Choose minimum 5 days |
| `INVALID_DAILY_AMOUNT` | Amount < ₹50 | Increase daily amount |
| `RAZORPAY_VERIFICATION_FAILED` | Payment signature invalid | Contact support |
| `ORDER_ALREADY_COMPLETED` | Order already complete | Check order status |
| `ORDER_ALREADY_CANCELLED` | Order is cancelled | Create new order |

### Error Handling Example

```dart
Future<void> handleApiCall(Future<void> Function() apiCall) async {
  try {
    await apiCall();
  } catch (e) {
    if (e.toString().contains('INSUFFICIENT_WALLET_BALANCE')) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Insufficient Balance'),
          content: Text('Please add money to your wallet or use Razorpay'),
          actions: [
            TextButton(
              onPressed: () => navigateToWallet(),
              child: Text('Add Money'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel'),
            ),
          ],
        ),
      );
    } else if (e.toString().contains('PAYMENT_ALREADY_DONE_TODAY')) {
      showErrorDialog('You have already made a payment today. Please try again tomorrow.');
    } else if (e.toString().contains('UNAUTHORIZED')) {
      // Re-authenticate user
      await FirebaseAuth.instance.signOut();
      navigateToLogin();
    } else {
      // Generic error
      showErrorDialog(e.toString());
    }
  }
}
```

---

## 🎯 BEST PRACTICES

### 1. **Token Refresh**
```dart
// Always get fresh token before API calls
final token = await FirebaseAuth.instance.currentUser?.getIdToken(true);
```

### 2. **Loading States**
```dart
bool isLoading = false;

Future<void> fetchData() async {
  setState(() => isLoading = true);
  try {
    final data = await apiCall();
    // Process data
  } catch (e) {
    // Handle error
  } finally {
    setState(() => isLoading = false);
  }
}
```

### 3. **Pagination**
```dart
class OrderListScreen extends StatefulWidget {
  @override
  _OrderListScreenState createState() => _OrderListScreenState();
}

class _OrderListScreenState extends State<OrderListScreen> {
  List<InstallmentOrder> orders = [];
  int currentPage = 1;
  bool hasMore = true;
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    loadOrders();
  }

  Future<void> loadOrders() async {
    if (isLoading || !hasMore) return;

    setState(() => isLoading = true);

    try {
      final result = await getUserOrders(page: currentPage, limit: 10);
      final newOrders = (result['data']['orders'] as List)
          .map((json) => InstallmentOrder.fromJson(json))
          .toList();

      setState(() {
        orders.addAll(newOrders);
        currentPage++;
        hasMore = result['data']['pagination']['hasNextPage'];
      });
    } catch (e) {
      showErrorDialog(e.toString());
    } finally {
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: orders.length + (hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == orders.length) {
          loadOrders();
          return Center(child: CircularProgressIndicator());
        }
        return OrderCard(order: orders[index]);
      },
    );
  }
}
```

### 4. **Offline Support**
```dart
// Cache data locally using shared_preferences or hive
Future<void> cacheOrders(List<InstallmentOrder> orders) async {
  final prefs = await SharedPreferences.getInstance();
  final ordersJson = orders.map((o) => o.toJson()).toList();
  await prefs.setString('cached_orders', jsonEncode(ordersJson));
}

Future<List<InstallmentOrder>> getCachedOrders() async {
  final prefs = await SharedPreferences.getInstance();
  final ordersString = prefs.getString('cached_orders');
  if (ordersString != null) {
    final List<dynamic> ordersJson = jsonDecode(ordersString);
    return ordersJson.map((json) => InstallmentOrder.fromJson(json)).toList();
  }
  return [];
}
```

### 5. **Payment Reminder Notifications**
```dart
// Schedule daily notification for pending payments
Future<void> scheduleDailyPaymentReminder() async {
  final pendingPayments = await getDailyPendingPayments();

  if (pendingPayments['data']['pendingPayments'].isNotEmpty) {
    final totalDue = pendingPayments['data']['summary']['totalAmountDue'];

    await AwesomeNotifications().createNotification(
      content: NotificationContent(
        id: 1,
        channelKey: 'payment_reminders',
        title: 'Payment Due Today',
        body: 'You have payments totaling ₹$totalDue due today',
        notificationLayout: NotificationLayout.Default,
      ),
    );
  }
}
```

### 6. **Retry Logic**
```dart
Future<T> retryApiCall<T>({
  required Future<T> Function() apiCall,
  int maxRetries = 3,
  Duration delay = const Duration(seconds: 2),
}) async {
  int retries = 0;

  while (retries < maxRetries) {
    try {
      return await apiCall();
    } catch (e) {
      retries++;
      if (retries >= maxRetries) {
        rethrow;
      }
      await Future.delayed(delay);
    }
  }

  throw Exception('Max retries exceeded');
}
```

---

## 📝 SUMMARY

### Key Points for Flutter Team:

1. **Base URL:** Update with production URL
2. **Authentication:** All endpoints (except coupon validation) require Firebase JWT token
3. **Payment Methods:** Support both WALLET and RAZORPAY
4. **One Payment Per Day:** Enforce this rule in UI
5. **Error Handling:** Handle all error codes properly
6. **Progress Tracking:** Use summary endpoint for visual progress
7. **Notifications:** Schedule daily reminders for pending payments
8. **Razorpay Integration:** Follow the payment flow exactly as documented
9. **Pagination:** Implement for orders and payment lists
10. **Offline Support:** Cache order data locally

### Testing Checklist:

- [ ] Create order with WALLET payment
- [ ] Create order with RAZORPAY payment
- [ ] Make subsequent payments
- [ ] Test one-payment-per-day restriction
- [ ] Apply coupons (INSTANT and REDUCE_DAYS)
- [ ] View order details and progress
- [ ] View payment history
- [ ] Cancel order
- [ ] Handle payment failures
- [ ] Retry failed payments
- [ ] Test with multiple quantities
- [ ] Test all error scenarios

---

**Document Version:** 1.0
**Contact:** Backend Team
**Support:** GitHub Issues

---

✅ **This documentation is complete and production-ready!**
