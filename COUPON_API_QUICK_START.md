# Coupon Validation API - Quick Start Guide

## 🚀 Quick Summary

**API Endpoint:** `POST /api/installments/validate-coupon`

**Purpose:** Validate coupon codes and preview benefits BEFORE creating an order

**Authentication:** Not required (Public API)

---

## 📋 Minimum Request

```json
POST /api/installments/validate-coupon
Content-Type: application/json

{
  "couponCode": "SAVE20",
  "productId": "PROD12345",
  "totalDays": 100,
  "dailyAmount": 100
}
```

---

## ✅ Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "valid": true,
    "coupon": {
      "code": "SAVE20",
      "type": "INSTANT",
      "description": "Get 20% off",
      "expiryDate": "2025-12-31T23:59:59.999Z",
      "minOrderValue": 5000
    },
    "pricing": {
      "originalPrice": 10000,
      "discountAmount": 2000,
      "finalPrice": 8000,
      "savingsPercentage": 20,
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
      "savingsMessage": "You will save ₹2000 instantly!",
      "howItWorksMessage": "The product price will be reduced from ₹10000 to ₹8000. You will pay ₹80 per day for 100 days.",
      "totalSavings": 2000
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

## 🎯 Key Response Fields

### Display to User:
- `benefits.savingsMessage` - "You will save ₹2000 instantly!"
- `benefits.howItWorksMessage` - Detailed explanation
- `pricing.finalPrice` - Final price after discount
- `pricing.discountAmount` - Amount saved

### For UI Calculations:
- `pricing.originalPrice` - Original price
- `pricing.savingsPercentage` - Savings %
- `installment.freeDays` - Free days count
- `coupon.type` - INSTANT / REDUCE_DAYS / MILESTONE_REWARD

---

## 🔴 Error Responses

### Coupon Not Found (404)
```json
{
  "success": false,
  "message": "Coupon 'INVALID123' not found"
}
```

### Coupon Expired (400)
```json
{
  "success": false,
  "message": "Coupon 'OLD2024' has expired on Sun Dec 31 2024"
}
```

### Minimum Order Not Met (400)
```json
{
  "success": false,
  "message": "Minimum order value of ₹5000 is required for this coupon. Current order value: ₹3000"
}
```

---

## 🎨 Frontend Integration (React Example)

```javascript
async function validateCoupon(couponCode) {
  try {
    const response = await fetch('/api/installments/validate-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        couponCode,
        productId: selectedProduct.id,
        totalDays: 100,
        dailyAmount: 100,
        quantity: 1
      })
    });

    const data = await response.json();

    if (data.success) {
      // Show success
      setDiscount(data.data.pricing.discountAmount);
      setFinalPrice(data.data.pricing.finalPrice);
      setSavingsMessage(data.data.benefits.savingsMessage);
      setAppliedCoupon(couponCode);
    } else {
      // Show error
      alert(data.message);
    }
  } catch (error) {
    console.error('Failed to validate coupon:', error);
  }
}
```

---

## 📱 Mobile App Integration (Flutter Example)

```dart
Future<void> validateCoupon(String couponCode) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/api/installments/validate-coupon'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'couponCode': couponCode,
        'productId': selectedProduct.id,
        'totalDays': 100,
        'dailyAmount': 100,
        'quantity': 1,
      }),
    );

    final data = jsonDecode(response.body);

    if (data['success'] == true) {
      setState(() {
        appliedCoupon = data['data']['coupon']['code'];
        finalPrice = data['data']['pricing']['finalPrice'];
        savingsMessage = data['data']['benefits']['savingsMessage'];
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(savingsMessage)),
      );
    } else {
      // Show error
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Invalid Coupon'),
          content: Text(data['message']),
        ),
      );
    }
  } catch (e) {
    print('Error: $e');
  }
}
```

---

## 🎁 Coupon Types Explained

### 1. INSTANT
- Reduces product price immediately
- Example: ₹10,000 → ₹8,000
- Daily payment also reduced

### 2. REDUCE_DAYS
- Last X days become FREE
- Example: Pay for 90 days instead of 100
- Daily payment stays same

### 3. MILESTONE_REWARD
- Free days after X payments
- Example: Pay 20, get 5 FREE days
- Reward unlocked after milestone

---

## 📝 Optional Parameters

```json
{
  "couponCode": "SAVE20",      // Required
  "productId": "PROD12345",    // Required
  "totalDays": 100,            // Required
  "dailyAmount": 100,          // Required
  "variantId": "VAR001",       // Optional - for product variants
  "quantity": 2                // Optional - default: 1 (max: 10)
}
```

---

## ✨ Complete Flow

1. **User enters coupon code** in UI
2. **Frontend calls** `/api/installments/validate-coupon`
3. **API validates** and calculates benefits
4. **Frontend displays** savings message and new price
5. **User confirms** and proceeds to create order
6. **Frontend calls** `/api/installments/orders` with `couponCode`

---

## 🔗 Related Endpoints

- **Create Order with Coupon:** `POST /api/installments/orders`
  - Include `couponCode` in request body
  - Coupon will be automatically applied

---

## 📚 Full Documentation

For complete details, examples, and error handling:
👉 See [COUPON_VALIDATION_API_DOCS.md](./COUPON_VALIDATION_API_DOCS.md)

---

## 🧪 Testing

```bash
# Start server
npm start

# Test API
curl -X POST http://localhost:3000/api/installments/validate-coupon \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "SAVE20",
    "productId": "PROD001",
    "totalDays": 100,
    "dailyAmount": 100
  }'
```

Or use the provided test scripts:
```bash
node test-api-simple.js
node test-coupon-validation.js
```

---

## 💡 Tips

1. ✅ Always validate coupon BEFORE showing final price to user
2. ✅ Show `benefits.savingsMessage` prominently in UI
3. ✅ Display `benefits.howItWorksMessage` for transparency
4. ✅ Handle all error cases gracefully
5. ✅ For REDUCE_DAYS type, show "X FREE days!" badge
6. ✅ For MILESTONE type, show progress bar

---

**Last Updated:** December 2025
**Version:** 1.0
**Endpoint:** `/api/installments/validate-coupon`
