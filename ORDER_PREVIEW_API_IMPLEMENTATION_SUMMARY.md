# Order Preview API - Implementation Summary

## What Was Created

A new API endpoint that allows users to preview their order details **without actually creating the order**. This API performs all the same validations and calculations as the order creation API but does not make any database changes.

---

## API Details

**Endpoint:** `POST /api/installments/orders/preview`

**Authentication:** Required (JWT Token)

**Purpose:** Preview order details including pricing, discounts, installment breakdown, and validation status before creating the actual order.

---

## Files Modified

### 1. Controller: `controllers/installmentOrderController.js`
- **Added:** `previewOrder` function (lines 913-1364)
- **Exports:** Added `previewOrder` to module.exports

### 2. Routes: `routes/installmentRoutes.js`
- **Added:** Route definition for `/orders/preview` (lines 156-177)
- **Middleware:** Uses `verifyToken` and `sanitizeInput`

### 3. Documentation:
- **Created:** `ORDER_PREVIEW_API_GUIDE.md` - Comprehensive API documentation
- **Created:** `ORDER_PREVIEW_API_IMPLEMENTATION_SUMMARY.md` - This file

---

## Key Features

### 1. Complete Validation
The API performs all the same validations as the order creation API:
- ✅ Product validation (exists, available, in stock)
- ✅ Variant validation (if applicable)
- ✅ Coupon validation (active, not expired, minimum order value, usage limit)
- ✅ Installment duration validation
- ✅ Daily amount validation (minimum ₹50)
- ✅ User validation

### 2. Accurate Calculations
The API uses the exact same calculation logic:
- ✅ Base pricing (pricePerUnit × quantity)
- ✅ Coupon discount calculation
- ✅ Daily amount calculation (handles INSTANT coupons correctly)
- ✅ Total payable amount
- ✅ Savings calculation
- ✅ Referral commission estimation

### 3. Comprehensive Response
The API returns detailed information:
- **Product details** (name, images, brand, category, variant)
- **Pricing breakdown** (original, discount, final, savings %)
- **Installment details** (total days, daily amount, free days)
- **Coupon benefits** (savings message, how it works)
- **Referrer commission** (if user was referred)
- **Order summary** (total, duration, estimated completion)
- **Validation status** (all validation checks)

### 4. No Database Changes
Unlike the order creation API:
- ❌ Does NOT create an order
- ❌ Does NOT create payment records
- ❌ Does NOT increment coupon usage count
- ❌ Does NOT deduct from wallet
- ❌ Does NOT create Razorpay order

### 5. Error Handling
Provides clear, actionable error messages:
- Missing required fields
- Invalid values
- Product not found or unavailable
- Variant not found or inactive
- Coupon issues (expired, invalid, usage limit)
- Invalid installment duration
- Daily amount too low

---

## Code Structure

The `previewOrder` function follows a clear, logical flow:

```
1. VALIDATION
   ↓
2. GET USER
   ↓
3. GET PRODUCT
   ↓
4. GET VARIANT & PRICE (if applicable)
   ↓
5. CALCULATE BASE PRICING
   ↓
6. APPLY COUPON (if provided)
   ↓
7. VALIDATE INSTALLMENT DURATION
   ↓
8. CALCULATE DAILY AMOUNT
   ↓
9. CALCULATE COUPON BENEFITS
   ↓
10. CALCULATE TOTAL PAYABLE
   ↓
11. GET REFERRER INFO (if applicable)
   ↓
12. BUILD PREVIEW RESPONSE
   ↓
13. RETURN SUCCESS RESPONSE
```

Each step includes proper error handling and returns appropriate error messages if validation fails.

---

## Request Example

```json
{
  "productId": "PROD-001",
  "variantId": "VAR-001",
  "quantity": 1,
  "totalDays": 100,
  "couponCode": "WELCOME50",
  "deliveryAddress": {
    "name": "John Doe",
    "phoneNumber": "+919876543210",
    "addressLine1": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "India"
  }
}
```

---

## Response Example

```json
{
  "success": true,
  "message": "Order preview generated successfully",
  "data": {
    "product": {
      "id": "PROD-001",
      "name": "Premium Gold Necklace",
      "description": "22K pure gold necklace",
      "images": ["url1", "url2"],
      "brand": "Goldify",
      "category": "Jewellery > Necklaces",
      "variant": { "variantId": "VAR-001", ... }
    },
    "pricing": {
      "pricePerUnit": 250000,
      "quantity": 1,
      "totalProductPrice": 250000,
      "originalPrice": 250000,
      "couponDiscount": 50000,
      "finalProductPrice": 200000,
      "savingsPercentage": 20
    },
    "installment": {
      "totalDays": 100,
      "dailyAmount": 2000,
      "totalPayableAmount": 200000,
      "totalSavings": 0,
      "freeDays": 0,
      "reducedDays": 100,
      "minimumDailyAmount": 50
    },
    "coupon": {
      "code": "WELCOME50",
      "type": "INSTANT",
      "description": "Flat ₹50,000 off",
      "discountAmount": 50000,
      "benefits": {
        "savingsMessage": "You will save ₹50000 instantly!",
        "howItWorksMessage": "The product price will be reduced from ₹250000 to ₹200000..."
      }
    },
    "deliveryAddress": { ... },
    "referrer": {
      "referrerName": "Jane Smith",
      "commissionPercentage": 10,
      "commissionPerPayment": 200,
      "totalCommissionEstimate": 20000
    },
    "summary": {
      "orderType": "INSTALLMENT",
      "status": "PREVIEW",
      "totalAmount": 200000,
      "dailyPayment": 2000,
      "duration": 100,
      "firstPaymentAmount": 2000,
      "estimatedCompletionDate": "2026-04-17T12:30:45.123Z"
    },
    "validation": {
      "isValid": true,
      "productAvailable": true,
      "durationValid": true,
      "dailyAmountValid": true,
      "couponValid": true
    }
  }
}
```

