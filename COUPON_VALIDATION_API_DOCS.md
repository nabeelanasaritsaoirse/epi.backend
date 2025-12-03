# Coupon Validation API Documentation

## Overview
This API allows users to validate coupon codes and preview the benefits they will receive **before creating an order**. It provides detailed information about discounts, free days, and pricing calculations for installment-based orders.

---

## API Endpoint

### **POST** `/api/installments/validate-coupon`

**Authentication:** Not required (Public)

**Description:** Validates a coupon code and returns detailed benefit information including pricing breakdown, discount amount, free days, and how the coupon will be applied.

---

## Request Body

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `couponCode` | string | The coupon code to validate (case-insensitive) | `"SAVE20"` |
| `productId` | string | Product ID (MongoDB ObjectId or custom productId) | `"PROD12345"` |
| `totalDays` | number | Total number of installment days | `100` |
| `dailyAmount` | number | Daily installment amount in ₹ | `100` |

### Optional Fields

| Field | Type | Description | Default | Example |
|-------|------|-------------|---------|---------|
| `variantId` | string | Product variant ID (if product has variants) | `null` | `"VAR001"` |
| `quantity` | number | Product quantity (1-10) | `1` | `2` |

---

## Request Examples

### Example 1: INSTANT Coupon (Flat Discount)
```json
POST /api/installments/validate-coupon
Content-Type: application/json

{
  "couponCode": "SAVE1000",
  "productId": "PROD12345",
  "quantity": 1,
  "totalDays": 100,
  "dailyAmount": 100
}
```

### Example 2: REDUCE_DAYS Coupon (Free Days)
```json
POST /api/installments/validate-coupon
Content-Type: application/json

{
  "couponCode": "FREEDAYS10",
  "productId": "PROD12345",
  "variantId": "VAR001",
  "quantity": 2,
  "totalDays": 100,
  "dailyAmount": 150
}
```

### Example 3: MILESTONE_REWARD Coupon
```json
POST /api/installments/validate-coupon
Content-Type: application/json

{
  "couponCode": "MILESTONE20",
  "productId": "PROD12345",
  "totalDays": 100,
  "dailyAmount": 100
}
```

