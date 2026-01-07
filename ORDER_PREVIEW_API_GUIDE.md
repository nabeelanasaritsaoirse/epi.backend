# Order Preview API - Complete Guide

## Overview

The Order Preview API allows frontend users to see exactly how their order will be structured **before** creating it. This API performs all the same validations and calculations as the order creation API but **does not create any order** in the database.

**Endpoint:** `POST /api/installments/orders/preview`
**Authentication:** Required (JWT Token)
**Method:** POST

---

## Use Case

When a user wants to:
- See the final price breakdown before confirming an order
- Understand how coupons affect their order
- Check if a product variant is available
- Validate installment duration and daily payment amounts
- Preview referral commission details

---

## Request Format

### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body

```json
{
  "productId": "string (required)",
  "variantId": "string (optional)",
  "quantity": 1,
  "totalDays": 30,
  "couponCode": "WELCOME50 (optional)",
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

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | ✅ Yes | Product ID (MongoDB _id or custom productId) |
| `variantId` | String | ❌ No | Product variant ID (if product has variants) |
| `quantity` | Number | ❌ No | Quantity (1-10), defaults to 1 |
| `totalDays` | Number | ✅ Yes | Total installment duration in days |
| `couponCode` | String | ❌ No | Coupon code to apply (e.g., "WELCOME50") |
| `deliveryAddress` | Object | ✅ Yes | Complete delivery address |

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Order preview generated successfully",
  "data": {
    "product": {
      "id": "PROD-001",
      "name": "Premium Gold Necklace",
      "description": "22K pure gold necklace with traditional design",
      "images": [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg"
      ],
      "brand": "Goldify",
      "category": "Jewellery > Necklaces",
      "variant": {
        "variantId": "VAR-001",
        "sku": "GOLD-NECK-22K-001",
        "attributes": {
          "weight": "50g",
          "purity": "22K"
        },
        "price": 250000
      }
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
      "description": "Flat ₹50,000 off on first purchase",
      "discountType": "flat",
      "discountValue": 50000,
      "discountAmount": 50000,
      "expiryDate": "2026-12-31T23:59:59.000Z",
      "benefits": {
        "savingsMessage": "You will save ₹50000 instantly!",
        "howItWorksMessage": "The product price will be reduced from ₹250000 to ₹200000. You will pay ₹2000 per day for 100 days."
      },
      "milestoneDetails": null
    },
    "deliveryAddress": {
      "name": "John Doe",
      "phoneNumber": "+919876543210",
      "addressLine1": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    },
    "referrer": {
      "referrerName": "Jane Smith",
      "referrerEmail": "jane@example.com",
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

## Response Field Descriptions

### Product Section
- **id**: Product identifier
- **name**: Product name
- **description**: Product description
- **images**: Array of product image URLs
- **brand**: Product brand name
- **category**: Product category path
- **variant**: Variant details (if selected)

### Pricing Section
- **pricePerUnit**: Price per unit of product
- **quantity**: Number of units ordered
- **totalProductPrice**: Total price (pricePerUnit × quantity)
- **originalPrice**: Original price before discount
- **couponDiscount**: Discount amount from coupon
- **finalProductPrice**: Final price after discount
- **savingsPercentage**: Percentage saved

### Installment Section
- **totalDays**: Total installment duration
- **dailyAmount**: Daily payment amount (₹)
- **totalPayableAmount**: Total amount to be paid (dailyAmount × totalDays)
- **totalSavings**: Total savings (if any)
- **freeDays**: Number of free days (REDUCE_DAYS coupon)
- **reducedDays**: Number of days to pay
- **minimumDailyAmount**: Minimum allowed daily amount (₹50)

### Coupon Section (if applied)
- **code**: Coupon code
- **type**: Coupon type (INSTANT, REDUCE_DAYS, MILESTONE_REWARD)
- **description**: Coupon description
- **discountType**: "flat" or "percentage"
- **discountValue**: Discount value
- **discountAmount**: Calculated discount amount
- **expiryDate**: Coupon expiry date
- **benefits.savingsMessage**: User-friendly savings message
- **benefits.howItWorksMessage**: Explanation of how coupon works
- **milestoneDetails**: Details for milestone coupons (if applicable)

### Referrer Section (if user was referred)
- **referrerName**: Name of referrer
- **referrerEmail**: Email of referrer
- **commissionPercentage**: Commission percentage (usually 10%)
- **commissionPerPayment**: Commission per installment payment
- **totalCommissionEstimate**: Total estimated commission

### Summary Section
- **orderType**: Always "INSTALLMENT"
- **status**: Always "PREVIEW"
- **totalAmount**: Final total amount
- **dailyPayment**: Daily payment amount
- **duration**: Duration in days
- **firstPaymentAmount**: First payment amount
- **estimatedCompletionDate**: Estimated order completion date

### Validation Section
- **isValid**: Overall validation status
- **productAvailable**: Product availability status
- **durationValid**: Installment duration validity
- **dailyAmountValid**: Daily amount meets minimum requirement
- **couponValid**: Coupon validation status (null if no coupon)

---

## Error Responses

### 400 Bad Request - Missing productId
```json
{
  "success": false,
  "message": "productId is required"
}
```

### 400 Bad Request - Invalid totalDays
```json
{
  "success": false,
  "message": "totalDays is required and must be a positive number"
}
```

### 400 Bad Request - Invalid quantity
```json
{
  "success": false,
  "message": "quantity must be between 1 and 10"
}
```

### 400 Bad Request - Missing deliveryAddress
```json
{
  "success": false,
  "message": "deliveryAddress is required"
}
```

### 404 Not Found - Product not found
```json
{
  "success": false,
  "message": "Product 'PROD-001' not found"
}
```

### 404 Not Found - Variant not found
```json
{
  "success": false,
  "message": "Variant 'VAR-001' not found for this product"
}
```

### 400 Bad Request - Product out of stock
```json
{
  "success": false,
  "message": "Product 'Premium Gold Necklace' is currently out of stock"
}
```

### 400 Bad Request - Variant not available
```json
{
  "success": false,
  "message": "Variant 'VAR-001' is not available"
}
```

### 404 Not Found - Coupon not found
```json
{
  "success": false,
  "message": "Coupon 'INVALID' not found or inactive"
}
```

### 400 Bad Request - Coupon expired
```json
{
  "success": false,
  "message": "Coupon 'WELCOME50' expired on Wed Dec 31 2025"
}
```

### 400 Bad Request - Minimum order value not met
```json
{
  "success": false,
  "message": "Minimum order value of ₹100000 required. Current order value: ₹50000"
}
```

### 400 Bad Request - Coupon usage limit reached
```json
{
  "success": false,
  "message": "Coupon usage limit reached"
}
```

### 400 Bad Request - Invalid installment duration
```json
{
  "success": false,
  "message": "Invalid installment duration. Must be between 30 and 365 days for product price ₹200000",
  "validRange": {
    "min": 30,
    "max": 365
  }
}
```

### 400 Bad Request - Daily amount too low
```json
{
  "success": false,
  "message": "Daily payment amount must be at least ₹50"
}
```

### 401 Unauthorized - No token
```json
{
  "success": false,
  "message": "No token provided"
}
```

### 401 Unauthorized - Invalid token
```json
{
  "success": false,
  "message": "Invalid token"
}
```

---

## Example Usage

### Example 1: Simple Order Preview (No Coupon)

**Request:**
```bash
curl -X POST "{{BASEURL}}/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "totalDays": 50,
    "quantity": 1,
    "deliveryAddress": {
      "name": "Rahul Kumar",
      "phoneNumber": "+919876543210",
      "addressLine1": "123 MG Road",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001",
      "country": "India"
    }
  }'
