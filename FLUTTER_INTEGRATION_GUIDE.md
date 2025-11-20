# Installment System - Flutter Integration Guide

## 🎯 Overview

**Backend handles EVERYTHING** - order creation, Razorpay order creation, payment verification, commission calculation.

**Flutter app only:**
- Calls backend APIs
- Opens Razorpay SDK when backend returns payment details
- Sends payment response back to backend for verification

---

## 📱 Payment Flow

### Wallet Payment (Simple)
```
User clicks "Create Order" with Wallet
    ↓
App calls: POST /orders (paymentMethod: WALLET)
    ↓
Backend: Creates order + deducts wallet + credits commission
    ↓
App shows: "Order created successfully!"
```

### Razorpay Payment (3 Steps)
```
User clicks "Create Order" with Razorpay
    ↓
Step 1: App calls: POST /orders (paymentMethod: RAZORPAY)
    ↓
Backend: Creates order + creates Razorpay order
    ↓
Backend returns: Razorpay order details (id, amount, key)
    ↓
Step 2: App opens Razorpay SDK with these details
    ↓
User completes payment on Razorpay
    ↓
Razorpay SDK returns: payment_id, order_id, signature
    ↓
Step 3: App calls: POST /payments/process
    ↓
Backend: Verifies signature + completes payment + credits commission
    ↓
App shows: "Payment successful!"
```

---

## 🔧 Flutter Setup

### 1. Add Razorpay Dependency

**pubspec.yaml:**
```yaml
dependencies:
  razorpay_flutter: ^1.3.4
  http: ^1.1.0
```

### 2. Initialize Razorpay in Your Widget

```dart
import 'package:razorpay_flutter/razorpay_flutter.dart';

class OrderPage extends StatefulWidget {
  @override
  _OrderPageState createState() => _OrderPageState();
}

class _OrderPageState extends State<OrderPage> {
  late Razorpay _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    super.dispose();
    _razorpay.clear();
  }

  // Handler methods will be added below
}
```

---

## 📡 API Integration

### Base Configuration

```dart
class ApiService {
  static const String baseUrl = 'http://your-server.com/api/installment';
  static String? authToken; // Set this after user login

  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $authToken',
  };
}
```

---

## 1️⃣ Create Order (Wallet Payment)

### Flutter Code:

```dart
Future<void> createOrderWithWallet() async {
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/orders'),
    headers: ApiService.headers,
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
        'pincode': '400001',
      }
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Order created successfully
    final orderId = data['data']['order']['orderId'];
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Success'),
        content: Text('Order created! Order ID: $orderId'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK'),
          ),
        ],
      ),
    );
  } else {
    // Show error
    showError(data['error']['message']);
  }
}
```

**What Backend Does:**
- ✅ Creates order in database
- ✅ Deducts first payment from wallet
- ✅ Marks first installment as PAID
- ✅ Calculates and credits commission to referrer (90-10 split)
- ✅ Returns order details

**What You Get:**
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

---

## 2️⃣ Create Order (Razorpay Payment)

### Step 1: Call Backend to Create Order

```dart
Future<void> createOrderWithRazorpay() async {
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/orders'),
    headers: ApiService.headers,
    body: jsonEncode({
      'productId': '64a1b2c3d4e5f6789012345',
      'totalDays': 30,
      'paymentMethod': 'RAZORPAY',
      'deliveryAddress': {
        'name': 'John Doe',
        'phoneNumber': '9876543210',
        'addressLine1': '123 Main Street',
        'city': 'Mumbai',
        'state': 'Maharashtra',
        'pincode': '400001',
      }
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Backend created Razorpay order
    final razorpayOrder = data['data']['razorpayOrder'];
    final orderId = data['data']['order']['orderId'];

    // Open Razorpay payment
    openRazorpayCheckout(razorpayOrder, orderId);
  } else {
    showError(data['error']['message']);
  }
}
```

**What Backend Does:**
- ✅ Creates order in database
- ✅ Calls Razorpay API to create Razorpay order
- ✅ Returns Razorpay order details for SDK

**What You Get:**
```json
{
  "success": true,
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

---

### Step 2: Open Razorpay SDK

```dart
void openRazorpayCheckout(Map<String, dynamic> razorpayOrder, String orderId) {
  var options = {
    'key': razorpayOrder['keyId'],
    'amount': razorpayOrder['amount'],
    'currency': razorpayOrder['currency'],
    'order_id': razorpayOrder['id'],
    'name': 'Your Store Name',
    'description': 'Installment Payment',
    'prefill': {
      'contact': '9876543210',
      'email': 'user@example.com'
    },
    'theme': {
      'color': '#F37254'
    }
  };

  try {
    _razorpay.open(options);
    // Store orderId for verification step
    _currentOrderId = orderId;
  } catch (e) {
    print('Error: $e');
  }
}
```

---

### Step 3: Handle Payment Success & Verify

```dart
String? _currentOrderId;