---

## Coupon Support

The API supports all three coupon types:

### 1. INSTANT Coupons
- Reduces product price immediately
- Recalculates daily amount based on discounted price
- Example: ₹250,000 - ₹50,000 = ₹200,000 ÷ 100 days = ₹2,000/day

### 2. REDUCE_DAYS Coupons
- Gives free days at the end
- Product price unchanged, but fewer payments required
- Example: 30 days plan, get 5 free days = pay only 25 days

### 3. MILESTONE_REWARD Coupons
- Rewards after completing X payments
- Shows milestone requirements and reward details
- Example: Pay 20 installments → get 5 free days

---

## Testing the API

### Using cURL:
```bash
curl -X POST "http://localhost:3000/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "totalDays": 50,
    "deliveryAddress": {
      "name": "Test User",
      "phoneNumber": "+919876543210",
      "addressLine1": "123 Test St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    }
  }'
```

### Using Postman:
1. Create new POST request
2. URL: `{{BASEURL}}/api/installments/orders/preview`
3. Headers:
   - `Authorization: Bearer <token>`
   - `Content-Type: application/json`
4. Body (JSON): See request example above
5. Send request

---

## Integration Flow

### Frontend Integration:

```javascript
// Step 1: User fills order form
const orderData = {
  productId: selectedProduct.id,
  variantId: selectedVariant?.id,
  quantity: selectedQuantity,
  totalDays: selectedDays,
  couponCode: enteredCoupon,
  deliveryAddress: userAddress
};

// Step 2: Preview order
const previewResponse = await fetch('/api/installments/orders/preview', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});

const preview = await previewResponse.json();

// Step 3: Show preview to user
if (preview.success) {
  displayOrderPreview(preview.data);

  // Step 4: If user confirms, create actual order
  if (userClicksConfirm()) {
    await createOrder({
      ...orderData,
      paymentMethod: 'RAZORPAY' // or 'WALLET'
    });
  }
} else {
  showError(preview.message);
}
```

---

## Benefits

### For Users:
- ✅ See exact pricing before committing
- ✅ Understand how coupons affect their order
- ✅ Know the daily payment amount upfront
- ✅ See referral commission details (if referred)
- ✅ Validate order before payment

### For Frontend Team:
- ✅ Same API structure as order creation
- ✅ Clear, detailed response
- ✅ Comprehensive error messages
- ✅ Easy to integrate
- ✅ Reduces order creation errors

### For Business:
- ✅ Improved user experience
- ✅ Reduced cart abandonment
- ✅ Better transparency
- ✅ Fewer support queries
- ✅ Higher conversion rates

---

## Code Quality

### Follows Existing Patterns:
- ✅ Same coding style as existing controllers
- ✅ Uses `asyncHandler` for error handling
- ✅ Uses `successResponse` for responses
- ✅ Follows project structure
- ✅ Includes proper logging

### Error Handling:
- ✅ Validates all inputs
- ✅ Returns descriptive error messages
- ✅ Uses appropriate HTTP status codes
- ✅ Handles edge cases

### Performance:
- ✅ No database writes
- ✅ Minimal database reads
- ✅ Fast response time
- ✅ No heavy computations

---

## Next Steps for Frontend Team

1. **Test the API** with different scenarios:
   - Without coupon
   - With INSTANT coupon
   - With REDUCE_DAYS coupon
   - With MILESTONE_REWARD coupon
   - With variant selection
   - With invalid data

2. **Build the preview UI** showing:
   - Product details
   - Pricing breakdown
   - Installment details
   - Coupon benefits (if applied)
   - Daily payment schedule
   - Total payable amount
   - Estimated completion date

3. **Add confirmation flow**:
   - Show preview
   - User reviews details
   - User clicks "Confirm Order"
   - Call actual order creation API

4. **Handle errors gracefully**:
   - Show validation errors
   - Guide user to fix issues
   - Retry with corrected data

---

## Related APIs

This API complements the existing order creation API:

| API | Purpose |
|-----|---------|
| `POST /api/installments/validate-coupon` | Validate coupon only |
| `POST /api/installments/orders/preview` | **Preview complete order** |
| `POST /api/installments/orders` | Create actual order |

**Recommended flow:**
1. User enters coupon → Call validate-coupon API (optional)
2. User fills form → Call preview API (required)
3. User confirms → Call create order API

---

## Support

For questions or issues:
- Check the detailed guide: `ORDER_PREVIEW_API_GUIDE.md`
- Review the controller code: `controllers/installmentOrderController.js`
- Review the route definition: `routes/installmentRoutes.js`

---

## Summary

✅ **Created:** Order Preview API endpoint
✅ **Performs:** All validations and calculations
✅ **Returns:** Complete order details
✅ **Does NOT:** Create any database records
✅ **Ready:** For frontend integration
✅ **Documented:** Comprehensive guide available

The API is fully functional, tested, and ready for use! 🎉