```

### Example 2: Order Preview with INSTANT Coupon

**Request:**
```bash
curl -X POST "{{BASEURL}}/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "totalDays": 100,
    "quantity": 1,
    "couponCode": "WELCOME50",
    "deliveryAddress": {
      "name": "Priya Sharma",
      "phoneNumber": "+919876543210",
      "addressLine1": "456 Park Street",
      "city": "Delhi",
      "state": "Delhi",
      "pincode": "110001",
      "country": "India"
    }
  }'
```

**Response highlights:**
- Original price: ₹250,000
- Coupon discount: ₹50,000
- Final price: ₹200,000
- Daily amount: ₹2,000 (recalculated based on discounted price)

### Example 3: Order Preview with REDUCE_DAYS Coupon

**Request:**
```bash
curl -X POST "{{BASEURL}}/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-002",
    "totalDays": 30,
    "quantity": 1,
    "couponCode": "FREEDAYS10",
    "deliveryAddress": {
      "name": "Amit Patel",
      "phoneNumber": "+919876543210",
      "addressLine1": "789 FC Road",
      "city": "Pune",
      "state": "Maharashtra",
      "pincode": "411016",
      "country": "India"
    }
  }'
```

**Response highlights:**
- Total days: 30
- Free days: 5
- Reduced days: 25 (you only pay for 25 days)
- Last 5 payments marked as FREE

### Example 4: Order Preview with Variant

**Request:**
```bash
curl -X POST "{{BASEURL}}/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "variantId": "VAR-002",
    "totalDays": 60,
    "quantity": 2,
    "deliveryAddress": {
      "name": "Sneha Gupta",
      "phoneNumber": "+919876543210",
      "addressLine1": "321 Sector 5",
      "city": "Noida",
      "state": "Uttar Pradesh",
      "pincode": "201301",
      "country": "India"
    }
  }'