void _handlePaymentSuccess(PaymentSuccessResponse response) {
  // Send to backend for verification
  verifyPayment(
    orderId: _currentOrderId!,
    razorpayOrderId: response.orderId!,
    razorpayPaymentId: response.paymentId!,
    razorpaySignature: response.signature!,
  );
}

void _handlePaymentError(PaymentFailureResponse response) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Payment Failed'),
      content: Text('Error: ${response.message}'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('OK'),
        ),
      ],
    ),
  );
}

void _handleExternalWallet(ExternalWalletResponse response) {
  print('External Wallet: ${response.walletName}');
}

Future<void> verifyPayment({
  required String orderId,
  required String razorpayOrderId,
  required String razorpayPaymentId,
  required String razorpaySignature,
}) async {
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/payments/process'),
    headers: ApiService.headers,
    body: jsonEncode({
      'orderId': orderId,
      'paymentMethod': 'RAZORPAY',
      'razorpayOrderId': razorpayOrderId,
      'razorpayPaymentId': razorpayPaymentId,
      'razorpaySignature': razorpaySignature,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Success!'),
        content: Text(data['message']),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // Navigate to order details page
            },
            child: Text('View Order'),
          ),
        ],
      ),
    );
  } else {
    showError(data['error']['message']);
  }
}
```

**What Backend Does in Verification:**
- ✅ Verifies Razorpay signature (security check)
- ✅ Marks payment as COMPLETED
- ✅ Updates order status to ACTIVE
- ✅ Marks first installment as PAID
- ✅ Calculates and credits commission to referrer
- ✅ Returns success response

---

## 3️⃣ Pay Daily Installment (Wallet)

```dart
Future<void> payInstallmentWithWallet(String orderId) async {
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/payments/process'),
    headers: ApiService.headers,
    body: jsonEncode({
      'orderId': orderId,
      'paymentMethod': 'WALLET',
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Payment Successful'),
        content: Text(data['message']),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK'),
          ),
        ],
      ),
    );
  } else {
    showError(data['error']['message']);
  }
}
```

**What Backend Does:**
- ✅ Deducts amount from wallet
- ✅ Marks next installment as PAID
- ✅ Updates order totals
- ✅ Calculates and credits commission
- ✅ Checks if order is complete
- ✅ Returns payment details

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
      "progress": 13.33,
      "isCompleted": false
    }
  }
}
```

---

## 4️⃣ Pay Daily Installment (Razorpay)

### Step 1: Create Razorpay Order for Payment

```dart
Future<void> payInstallmentWithRazorpay(String orderId) async {
  // First, ask backend to create Razorpay order
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/payments/create-razorpay-order'),
    headers: ApiService.headers,
    body: jsonEncode({
      'orderId': orderId,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    final razorpayOrder = data['data'];
    openRazorpayCheckout(razorpayOrder, orderId);
  } else {
    showError(data['error']['message']);
  }
}
```

**Backend Response:**
```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_MXkj8d9sKLm2Pq",
    "amount": 400000,
    "currency": "INR",
    "keyId": "rzp_test_xxxxx",
    "installmentNumber": 2
  }
}
```

**Step 2 & 3:** Same as order creation - open SDK, then verify payment

---

## 5️⃣ View Order Details

