# Coupon Integration Guide - Installment Orders

## ✅ Coupon Support Added!

The installment order system now **fully supports discount coupons**. Users can apply coupon codes to get discounts on their orders.

---

## 🎯 How Coupons Work

### Coupon Types:
1. **Flat Discount**: Fixed amount off (e.g., ₹500 off)
2. **Percentage Discount**: Percentage off (e.g., 20% off)

### Discount Application:
- Discount is applied to **product price** (or variant price if variant selected)
- Daily installment amount is calculated from **discounted price**
- Original price is preserved for reference

**Example:**
```
Product Price: ₹120,000
Coupon: SAVE20 (20% off)
Discount: ₹24,000
Final Price: ₹96,000
Daily Amount (30 days): ₹3,200 (instead of ₹4,000)
```

---

## 📦 What Gets Stored in Order

When a user applies a coupon, the system stores:

### Order Fields:
```javascript
{
  orderId: "ORD-20241120-A3F2",
  productId: "64a1b2c3d4e5f6789012345",
  productName: "Premium Laptop",

  // Original pricing
  originalPrice: 120000,        // Price before discount

  // Coupon information
  couponCode: "SAVE20",          // Applied coupon code
  couponDiscount: 24000,         // Discount amount

  // Final pricing
  productPrice: 96000,           // Price after discount (this is what user pays)
  dailyPaymentAmount: 3200,      // Calculated from discounted price
  totalDays: 30
}
```

---

## 🔄 How It Works

### Step 1: User Enters Product Page
User sees:
- Product Price: ₹120,000
- "Have a coupon?" input field

### Step 2: User Enters Coupon Code
```
User types: "SAVE20"
```

### Step 3: Flutter Validates Coupon (Optional but Recommended)
Before creating order, validate the coupon:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/installment/validate-coupon'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'couponCode': 'SAVE20',
    'productPrice': 120000  // or variantPrice if variant selected
  }),
);

final data = jsonDecode(response.body);

if (data['success']) {
  // Show discount preview
  final discount = data['data']['coupon']['discountAmount'];
  final finalPrice = data['data']['coupon']['finalPrice'];

  print('Discount: ₹$discount');
  print('Final Price: ₹$finalPrice');
  // Show this to user before they create order
}
```

### Step 4: Create Order with Coupon
Include `couponCode` in order creation:

```dart
final response = await http.post(
  Uri.parse('$baseUrl/installment/orders'),
  body: jsonEncode({
    'productId': '64a1b2c3d4e5f6789012345',
    'couponCode': 'SAVE20',  // ✅ Add this
    'totalDays': 30,
    'paymentMethod': 'WALLET',
    'deliveryAddress': {...}
  }),
);
```

### Step 5: Backend Handles Everything
Backend automatically:
- ✅ Validates coupon exists and is active
- ✅ Checks coupon not expired
- ✅ Verifies minimum order value requirement
- ✅ Calculates discount amount
- ✅ Applies discount to product price
- ✅ Calculates daily amount from discounted price
- ✅ Stores coupon details in order

---

## 📱 API Endpoints

### 1. Validate Coupon (Optional - Recommended)

**POST** `/api/installment/validate-coupon`

**Purpose:** Preview discount before creating order

**Request Body:**
```json
{
  "couponCode": "SAVE20",
  "productPrice": 120000
}
```

**Success Response:**
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

**Error Responses:**

**Coupon Not Found:**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' not found"
}
```

**Coupon Expired:**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' has expired"
}
```

**Minimum Order Value Not Met:**
```json
{
  "success": false,
  "message": "Minimum order value of ₹50000 is required for this coupon",
  "minOrderValue": 50000
}
```

**Coupon Not Active:**
```json
{
  "success": false,
  "message": "Coupon 'SAVE20' is not active"
}
```

---

### 2. Create Order with Coupon

**POST** `/api/installment/orders`

**Request Body:**
```json
{
  "productId": "64a1b2c3d4e5f6789012345",
  "couponCode": "SAVE20",  // ← NEW OPTIONAL FIELD
  "variantId": "var_001",  // Optional - if product has variants
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

**Success Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "orderId": "ORD-20241120-A3F2",
      "productName": "Premium Laptop",
      "originalPrice": 120000,
      "couponCode": "SAVE20",
      "couponDiscount": 24000,
      "productPrice": 96000,
      "dailyPaymentAmount": 3200,
      "totalDays": 30,
      "totalPaidAmount": 3200,
      "remainingAmount": 92800,
      "status": "ACTIVE"
    }
  }
}
```

---

## 🎨 Flutter Implementation

### 1. Coupon Input Widget

```dart
class CouponInputWidget extends StatefulWidget {
  final double productPrice;
  final Function(Map<String, dynamic>?) onCouponApplied;

