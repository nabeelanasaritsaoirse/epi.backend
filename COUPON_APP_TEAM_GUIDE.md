# Coupon App Team Integration Guide

## Overview

This guide helps the mobile app (Flutter) and web frontend teams integrate the enhanced coupon system. The system now supports advanced features like usage tracking, restrictions, and personal codes.

**Base URL:** `/api/coupons` and `/api/installments`

---

## What's New for App Team

| Feature | User Impact |
|---------|-------------|
| Usage Limits | Coupon may show "Usage limit reached" error |
| Per-User Limit | User may see "You've already used this coupon" |
| First-Time User Only | New users get special coupons |
| Product/Category Specific | Some coupons only work for certain products |
| Payment Method Specific | Some coupons only work with Wallet or Razorpay |
| Win-Back Coupons | Inactive users get special welcome-back offers |
| Personal Codes | Users may receive unique codes assigned to them |
| Referral Coupons | Users can share their referral codes for commission |

---

## API Endpoints for App

### 1. Validate Coupon (Before Order)

**POST** `/api/installments/validate-coupon`

**Authentication:** Not required

Validate a coupon code and preview the discount before creating an order.

**Request:**

```json
{
  "couponCode": "SAVE20",
  "productId": "product_id",
  "totalDays": 100,
  "dailyAmount": 100,
  "variantId": "variant_id",
  "quantity": 1
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "coupon": {
      "code": "SAVE20",
      "type": "INSTANT",
      "description": "Get 20% off",
      "expiryDate": "2026-12-31T23:59:59.999Z",
      "minOrderValue": 5000
    },
    "pricing": {
      "originalPrice": 10000,
      "discountAmount": 2000,
      "finalPrice": 8000,
      "savingsPercentage": 20
    },
    "benefits": {
      "savingsMessage": "You will save Rs. 2000 instantly!",
      "howItWorksMessage": "The product price will be reduced from Rs. 10000 to Rs. 8000."
    }
  },
  "message": "Coupon is valid and can be applied"
}
```

---

### 2. Get User's Personal Coupons

**GET** `/api/coupons/user/my-coupons`

**Authentication:** Required (Bearer token)

Get all coupon codes assigned specifically to the logged-in user.

**Success Response:**

```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "coupon_id_1",
        "couponCode": "SAVE20-X7K9M2",
        "couponType": "INSTANT",
        "discountType": "percentage",
        "discountValue": 20,
        "maxDiscountAmount": 500,
        "minOrderValue": 1000,
        "expiryDate": "2026-12-31T00:00:00.000Z",
        "description": "Special 20% discount just for you!",
        "isPersonalCode": true,
        "currentUsageCount": 0,
        "maxUsageCount": 1
      },
      {
        "_id": "coupon_id_2",
        "couponCode": "BIRTHDAY100",
        "couponType": "INSTANT",
        "discountType": "flat",
        "discountValue": 100,
        "expiryDate": "2026-02-28T00:00:00.000Z",
        "description": "Birthday discount!",
        "isPersonalCode": true,
        "currentUsageCount": 0,
        "maxUsageCount": 1
      }
    ],
    "total": 2
  }
}
```

---

### 3. Get All Active Coupons (Public)

**GET** `/api/coupons/`

**Authentication:** Not required

Get all active public coupons that users can apply.

**Success Response:**

```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "coupon_id",
        "couponCode": "SAVE20",
        "couponType": "INSTANT",
        "discountType": "percentage",
        "discountValue": 20,
        "maxDiscountAmount": 500,
        "minOrderValue": 1000,
        "expiryDate": "2026-12-31T00:00:00.000Z",
        "description": "Get 20% off on all products",
        "applicableCategories": [],
        "firstTimeUserOnly": false
      }
    ]
  }
}
```

---

## Error Handling

### All Possible Coupon Errors