```dart
Future<Map<String, dynamic>> getOrderDetails(String orderId) async {
  final response = await http.get(
    Uri.parse('${ApiService.baseUrl}/orders/$orderId'),
    headers: ApiService.headers,
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['data']['order'];
  } else {
    throw Exception(data['error']['message']);
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

**UI Display:**
```dart
Widget buildOrderCard(Map<String, dynamic> order) {
  return Card(
    child: Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            order['productName'],
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          LinearProgressIndicator(
            value: order['progress'] / 100,
            backgroundColor: Colors.grey[300],
            valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
          ),
          SizedBox(height: 8),
          Text('${order['progress']}% Complete'),
          Text('₹${order['totalPaidAmount']} / ₹${order['productPrice']}'),
          Text('${order['paidInstallments']}/${order['totalDays']} Installments Paid'),
          SizedBox(height: 16),
          if (order['status'] == 'ACTIVE')
            ElevatedButton(
              onPressed: () => _showPaymentOptions(order['orderId']),
              child: Text('Pay Next Installment (₹${order['dailyPaymentAmount']})'),
            ),
          if (order['status'] == 'COMPLETED')
            Chip(
              label: Text('Awaiting Delivery Approval'),
              backgroundColor: Colors.orange,
            ),
        ],
      ),
    ),
  );
}
```

---

## 6️⃣ View Payment Schedule

```dart
Future<Map<String, dynamic>> getPaymentSchedule(String orderId) async {
  final response = await http.get(
    Uri.parse('${ApiService.baseUrl}/orders/$orderId/schedule'),
    headers: ApiService.headers,
  );

  return jsonDecode(response.body)['data'];
}
```

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

**UI Display:**
```dart
Widget buildPaymentSchedule(List<dynamic> schedule) {
  return ListView.builder(
    itemCount: schedule.length,
    itemBuilder: (context, index) {
      final item = schedule[index];
      return ListTile(
        leading: Icon(
          item['status'] == 'PAID'
            ? Icons.check_circle
            : Icons.radio_button_unchecked,
          color: item['status'] == 'PAID' ? Colors.green : Colors.grey,
        ),
        title: Text('Day ${item['installmentNumber']}'),
        subtitle: Text(item['status']),
        trailing: Text('₹${item['amount']}'),
      );
    },
  );
}
```

---

## 7️⃣ Get User's All Orders

```dart
Future<List<dynamic>> getUserOrders({String? status, int page = 1}) async {
  String url = '${ApiService.baseUrl}/orders?page=$page&limit=20';
  if (status != null) {
    url += '&status=$status';
  }

  final response = await http.get(
    Uri.parse(url),
    headers: ApiService.headers,
  );

  final data = jsonDecode(response.body);
  return data['data']['orders'];
}
```

**Display:**
```dart
Widget buildOrdersList() {
  return FutureBuilder<List<dynamic>>(
    future: getUserOrders(status: 'ACTIVE'),
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting) {
        return Center(child: CircularProgressIndicator());
      }

      if (snapshot.hasError) {
        return Center(child: Text('Error: ${snapshot.error}'));
      }

      final orders = snapshot.data!;
      return ListView.builder(
        itemCount: orders.length,
        itemBuilder: (context, index) {
          return buildOrderCard(orders[index]);
        },
      );
    },
  );
}
```

---

## 8️⃣ Cancel Order

```dart
Future<void> cancelOrder(String orderId, String reason) async {
  final response = await http.post(
    Uri.parse('${ApiService.baseUrl}/orders/$orderId/cancel'),
    headers: ApiService.headers,
    body: jsonEncode({
      'reason': reason,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Order Cancelled'),
        content: Text('Your order has been cancelled successfully.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK'),
          ),
        ],
      ),
    );
  } else {
    showError(data['error']['message']);
  }
}
```

---

## ⚠️ Error Handling

```dart
void showError(String message) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Error'),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('OK'),
        ),
      ],
    ),
  );
}