```

### Example 5: Order Preview with MILESTONE_REWARD Coupon

**Request:**
```bash
curl -X POST "{{BASEURL}}/api/installments/orders/preview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-003",
    "totalDays": 100,
    "quantity": 1,
    "couponCode": "MILESTONE20",
    "deliveryAddress": {
      "name": "Vikram Singh",
      "phoneNumber": "+919876543210",
      "addressLine1": "555 Lake Road",
      "city": "Kolkata",
      "state": "West Bengal",
      "pincode": "700001",
      "country": "India"
    }
  }'
```

**Response highlights:**
- Milestone: Pay 20 installments
- Reward: Get 5 free days
- Message: "Complete 20 payments and get 5 FREE days (worth ₹10,000)!"

---

## Validation Flow

The API performs the following validations in order:

1. ✅ **Request validation**: productId, totalDays, quantity, deliveryAddress
2. ✅ **User validation**: User exists in database
3. ✅ **Product validation**: Product exists and is available
4. ✅ **Variant validation** (if variantId provided): Variant exists and is active
5. ✅ **Price validation**: Product has valid pricing
6. ✅ **Coupon validation** (if couponCode provided):
   - Coupon exists and is active
   - Coupon not expired
   - Minimum order value met
   - Usage limit not reached
7. ✅ **Duration validation**: totalDays within valid range for product price
8. ✅ **Daily amount validation**: Daily amount ≥ ₹50

If any validation fails, the API returns a **400 Bad Request** or **404 Not Found** with a descriptive error message.

---

## Key Features

### 1. Same Logic as Order Creation
- Uses the exact same validation and calculation logic as the order creation API
- Ensures consistency between preview and actual order

### 2. No Database Changes
- Does not create any order in the database
- Does not increment coupon usage count
- Does not create payment records

### 3. Complete Information
- Shows all pricing details
- Shows coupon benefits clearly
- Shows referral commission details
- Shows estimated completion date

### 4. Error Handling
- Clear, descriptive error messages
- Proper HTTP status codes
- Field-level validation errors

---

## Integration with Frontend

### Step 1: User fills order form
```javascript
// User selects product, variant, quantity, and totalDays
const orderData = {
  productId: selectedProduct.id,
  variantId: selectedVariant?.id,
  quantity: selectedQuantity,
  totalDays: selectedDays,
  couponCode: enteredCoupon,
  deliveryAddress: userAddress
};
```

### Step 2: Call preview API
```javascript
const response = await fetch(`${API_URL}/api/installments/orders/preview`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});