| Error Message | User-Friendly Message | Action |
|---------------|----------------------|--------|
| `Coupon 'XXX' not found` | "Invalid coupon code" | Check spelling |
| `Coupon 'XXX' is not active` | "This coupon is no longer available" | Remove coupon |
| `Coupon 'XXX' has expired` | "This coupon has expired" | Remove coupon |
| `Coupon usage limit reached` | "This coupon is no longer available" | Remove coupon |
| `You have already used this coupon the maximum allowed times` | "You've already used this coupon" | Remove coupon |
| `This coupon is only for first-time users` | "This coupon is for new users only" | Show alternative |
| `This coupon is not applicable for this product` | "This coupon doesn't work for this product" | Show which products work |
| `This coupon is not applicable for this product category` | "This coupon only works for [category] products" | Show category |
| `This coupon is only valid for WALLET payments` | "This coupon only works with Wallet payment" | Switch payment method |
| `This coupon is for users who haven't ordered in X days` | "This coupon is for inactive users" | N/A |
| `This coupon code is assigned to another user` | "This coupon is not valid for your account" | Remove coupon |
| `Minimum order value of Rs. X is required` | "Add Rs. Y more to use this coupon" | Show remaining amount |

---

## Flutter Implementation

### 1. Coupon Validation Service

```dart
class CouponService {
  final String baseUrl;
  final String? authToken;

  CouponService({required this.baseUrl, this.authToken});

  // Validate coupon before order
  Future<CouponValidationResult> validateCoupon({
    required String couponCode,
    required String productId,
    required int totalDays,
    required int dailyAmount,
    String? variantId,
    int quantity = 1,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/installments/validate-coupon'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'couponCode': couponCode,
          'productId': productId,
          'totalDays': totalDays,
          'dailyAmount': dailyAmount,
          'variantId': variantId,
          'quantity': quantity,
        }),
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return CouponValidationResult.success(data['data']);
      } else {
        return CouponValidationResult.error(data['message']);
      }
    } catch (e) {
      return CouponValidationResult.error('Failed to validate coupon');
    }
  }

  // Get user's personal coupons
  Future<List<Coupon>> getMyPersonalCoupons() async {
    if (authToken == null) return [];

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/coupons/user/my-coupons'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return (data['data']['coupons'] as List)
            .map((c) => Coupon.fromJson(c))
            .toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  // Get all public coupons
  Future<List<Coupon>> getPublicCoupons() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/coupons/'),
        headers: {'Content-Type': 'application/json'},
      );

      final data = jsonDecode(response.body);

      if (data['success'] == true) {
        return (data['data']['coupons'] as List)
            .map((c) => Coupon.fromJson(c))
            .toList();
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}

// Result classes
class CouponValidationResult {
  final bool isValid;
  final String? errorMessage;
  final Map<String, dynamic>? data;

  CouponValidationResult._({
    required this.isValid,
    this.errorMessage,
    this.data,
  });

  factory CouponValidationResult.success(Map<String, dynamic> data) {
    return CouponValidationResult._(isValid: true, data: data);
  }

  factory CouponValidationResult.error(String message) {
    return CouponValidationResult._(isValid: false, errorMessage: message);
  }
}

class Coupon {
  final String id;
  final String code;
  final String type;
  final String? discountType;
  final double? discountValue;
  final double? maxDiscountAmount;
  final double? minOrderValue;
  final DateTime expiryDate;
  final String? description;
  final bool isPersonalCode;
  final bool firstTimeUserOnly;
  final List<String> applicableCategories;

  Coupon({
    required this.id,
    required this.code,
    required this.type,
    this.discountType,
    this.discountValue,
    this.maxDiscountAmount,
    this.minOrderValue,
    required this.expiryDate,
    this.description,
    this.isPersonalCode = false,
    this.firstTimeUserOnly = false,
    this.applicableCategories = const [],
  });

  factory Coupon.fromJson(Map<String, dynamic> json) {
    return Coupon(
      id: json['_id'],
      code: json['couponCode'],
      type: json['couponType'],
      discountType: json['discountType'],
      discountValue: json['discountValue']?.toDouble(),
      maxDiscountAmount: json['maxDiscountAmount']?.toDouble(),
      minOrderValue: json['minOrderValue']?.toDouble(),
      expiryDate: DateTime.parse(json['expiryDate']),
      description: json['description'],
      isPersonalCode: json['isPersonalCode'] ?? false,
      firstTimeUserOnly: json['firstTimeUserOnly'] ?? false,
      applicableCategories: List<String>.from(json['applicableCategories'] ?? []),
    );
  }

  String get discountText {
    if (discountType == 'percentage') {
      if (maxDiscountAmount != null) {
        return '$discountValue% off (up to Rs. $maxDiscountAmount)';
      }
      return '$discountValue% off';
    } else if (discountType == 'flat') {
      return 'Rs. $discountValue off';
    }
    return description ?? '';
  }

  bool get isExpired => DateTime.now().isAfter(expiryDate);
}
```