---

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "valid": true,
    "coupon": {
      "code": "SAVE1000",
      "type": "INSTANT",
      "description": "Get ₹1000 instant discount",
      "expiryDate": "2025-12-31T23:59:59.999Z",
      "minOrderValue": 5000
    },
    "pricing": {
      "originalPrice": 10000,
      "discountAmount": 1000,
      "finalPrice": 9000,
      "savingsPercentage": 10,
      "pricePerUnit": 10000,
      "quantity": 1
    },
    "installment": {
      "totalDays": 100,
      "dailyAmount": 100,
      "freeDays": 0,
      "reducedDays": 0
    },
    "benefits": {
      "savingsMessage": "You will save ₹1000 instantly!",
      "howItWorksMessage": "The product price will be reduced from ₹10000 to ₹9000. You will pay ₹90 per day for 100 days.",
      "totalSavings": 1000
    },
    "milestoneDetails": null,
    "product": {
      "id": "PROD12345",
      "name": "Gold Coin 10g",
      "variant": null
    }
  },
  "message": "Coupon is valid and can be applied"
}
```

---

## Response Fields Explained

### `coupon` Object
| Field | Type | Description |
|-------|------|-------------|
| `code` | string | Coupon code (uppercase) |
| `type` | string | Coupon type: `INSTANT`, `REDUCE_DAYS`, or `MILESTONE_REWARD` |
| `description` | string | Human-readable coupon description |
| `expiryDate` | ISO date | When the coupon expires |
| `minOrderValue` | number | Minimum order value required to use this coupon |

### `pricing` Object
| Field | Type | Description |
|-------|------|-------------|
| `originalPrice` | number | Original product price (before discount) |
| `discountAmount` | number | Discount amount in ₹ |
| `finalPrice` | number | Final price after applying coupon |
| `savingsPercentage` | number | Percentage savings (0-100) |
| `pricePerUnit` | number | Price per single unit |
| `quantity` | number | Number of units |

### `installment` Object
| Field | Type | Description |
|-------|------|-------------|
| `totalDays` | number | Total installment days |
| `dailyAmount` | number | Daily payment amount |
| `freeDays` | number | Number of free days (for REDUCE_DAYS and MILESTONE_REWARD) |
| `reducedDays` | number | Actual paying days (for REDUCE_DAYS only) |

### `benefits` Object
| Field | Type | Description |
|-------|------|-------------|
| `savingsMessage` | string | Short message about savings |
| `howItWorksMessage` | string | Detailed explanation of how the coupon works |
| `totalSavings` | number | Total savings amount in ₹ |

### `milestoneDetails` Object (only for MILESTONE_REWARD type)
| Field | Type | Description |
|-------|------|-------------|
| `paymentsRequired` | number | Number of payments required to unlock reward |
| `freeDaysReward` | number | Free days awarded after milestone |
| `milestoneValue` | number | Monetary value of free days |

### `product` Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Product ID |
| `name` | string | Product name |
| `variant` | object/null | Variant details (if applicable) |

---

## Coupon Types & Examples

### 1️⃣ INSTANT Coupon
**How it works:** Reduces the product price immediately.

**Example Response:**
```json
{
  "coupon": { "type": "INSTANT" },
  "pricing": {
    "originalPrice": 10000,
    "discountAmount": 1000,
    "finalPrice": 9000
  },
  "installment": {
    "totalDays": 100,
    "dailyAmount": 100,
    "freeDays": 0
  },
  "benefits": {
    "savingsMessage": "You will save ₹1000 instantly!",
    "howItWorksMessage": "The product price will be reduced from ₹10000 to ₹9000. You will pay ₹90 per day for 100 days."
  }
}
```

**What user gets:**
- Product price: ₹10,000 → ₹9,000
- Daily payment: ₹100 → ₹90
- Total days: 100 (unchanged)

---

### 2️⃣ REDUCE_DAYS Coupon
**How it works:** Converts discount amount into FREE installment days at the end.

**Example Response:**
```json
{
  "coupon": { "type": "REDUCE_DAYS" },
  "pricing": {
    "originalPrice": 10000,
    "discountAmount": 1000,
    "finalPrice": 10000
  },
  "installment": {
    "totalDays": 100,
    "dailyAmount": 100,
    "freeDays": 10,
    "reducedDays": 90
  },
  "benefits": {
    "savingsMessage": "You will get 10 FREE days! Pay for only 90 days instead of 100 days.",
    "howItWorksMessage": "Your last 10 installment payment(s) will be marked as FREE. You pay ₹100/day for 90 days, and get 10 days free (worth ₹1000)."
  }
}
```

**What user gets:**
- Product price: ₹10,000 (unchanged)
- Daily payment: ₹100 (unchanged)
- Pay for: 90 days only
- Free days: Last 10 days FREE (worth ₹1,000)

---

### 3️⃣ MILESTONE_REWARD Coupon
**How it works:** Unlocks FREE days after completing a specific number of payments.

**Example Response:**
```json
{
  "coupon": { "type": "MILESTONE_REWARD" },
  "pricing": {
    "originalPrice": 10000,
    "finalPrice": 10000
  },
  "installment": {
    "totalDays": 100,
    "dailyAmount": 100,
    "freeDays": 5
  },
  "benefits": {
    "savingsMessage": "Complete 20 payments and get 5 FREE days (worth ₹500)!",
    "howItWorksMessage": "After you successfully pay 20 installments, you will receive 5 free day(s) as a reward. The total reward value is ₹500."
  },
  "milestoneDetails": {
    "paymentsRequired": 20,
    "freeDaysReward": 5,
    "milestoneValue": 500
  }
}
```

**What user gets:**
- Product price: ₹10,000 (unchanged)
- Daily payment: ₹100 (unchanged)
- After 20 payments: Get 5 FREE days (worth ₹500)

---

## Error Responses

### 400 Bad Request - Missing Required Fields
```json
{
  "success": false,
  "message": "productId, totalDays, and dailyAmount are required"
}
```

### 400 Bad Request - Invalid Quantity
```json
{
  "success": false,
  "message": "quantity must be between 1 and 10"
}
```

### 404 Not Found - Coupon Not Found
```json
{
  "success": false,
  "message": "Coupon 'INVALID123' not found"
}
```

### 400 Bad Request - Coupon Not Active
```json
{
  "success": false,
  "message": "Coupon 'EXPIRED20' is not active"
}
```

### 400 Bad Request - Coupon Expired
```json
{
  "success": false,
  "message": "Coupon 'OLD2024' has expired on Sun Dec 31 2024"
}
```

### 400 Bad Request - Minimum Order Value Not Met
```json
{
  "success": false,
  "message": "Minimum order value of ₹5000 is required for this coupon. Current order value: ₹3000"
}
```

### 400 Bad Request - Usage Limit Reached
```json
{
  "success": false,
  "message": "Coupon usage limit reached"
}
```

### 404 Not Found - Product Not Found
```json
{
  "success": false,
  "message": "Product 'INVALID_PROD' not found"
}
```

### 404 Not Found - Variant Not Found
```json
{
  "success": false,
  "message": "Variant 'VAR999' not found for this product"
}
```

### 400 Bad Request - Variant Not Available
```json
{
  "success": false,
  "message": "Variant 'VAR001' is not available"
}
```

---

## Integration Guide

### Frontend Integration (React/Flutter)

#### Step 1: User enters coupon code
```javascript
// User inputs
const couponCode = "SAVE1000";
const productId = "PROD12345";
const totalDays = 100;
const dailyAmount = 100;
```

#### Step 2: Call validation API
```javascript
const response = await fetch('https://api.example.com/api/installments/validate-coupon', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    couponCode,
    productId,
    totalDays,
    dailyAmount,
    quantity: 1
  })
});