  CouponInputWidget({
    required this.productPrice,
    required this.onCouponApplied
  });

  @override
  _CouponInputWidgetState createState() => _CouponInputWidgetState();
}

class _CouponInputWidgetState extends State<CouponInputWidget> {
  final TextEditingController _couponController = TextEditingController();
  bool _isValidating = false;
  Map<String, dynamic>? _appliedCoupon;
  String? _errorMessage;

  Future<void> _validateCoupon() async {
    final couponCode = _couponController.text.trim();
    if (couponCode.isEmpty) return;

    setState(() {
      _isValidating = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/installment/validate-coupon'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'couponCode': couponCode,
          'productPrice': widget.productPrice,
        }),
      );

      final data = jsonDecode(response.body);

      if (data['success']) {
        setState(() {
          _appliedCoupon = data['data']['coupon'];
          _errorMessage = null;
        });
        widget.onCouponApplied(_appliedCoupon);
      } else {
        setState(() {
          _appliedCoupon = null;
          _errorMessage = data['message'];
        });
        widget.onCouponApplied(null);
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to validate coupon';
        _appliedCoupon = null;
      });
      widget.onCouponApplied(null);
    } finally {
      setState(() {
        _isValidating = false;
      });
    }
  }

  void _removeCoupon() {
    setState(() {
      _couponController.clear();
      _appliedCoupon = null;
      _errorMessage = null;
    });
    widget.onCouponApplied(null);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Have a coupon code?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 12),

            // Coupon input and apply button
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _couponController,
                    decoration: InputDecoration(
                      hintText: 'Enter coupon code',
                      border: OutlineInputBorder(),
                      errorText: _errorMessage,
                    ),
                    enabled: _appliedCoupon == null,
                  ),
                ),
                SizedBox(width: 8),
                _appliedCoupon == null
                    ? ElevatedButton(
                        onPressed: _isValidating ? null : _validateCoupon,
                        child: _isValidating
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text('Apply'),
                      )
                    : IconButton(
                        icon: Icon(Icons.close, color: Colors.red),
                        onPressed: _removeCoupon,
                      ),
              ],
            ),

            // Show discount if applied
            if (_appliedCoupon != null) ...[
              SizedBox(height: 12),
              Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Coupon "${_appliedCoupon!['code']}" applied!',
                            style: TextStyle(
                              color: Colors.green[900],
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            'You save ₹${_appliedCoupon!['discountAmount']}',
                            style: TextStyle(color: Colors.green[700]),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

### 2. Product Page with Coupon Support

```dart
class ProductPageWithCoupon extends StatefulWidget {
  final Map<String, dynamic> product;

  ProductPageWithCoupon({required this.product});

  @override
  _ProductPageWithCouponState createState() => _ProductPageWithCouponState();
}

class _ProductPageWithCouponState extends State<ProductPageWithCoupon> {
  Map<String, dynamic>? appliedCoupon;
  int totalDays = 30;

  double get productPrice {
    return widget.product['pricing']['finalPrice'].toDouble();
  }

  double get finalPrice {
    if (appliedCoupon != null) {
      return appliedCoupon!['finalPrice'].toDouble();
    }
    return productPrice;
  }

  double get dailyAmount {
    return finalPrice / totalDays;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.product['name'])),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product image and details...

            // Price display
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (appliedCoupon != null) ...[
                      Text(
                        'Original Price: ₹${productPrice.toStringAsFixed(0)}',
                        style: TextStyle(
                          decoration: TextDecoration.lineThrough,
                          color: Colors.grey,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Discount: -₹${appliedCoupon!['discountAmount']}',
                        style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                    ],
                    Text(
                      'Final Price: ₹${finalPrice.toStringAsFixed(0)}',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Pay ₹${dailyAmount.toStringAsFixed(0)}/day for $totalDays days',
                      style: TextStyle(fontSize: 16, color: Colors.blue),
                    ),
                  ],
                ),
              ),
            ),

            SizedBox(height: 16),

            // Coupon input widget
            CouponInputWidget(
              productPrice: productPrice,
              onCouponApplied: (coupon) {
                setState(() {
                  appliedCoupon = coupon;
                });
              },
            ),

            SizedBox(height: 16),

            // Days selector...

            SizedBox(height: 16),

            // Create order button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _createOrder,
                child: Text('Create Order'),
                style: ElevatedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createOrder() async {
    final requestBody = {
      'productId': widget.product['_id'],
      'totalDays': totalDays,
      'paymentMethod': 'WALLET',
      'deliveryAddress': {
        // ... address fields
      },
    };

    // Add coupon code if applied
    if (appliedCoupon != null) {
      requestBody['couponCode'] = appliedCoupon!['code'];
    }

    final response = await http.post(
      Uri.parse('$baseUrl/installment/orders'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(requestBody),
    );

    final data = jsonDecode(response.body);

    if (data['success']) {
      // Order created with coupon discount!
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OrderDetailsPage(orderId: data['data']['order']['orderId']),
        ),
      );
    }
  }
}
```

### 3. Display Coupon in Order Details

```dart
Widget buildOrderDetailsWithCoupon(Map<String, dynamic> order) {
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

          SizedBox(height: 12),

          // Show coupon details if coupon was applied
          if (order['couponCode'] != null) ...[
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.local_offer, color: Colors.green, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Coupon Applied: ${order['couponCode']}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.green[900],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text('Original Price: ₹${order['originalPrice']}'),
                  Text(
                    'Discount: -₹${order['couponDiscount']}',
                    style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            SizedBox(height: 12),
          ],

          Text('Final Price: ₹${order['productPrice']}'),
          Text('Daily: ₹${order['dailyPaymentAmount']}'),
          Text('Progress: ${order['paidInstallments']}/${order['totalDays']} days'),
        ],
      ),
    ),
  );
}
```

---

## ⚠️ Error Handling

### Common Errors:

**1. Coupon Not Found**
```dart
if (errorMessage.contains('not found')) {
  showError('Invalid coupon code. Please check and try again.');
}
```

**2. Coupon Expired**
```dart
if (errorMessage.contains('expired')) {
  showError('This coupon has expired.');
}
```

**3. Minimum Order Value Not Met**
```dart
if (errorMessage.contains('Minimum order value')) {
  // Extract minimum value from error message if available
  showError('Your order does not meet the minimum value for this coupon.');
}
```

**4. Coupon Not Active**
```dart
if (errorMessage.contains('not active')) {
  showError('This coupon is currently not available.');
}
```

---

## 🎯 Complete Flow Example

```
User: Opens product page (₹120,000)
    ↓
User: Enters coupon "SAVE20"
    ↓
Flutter: Calls /validate-coupon
    ↓
Backend: Validates and returns discount (₹24,000)
    ↓
Flutter: Shows "Final Price: ₹96,000"
         Shows "Daily: ₹3,200 for 30 days"
    ↓
User: Clicks "Create Order"
    ↓
Flutter: Calls /orders with couponCode: "SAVE20"
    ↓
Backend: Creates order with discount applied
    ↓
Order Created:
  - originalPrice: ₹120,000
  - couponDiscount: ₹24,000
  - productPrice: ₹96,000 (user pays this)
  - dailyAmount: ₹3,200
    ↓
✅ User saves ₹24,000!
```

---

## 📊 Key Points

### For Products WITHOUT Coupon:
```json
{
  "productId": "xxx",
  // couponCode: NOT NEEDED
  "totalDays": 30,
  "paymentMethod": "WALLET"
}
```
Backend uses regular product price.

### For Products WITH Coupon:
```json
{
  "productId": "xxx",
  "couponCode": "SAVE20",  // ✅ OPTIONAL
  "totalDays": 30,
  "paymentMethod": "WALLET"
}
```
Backend validates coupon and applies discount.

### Can Combine with Variants:
```json
{
  "productId": "xxx",
  "variantId": "var_001",   // ← Variant
  "couponCode": "SAVE20",   // ← Coupon
  "totalDays": 30,
  "paymentMethod": "WALLET"
}
```
Backend applies coupon discount to **variant price**.

---

## ✅ What Backend Validates

When coupon is provided:

1. ✅ Coupon exists in database
2. ✅ Coupon is active (`isActive: true`)
3. ✅ Coupon not expired (`expiryDate > now`)
4. ✅ Order meets minimum value requirement
5. ✅ Calculates correct discount (flat or percentage)
6. ✅ Ensures discount doesn't exceed product price
7. ✅ Applies discount before calculating daily amount
8. ✅ Stores coupon details in order

---

## 📝 Summary

| Field | Required | Description |
|-------|----------|-------------|
| `couponCode` | Optional | Coupon code to apply (e.g., "SAVE20") |
| `couponDiscount` | Auto | Backend calculates discount amount |
| `originalPrice` | Auto | Backend stores price before discount |
| `productPrice` | Auto | Backend stores price after discount |
| `dailyPaymentAmount` | Auto | Backend calculates from discounted price |

**Benefits:**
- ✅ Increase sales with discounts
- ✅ Track coupon usage per order
- ✅ Reduce daily installment amount
- ✅ Better user experience
- ✅ Marketing flexibility

---

**Status:** ✅ **FULLY IMPLEMENTED & READY**

Coupon support is production-ready! Flutter team can start using `couponCode` in order creation requests.

**Validation Endpoint:** `/api/installment/validate-coupon` (use this to preview discount before order creation)