### 2. Coupon Input Widget

```dart
class CouponInputWidget extends StatefulWidget {
  final String productId;
  final int totalDays;
  final int dailyAmount;
  final String? variantId;
  final Function(CouponValidationResult?) onCouponValidated;

  const CouponInputWidget({
    required this.productId,
    required this.totalDays,
    required this.dailyAmount,
    this.variantId,
    required this.onCouponValidated,
  });

  @override
  _CouponInputWidgetState createState() => _CouponInputWidgetState();
}

class _CouponInputWidgetState extends State<CouponInputWidget> {
  final _controller = TextEditingController();
  final _couponService = CouponService(baseUrl: AppConfig.baseUrl);

  bool _isLoading = false;
  CouponValidationResult? _result;

  Future<void> _validateCoupon() async {
    final code = _controller.text.trim();
    if (code.isEmpty) return;

    setState(() => _isLoading = true);

    final result = await _couponService.validateCoupon(
      couponCode: code,
      productId: widget.productId,
      totalDays: widget.totalDays,
      dailyAmount: widget.dailyAmount,
      variantId: widget.variantId,
    );

    setState(() {
      _isLoading = false;
      _result = result;
    });

    widget.onCouponValidated(result.isValid ? result : null);
  }

  void _removeCoupon() {
    setState(() {
      _controller.clear();
      _result = null;
    });
    widget.onCouponValidated(null);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Have a coupon code?',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 12),

            // Input row
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    decoration: InputDecoration(
                      hintText: 'Enter coupon code',
                      border: OutlineInputBorder(),
                      errorText: _result?.isValid == false
                          ? _getUserFriendlyError(_result!.errorMessage!)
                          : null,
                    ),
                    enabled: _result?.isValid != true,
                    textCapitalization: TextCapitalization.characters,
                  ),
                ),
                const SizedBox(width: 8),
                if (_result?.isValid == true)
                  IconButton(
                    icon: Icon(Icons.close, color: Colors.red),
                    onPressed: _removeCoupon,
                  )
                else
                  ElevatedButton(
                    onPressed: _isLoading ? null : _validateCoupon,
                    child: _isLoading
                        ? SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text('Apply'),
                  ),
              ],
            ),

            // Success message
            if (_result?.isValid == true) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Coupon applied!',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.green.shade900,
                            ),
                          ),
                          Text(
                            _result!.data!['benefits']['savingsMessage'],
                            style: TextStyle(color: Colors.green.shade700),
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

  String _getUserFriendlyError(String error) {
    if (error.contains('not found')) return 'Invalid coupon code';
    if (error.contains('expired')) return 'This coupon has expired';
    if (error.contains('usage limit reached')) return 'Coupon no longer available';
    if (error.contains('already used')) return "You've already used this coupon";
    if (error.contains('first-time')) return 'This coupon is for new users only';
    if (error.contains('not applicable for this product')) return "Doesn't work for this product";
    if (error.contains('not applicable for this product category')) return "Only works for specific categories";
    if (error.contains('only valid for WALLET')) return 'Only works with Wallet payment';
    if (error.contains('only valid for RAZORPAY')) return 'Only works with Razorpay payment';
    if (error.contains('assigned to another user')) return 'Not valid for your account';
    if (error.contains('Minimum order value')) return error;
    return error;
  }
}
```

### 3. My Coupons Page