// Handle specific errors
Future<void> makeApiCall() async {
  try {
    final response = await http.post(/* ... */);
    final data = jsonDecode(response.body);

    if (!data['success']) {
      final errorCode = data['error']['code'];

      switch (errorCode) {
        case 'INSUFFICIENT_BALANCE':
          final details = data['error']['details'];
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: Text('Insufficient Balance'),
              content: Text(
                'You need ₹${details['required']} but only have ₹${details['available']}.\n'
                'Please add ₹${details['shortfall']} to your wallet.'
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel'),
                ),
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                    // Navigate to Add Money page
                  },
                  child: Text('Add Money'),
                ),
              ],
            ),
          );
          break;

        case 'ORDER_ALREADY_COMPLETED':
          showError('This order is already completed.');
          break;

        default:
          showError(data['error']['message']);
      }
    }
  } catch (e) {
    showError('Network error. Please try again.');
  }
}
```

---

## 🎯 Complete Example: Order Creation Screen

```dart
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class CreateOrderScreen extends StatefulWidget {
  final Map<String, dynamic> product;

  CreateOrderScreen({required this.product});

  @override
  _CreateOrderScreenState createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends State<CreateOrderScreen> {
  late Razorpay _razorpay;
  String? _currentOrderId;
  int _selectedDays = 30;
  String _paymentMethod = 'WALLET';
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _createOrder() async {
    setState(() => _isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('${ApiService.baseUrl}/orders'),
        headers: ApiService.headers,
        body: jsonEncode({
          'productId': widget.product['_id'],
          'totalDays': _selectedDays,
          'paymentMethod': _paymentMethod,
          'deliveryAddress': {
            'name': 'John Doe',
            'phoneNumber': '9876543210',
            'addressLine1': '123 Main Street',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'pincode': '400001',
          }
        }),
      );

      final data = jsonDecode(response.body);

      if (data['success']) {
        if (_paymentMethod == 'WALLET') {
          // Order created with wallet - done!
          _showSuccessDialog(data['message']);
        } else {
          // Razorpay - open payment
          _currentOrderId = data['data']['order']['orderId'];
          _openRazorpay(data['data']['razorpayOrder']);
        }
      } else {
        _showError(data['error']['message']);
      }
    } catch (e) {
      _showError('Network error. Please try again.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _openRazorpay(Map<String, dynamic> razorpayOrder) {
    var options = {
      'key': razorpayOrder['keyId'],
      'amount': razorpayOrder['amount'],
      'currency': razorpayOrder['currency'],
      'order_id': razorpayOrder['id'],
      'name': 'Your Store',
      'description': 'First Installment',
    };

    _razorpay.open(options);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    // Verify with backend
    final verifyResponse = await http.post(
      Uri.parse('${ApiService.baseUrl}/payments/process'),
      headers: ApiService.headers,
      body: jsonEncode({
        'orderId': _currentOrderId,
        'paymentMethod': 'RAZORPAY',
        'razorpayOrderId': response.orderId,
        'razorpayPaymentId': response.paymentId,
        'razorpaySignature': response.signature,
      }),
    );

    final data = jsonDecode(verifyResponse.body);
    if (data['success']) {
      _showSuccessDialog(data['message']);
    } else {
      _showError(data['error']['message']);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    _showError('Payment failed: ${response.message}');
  }

  void _showSuccessDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Success!'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              Navigator.pop(context); // Go back to previous screen
            },
            child: Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Error'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dailyAmount = (widget.product['pricing']['finalPrice'] / _selectedDays).ceil();

    return Scaffold(
      appBar: AppBar(title: Text('Create Order')),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.product['name'],
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  Text('₹${widget.product['pricing']['finalPrice']}'),
                  SizedBox(height: 24),
                  Text('Select Duration:', style: TextStyle(fontSize: 18)),
                  DropdownButton<int>(
                    value: _selectedDays,
                    isExpanded: true,
                    items: [15, 30, 60, 90].map((days) {
                      final amount = (widget.product['pricing']['finalPrice'] / days).ceil();
                      return DropdownMenuItem(
                        value: days,
                        child: Text('$days days - ₹$amount/day'),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() => _selectedDays = value!);
                    },
                  ),
                  SizedBox(height: 24),
                  Text('Daily Payment: ₹$dailyAmount', style: TextStyle(fontSize: 18)),
                  SizedBox(height: 24),
                  Text('Payment Method:', style: TextStyle(fontSize: 18)),
                  RadioListTile(
                    title: Text('Wallet'),
                    value: 'WALLET',
                    groupValue: _paymentMethod,
                    onChanged: (value) {
                      setState(() => _paymentMethod = value!);
                    },
                  ),
                  RadioListTile(
                    title: Text('Razorpay (Card/UPI/NetBanking)'),
                    value: 'RAZORPAY',
                    groupValue: _paymentMethod,
                    onChanged: (value) {
                      setState(() => _paymentMethod = value!);
                    },
                  ),
                  SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _createOrder,
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Create Order', style: TextStyle(fontSize: 18)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
```

---

## 📝 Summary: What Backend Handles

### ✅ Order Creation
- Creates order in database
- Calculates daily amount if not provided
- Validates product price and days
- Creates payment schedule
- **If Wallet:** Deducts first payment, marks installment paid
- **If Razorpay:** Creates Razorpay order via API
- Credits commission to referrer (90-10 split)

### ✅ Payment Processing
- Verifies Razorpay signature (security)
- Updates order totals
- Marks installment as paid
- Calculates commission on every payment
- Credits commission to referrer wallet
- Checks if order is complete
- Updates order status

### ✅ Commission System
- Calculates: `amount × commission%`
- Splits: 90% available, 10% locked
- Credits to referrer's wallet
- Creates wallet transactions
- All automatic on every payment

---

## 🎯 Flutter App Only Needs To:

1. ✅ Call APIs with proper data
2. ✅ Show Razorpay SDK when backend returns payment details
3. ✅ Send payment response back to backend
4. ✅ Display order information nicely
5. ✅ Handle errors and show messages

**Backend does ALL the heavy lifting!** 🚀

---

**Need Help?**
- Check error.code and error.message in responses
- All validation errors include field-specific details
- Contact backend team for API issues