const data = await response.json();
```

#### Step 3: Handle response
```javascript
if (data.success) {
  // Show benefits to user
  console.log(data.data.benefits.savingsMessage);
  // "You will save ₹1000 instantly!"

  console.log(data.data.pricing.finalPrice);
  // 9000

  // Update UI with new pricing
  setOriginalPrice(data.data.pricing.originalPrice);
  setFinalPrice(data.data.pricing.finalPrice);
  setDiscount(data.data.pricing.discountAmount);

  // Allow user to proceed with order creation
  setAppliedCoupon(couponCode);
} else {
  // Show error message
  alert(data.message);
}
```

#### Step 4: Create order with coupon
```javascript
// When user confirms, create order with the validated coupon
const orderResponse = await fetch('https://api.example.com/api/installments/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    productId,
    couponCode, // ← Include validated coupon
    totalDays,
    dailyAmount,
    paymentMethod: 'RAZORPAY',
    deliveryAddress: {...}
  })
});
```

---

### Mobile App Integration (Flutter)

```dart
Future<Map<String, dynamic>?> validateCoupon({
  required String couponCode,
  required String productId,
  required int totalDays,
  required int dailyAmount,
  String? variantId,
  int quantity = 1,
}) async {
  try {
    final response = await http.post(
      Uri.parse('https://api.example.com/api/installments/validate-coupon'),
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

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['success'] == true) {
        return data['data'];
      }
    }

    // Handle error
    final error = jsonDecode(response.body);
    throw Exception(error['message']);

  } catch (e) {
    print('Error validating coupon: $e');
    return null;
  }
}