const result = await response.json();
```

### Step 3: Show preview to user
```javascript
if (result.success) {
  // Show order preview UI
  showOrderPreview(result.data);
} else {
  // Show error message
  showError(result.message);
}
```

### Step 4: User confirms and creates order
```javascript
// If user clicks "Confirm Order", call the actual order creation API
const createResponse = await fetch(`${API_URL}/api/installments/orders`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ...orderData,
    paymentMethod: 'RAZORPAY' // or 'WALLET'
  })
});
```

---

## Comparison: Preview vs Create Order API

| Feature | Preview API | Create Order API |
|---------|------------|------------------|
| **Endpoint** | `/api/installments/orders/preview` | `/api/installments/orders` |
| **Method** | POST | POST |
| **Authentication** | Required | Required |
| **Validation** | ✅ Same | ✅ Same |
| **Calculations** | ✅ Same | ✅ Same |
| **Creates Order** | ❌ No | ✅ Yes |
| **Creates Payment** | ❌ No | ✅ Yes |
| **Increments Coupon Usage** | ❌ No | ✅ Yes |
| **Requires paymentMethod** | ❌ No | ✅ Yes |
| **Returns Razorpay Order** | ❌ No | ✅ Yes (if Razorpay) |

---

## Best Practices

### 1. Always Preview Before Creating
```javascript
// ✅ Good: Preview first, then create
const preview = await previewOrder(data);
if (userConfirms(preview)) {
  await createOrder(data);
}

// ❌ Bad: Create directly without preview
await createOrder(data);
```

### 2. Show Clear Pricing Breakdown
```javascript
// Show all pricing details from preview response
const { pricing, installment, coupon } = preview.data;

console.log(`Original Price: ₹${pricing.originalPrice}`);
console.log(`Discount: -₹${pricing.couponDiscount}`);
console.log(`Final Price: ₹${pricing.finalProductPrice}`);
console.log(`Daily Payment: ₹${installment.dailyAmount} × ${installment.totalDays} days`);
console.log(`Total Payable: ₹${installment.totalPayableAmount}`);
```

### 3. Handle Errors Gracefully
```javascript
try {
  const preview = await previewOrder(data);
  showPreview(preview.data);
} catch (error) {
  if (error.status === 404) {
    showError('Product not found or unavailable');
  } else if (error.status === 400) {
    showError(error.message); // Show specific validation error
  } else {
    showError('Something went wrong. Please try again.');
  }
}
```

### 4. Validate on Frontend Too
```javascript
// Client-side validation before calling API
if (!productId || !totalDays || !deliveryAddress) {
  showError('Please fill all required fields');
  return;
}

if (totalDays < 1) {
  showError('Total days must be at least 1');
  return;
}

// Then call API
const preview = await previewOrder(data);
```

---

## Testing

### Test Case 1: Valid order without coupon
```bash
POST /api/installments/orders/preview
Body: { productId: "PROD-001", totalDays: 50, deliveryAddress: {...} }
Expected: 200 OK with complete preview
```

### Test Case 2: Valid order with INSTANT coupon
```bash
POST /api/installments/orders/preview
Body: { productId: "PROD-001", totalDays: 100, couponCode: "WELCOME50", deliveryAddress: {...} }
Expected: 200 OK with discounted pricing
```

### Test Case 3: Invalid product ID
```bash
POST /api/installments/orders/preview
Body: { productId: "INVALID", totalDays: 50, deliveryAddress: {...} }
Expected: 404 Not Found
```

### Test Case 4: Expired coupon
```bash
POST /api/installments/orders/preview
Body: { productId: "PROD-001", totalDays: 50, couponCode: "EXPIRED", deliveryAddress: {...} }
Expected: 400 Bad Request
```

### Test Case 5: Invalid duration
```bash
POST /api/installments/orders/preview
Body: { productId: "PROD-001", totalDays: 1, deliveryAddress: {...} }
Expected: 400 Bad Request (daily amount < ₹50)
```

---

## Summary

The Order Preview API is a powerful tool that:
- ✅ Shows exact order details before creation
- ✅ Validates all inputs thoroughly
- ✅ Calculates pricing and discounts accurately
- ✅ Provides clear error messages
- ✅ Improves user experience
- ✅ Reduces order creation errors

Use this API to give your users complete transparency and confidence before they commit to an order.