```dart
class MyCouponsPage extends StatefulWidget {
  @override
  _MyCouponsPageState createState() => _MyCouponsPageState();
}

class _MyCouponsPageState extends State<MyCouponsPage> {
  final _couponService = CouponService(
    baseUrl: AppConfig.baseUrl,
    authToken: AuthService.currentToken,
  );

  List<Coupon> _personalCoupons = [];
  List<Coupon> _publicCoupons = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCoupons();
  }

  Future<void> _loadCoupons() async {
    setState(() => _isLoading = true);

    final results = await Future.wait([
      _couponService.getMyPersonalCoupons(),
      _couponService.getPublicCoupons(),
    ]);

    setState(() {
      _personalCoupons = results[0];
      _publicCoupons = results[1];
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _loadCoupons,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Personal coupons section
          if (_personalCoupons.isNotEmpty) ...[
            Text(
              'Your Personal Coupons',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'These coupons are exclusively for you!',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 12),
            ..._personalCoupons.map((c) => _buildCouponCard(c, isPersonal: true)),
            const SizedBox(height: 24),
          ],

          // Public coupons section
          Text(
            'Available Coupons',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          ..._publicCoupons.map((c) => _buildCouponCard(c, isPersonal: false)),

          if (_personalCoupons.isEmpty && _publicCoupons.isEmpty)
            Center(
              child: Text('No coupons available right now'),
            ),
        ],
      ),
    );
  }

  Widget _buildCouponCard(Coupon coupon, {required bool isPersonal}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Coupon code badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isPersonal ? Colors.purple.shade100 : Colors.blue.shade100,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: isPersonal ? Colors.purple : Colors.blue,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Text(
                    coupon.code,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isPersonal ? Colors.purple.shade900 : Colors.blue.shade900,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                const Spacer(),
                if (isPersonal)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.purple,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'FOR YOU',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Discount text
            Text(
              coupon.discountText,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),

            if (coupon.description != null) ...[
              const SizedBox(height: 4),
              Text(coupon.description!, style: TextStyle(color: Colors.grey)),
            ],

            const SizedBox(height: 8),

            // Restrictions
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (coupon.minOrderValue != null && coupon.minOrderValue! > 0)
                  _buildTag('Min. Rs. ${coupon.minOrderValue!.toInt()}'),
                if (coupon.firstTimeUserOnly)
                  _buildTag('New users only', color: Colors.orange),
                if (coupon.applicableCategories.isNotEmpty)
                  _buildTag(coupon.applicableCategories.join(', ')),
              ],
            ),

            const SizedBox(height: 8),

            // Expiry
            Row(
              children: [
                Icon(Icons.timer_outlined, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  'Expires: ${_formatDate(coupon.expiryDate)}',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Copy button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: coupon.code));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Coupon code copied!')),
                  );
                },
                icon: Icon(Icons.copy),
                label: Text('Copy Code'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTag(String text, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: (color ?? Colors.grey).withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 12, color: color ?? Colors.grey.shade700),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
```

---

## UI Recommendations

### 1. Coupon Application Flow

```
1. User enters coupon code
   └── Show loading indicator

2. API validates coupon
   ├── Success: Show green success message with savings
   │   └── "You will save Rs. 2000 instantly!"
   │
   └── Error: Show specific error message
       ├── "Invalid coupon code" → Clear input
       ├── "Coupon has expired" → Clear input
       ├── "Only works with Wallet payment" → Suggest switching
       └── "Add Rs. 500 more to use" → Show remaining amount
```

### 2. Display Restrictions

Show coupon restrictions clearly before users try to apply:

```
┌─────────────────────────────────┐
│  SAVE20                         │
│  ─────────────────────────────  │
│  20% off (up to Rs. 500)        │
│                                 │
│  [New Users] [Min Rs.1000]      │
│  [Gold Category Only]           │
│                                 │
│  Expires: 31 Dec 2026           │
│                                 │
│  [   Copy Code   ]              │
└─────────────────────────────────┘
```

### 3. Personal Coupon Highlight

Make personal coupons stand out:

```
┌─────────────────────────────────┐
│  ★ EXCLUSIVE FOR YOU ★          │
│  ─────────────────────────────  │
│  JOHN-BDAY100                   │
│  Rs. 100 off your next order    │
│                                 │
│  [   Apply Now   ]              │
└─────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Validate coupon with valid code
- [ ] Validate coupon with invalid code
- [ ] Validate expired coupon
- [ ] Validate coupon with usage limit reached
- [ ] Validate first-time user coupon (as existing user)
- [ ] Validate product-specific coupon (wrong product)
- [ ] Validate category-specific coupon (wrong category)
- [ ] Validate payment-specific coupon (wrong method)
- [ ] Validate personal code (not assigned to user)
- [ ] Validate personal code (assigned to user)
- [ ] Get user's personal coupons
- [ ] Get public coupons
- [ ] Create order with valid coupon
- [ ] Handle all error states gracefully

---

**Last Updated:** January 2026
**Version:** 2.0