// Usage
void applyCoupon() async {
  final result = await validateCoupon(
    couponCode: _couponController.text,
    productId: widget.productId,
    totalDays: 100,
    dailyAmount: 100,
  );

  if (result != null) {
    setState(() {
      _appliedCoupon = result['coupon']['code'];
      _finalPrice = result['pricing']['finalPrice'];
      _discount = result['pricing']['discountAmount'];
      _savingsMessage = result['benefits']['savingsMessage'];
    });

    // Show success message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['benefits']['savingsMessage'])),
    );
  }
}
```

---

## UI/UX Recommendations

### 1. Show Savings Clearly
```
┌─────────────────────────────────┐
│  Original Price:     ₹10,000    │
│  Discount (SAVE20):  - ₹1,000   │
│  ─────────────────────────────  │
│  Final Price:        ₹9,000 ✓   │
│                                  │
│  💰 You save ₹1,000 (10%)!      │
└─────────────────────────────────┘
```

### 2. Explain How It Works
Display `benefits.howItWorksMessage` to help users understand:
```
ℹ️ How it works:
The product price will be reduced from ₹10,000 to ₹9,000.
You will pay ₹90 per day for 100 days.
```

### 3. For REDUCE_DAYS Coupons
```
🎁 Special Offer!
Pay for only 90 days instead of 100 days.
Your last 10 days are FREE (worth ₹1,000)
```

### 4. For MILESTONE_REWARD Coupons
```
🏆 Milestone Reward!
Complete 20 payments → Get 5 FREE days (₹500 value)
Progress: ████░░░░░░ 8/20 payments
```

---

## Testing the API

### Using cURL

```bash
# Test INSTANT coupon
curl -X POST http://localhost:5000/api/installments/validate-coupon \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "SAVE1000",
    "productId": "PROD12345",
    "totalDays": 100,
    "dailyAmount": 100
  }'

# Test with variant
curl -X POST http://localhost:5000/api/installments/validate-coupon \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "FREEDAYS10",
    "productId": "PROD12345",
    "variantId": "VAR001",
    "quantity": 2,
    "totalDays": 100,
    "dailyAmount": 150
  }'
```

### Using Postman
1. Create new POST request
2. URL: `{{BASE_URL}}/api/installments/validate-coupon`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "couponCode": "SAVE1000",
  "productId": "PROD12345",
  "totalDays": 100,
  "dailyAmount": 100
}
```

---

## Common Use Cases

### Use Case 1: Product Page with Coupon Input
```
User Flow:
1. User views product (₹10,000)
2. User enters coupon code "SAVE20"
3. Frontend calls /validate-coupon
4. Display: "You save ₹2,000! Final price: ₹8,000"
5. User clicks "Buy Now" → Creates order with coupon
```

### Use Case 2: Checkout Page with Applied Coupon
```
User Flow:
1. User adds product to cart
2. At checkout, enters coupon
3. Call /validate-coupon
4. Show pricing breakdown
5. User confirms order with applied discount
```

### Use Case 3: Coupon List Page
```
User Flow:
1. Display all available coupons
2. User clicks "Apply" on a coupon
3. Validate coupon for selected product
4. Show preview of benefits
5. User proceeds to create order
```

---

## Important Notes

1. **No Authentication Required**: This is a public API for previewing coupon benefits
2. **Real-time Validation**: Always check coupon validity before order creation
3. **Expiry Handling**: Show clear expiry date to users
4. **Minimum Order Value**: Display requirement clearly if not met
5. **Product Variants**: Support variant-specific pricing
6. **Quantity Calculation**: Price calculated as `pricePerUnit × quantity`
7. **Coupon Types**: Handle all three types (INSTANT, REDUCE_DAYS, MILESTONE_REWARD) in UI

---

## Support

For questions or issues:
- Backend Team: Create issue in repository
- API Testing: Use Postman collection provided
- Integration Help: Refer to examples in this documentation

---

**Last Updated:** December 2025
**API Version:** 1.0
**Base URL:** `/api/installments`
