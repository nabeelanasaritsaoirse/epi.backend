# Cart API Documentation for Installment Orders

## Overview
This document provides complete API documentation for the shopping cart system that supports installment-based purchases with product variants and customizable payment plans.

**Last Updated:** December 2025
**API Version:** 1.0
**Base URL:** `/api/cart`

---

## Table of Contents
1. [Cart System Features](#cart-system-features)
2. [API Endpoints](#api-endpoints)
3. [Data Models](#data-models)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Integration Guide](#integration-guide)

---

## Cart System Features

### ✅ **What's Supported:**

1. **Multiple Products in Cart**
   - Add different products to cart
   - Each with different quantities

2. **Product Variants Support**
   - Select specific product variants (size, color, weight, etc.)
   - Variant details saved in cart

3. **Installment Plan Selection**
   - User selects installment plan when adding to cart
   - Different products can have different plans
   - Same product with different plans = separate cart entries

4. **Dynamic Pricing**
   - Always fetches latest price from product
   - Supports variant-specific pricing

5. **Flexible Cart Management**
   - Add, update, remove products
   - Update quantities
   - Update installment plans
   - Clear entire cart

---

## API Endpoints

### 1. Get Cart
**GET** `/api/cart`

Get user's cart with all products, variants, and installment plans.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "Cart fetched successfully",
  "data": {
    "products": [
      {
        "productId": "64abc123...",
        "name": "Gold Coin 10g",
        "brand": "Malabar Gold",
        "price": 50000,
        "finalPrice": 48000,
        "discount": 4,
        "images": ["url1", "url2"],
        "stock": 100,
        "isActive": true,
        "quantity": 2,
        "variant": {
          "variantId": "VAR001",
          "sku": "GOLD-10G-24K",
          "attributes": {
            "weight": "10g",
            "purity": "24K"
          },
          "description": "24 Karat Gold Coin"
        },
        "installmentPlan": {
          "totalDays": 100,
          "dailyAmount": 100,
          "totalAmount": 10000
        },
        "addedAt": "2025-12-01T10:00:00.000Z",
        "updatedAt": "2025-12-01T10:00:00.000Z",
        "itemTotal": 96000
      }
    ],
    "totalItems": 2,
    "totalPrice": 96000,
    "subtotal": 96000
  }
}
```

---

### 2. Get Cart Item Count
**GET** `/api/cart/count`

Get total number of items in cart (for badge display).

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

### 3. Add Product to Cart
**POST** `/api/cart/add/:productId`

Add product to cart with installment plan and optional variant.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| productId | string | MongoDB ObjectId of the product |

**Request Body:**
```json
{
  "quantity": 2,
  "variantId": "VAR001",
  "totalDays": 100,
  "dailyAmount": 100
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| quantity | number | No | Quantity (1-10), default: 1 |
| variantId | string | No | Product variant ID (if applicable) |
| totalDays | number | **Yes** | Total installment days (min: 5) |
| dailyAmount | number | **Yes** | Daily payment amount (min: ₹50) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Product added to cart successfully",
  "data": {
    "cartItemCount": 5,
    "cartItems": 3
  }
}
```

**Error Responses:**

400 - Invalid Quantity:
```json
{
  "success": false,
  "message": "Quantity must be between 1 and 10"
}
```

400 - Missing Installment Plan:
```json
{
  "success": false,
  "message": "totalDays is required and must be at least 5"
}
```

404 - Product Not Found:
```json
{
  "success": false,
  "message": "Product not found"
}
```

404 - Variant Not Found:
```json
{
  "success": false,
  "message": "Variant 'VAR001' not found for this product"
}
```

400 - Out of Stock:
```json
{
  "success": false,
  "message": "Only 3 items available in stock"
}
```

---

### 4. Update Product Quantity
**PUT** `/api/cart/update/:productId`

Update quantity for a product in cart.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| productId | string | MongoDB ObjectId of the product |

**Request Body:**
```json
{
  "quantity": 5
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Cart updated successfully",
  "data": {
    "cartItemCount": 8
  }
}
```

**Error Responses:**

400 - Invalid Quantity:
```json
{
  "success": false,
  "message": "Quantity must be at least 1"
}
```

400 - Stock Limit:
```json
{
  "success": false,
  "message": "Only 3 items available in stock"
}
```

404 - Product Not in Cart:
```json
{
  "success": false,
  "message": "Product not in cart"
}
```

---

### 5. Update Installment Plan
**PUT** `/api/cart/update-plan`

Update installment plan for a specific cart item.

**Authentication:** Required

**Request Body:**
```json
{
  "productId": "64abc123...",
  "variantId": "VAR001",
  "oldPlan": {
    "totalDays": 100,
    "dailyAmount": 100
  },
  "newPlan": {
    "totalDays": 50,
    "dailyAmount": 200
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| productId | string | **Yes** | Product ObjectId |
| variantId | string | No | Variant ID (null if no variant) |
| oldPlan | object | **Yes** | Current plan (to identify cart item) |
| oldPlan.totalDays | number | **Yes** | Current total days |
| oldPlan.dailyAmount | number | **Yes** | Current daily amount |
| newPlan | object | **Yes** | New plan to apply |
| newPlan.totalDays | number | **Yes** | New total days (min: 5) |
| newPlan.dailyAmount | number | **Yes** | New daily amount (min: ₹50) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Installment plan updated successfully",
  "data": {
    "productId": "64abc123...",
    "variantId": "VAR001",
    "updatedPlan": {
      "totalDays": 50,
      "dailyAmount": 200,
      "totalAmount": 10000
    }
  }
}
```

**Error Responses:**

400 - Missing Required Fields:
```json
{
  "success": false,
  "message": "oldPlan with totalDays and dailyAmount is required to identify cart item"
}
```

404 - Cart Item Not Found:
```json
{
  "success": false,
  "message": "Cart item not found with specified product, variant, and plan"
}
```

---

### 6. Remove Product from Cart
**DELETE** `/api/cart/remove/:productId`

Remove a specific product from cart.

**Authentication:** Required

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| productId | string | MongoDB ObjectId of the product |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Product removed from cart successfully",
  "data": {
    "cartItemCount": 3
  }
}
```

**Error Responses:**

404 - Product Not in Cart:
```json
{
  "success": false,
  "message": "Product not in cart"
}
```

---

### 7. Clear Cart
**DELETE** `/api/cart/clear`

Remove all products from cart.

**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "cartItemCount": 0
  }
}
```

---

## Data Models

### Cart Model
```javascript
{
  userId: ObjectId,           // User reference
  products: [                 // Array of cart items
    {
      productId: ObjectId,    // Product reference
      quantity: Number,       // 1-10

      // Variant (optional)
      variantId: String,
      variantDetails: {
        sku: String,
        attributes: {
          size: String,
          color: String,
          weight: String,
          purity: String,
          material: String
        },
        price: Number,
        description: String
      },

      // Installment Plan (required)
      installmentPlan: {
        totalDays: Number,    // min: 5
        dailyAmount: Number   // min: 50
      },

      addedAt: Date,
      updatedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## Request/Response Examples

### Example 1: Add Product with Variant and Plan

**Request:**
```http
POST /api/cart/add/64abc123def456789
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "quantity": 2,
  "variantId": "GOLD-10G-24K",
  "totalDays": 100,
  "dailyAmount": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product added to cart successfully",
  "data": {
    "cartItemCount": 2,
    "cartItems": 1
  }
}
```

---

### Example 2: Get Cart with Multiple Products

**Request:**
```http
GET /api/cart
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Cart fetched successfully",
  "data": {
    "products": [
      {
        "productId": "64abc123...",
        "name": "Gold Coin 10g",
        "brand": "Malabar Gold",
        "price": 50000,
        "finalPrice": 48000,
        "discount": 4,
        "images": ["https://example.com/gold1.jpg"],
        "stock": 100,
        "isActive": true,
        "quantity": 2,
        "variant": {
          "variantId": "GOLD-10G-24K",
          "sku": "GOLD-10G-24K",
          "attributes": {
            "weight": "10g",
            "purity": "24K"
          },
          "description": "24 Karat Gold Coin"
        },
        "installmentPlan": {
          "totalDays": 100,
          "dailyAmount": 960,
          "totalAmount": 96000
        },
        "addedAt": "2025-12-01T10:00:00.000Z",
        "updatedAt": "2025-12-01T10:00:00.000Z",
        "itemTotal": 96000
      },
      {
        "productId": "64xyz789...",
        "name": "Silver Bar 100g",
        "brand": "MMTC",
        "price": 8000,
        "finalPrice": 7500,
        "discount": 6,
        "images": ["https://example.com/silver1.jpg"],
        "stock": 50,
        "isActive": true,
        "quantity": 1,
        "variant": null,
        "installmentPlan": {
          "totalDays": 50,
          "dailyAmount": 150,
          "totalAmount": 7500
        },
        "addedAt": "2025-12-01T11:00:00.000Z",
        "updatedAt": "2025-12-01T11:00:00.000Z",
        "itemTotal": 7500
      }
    ],
    "totalItems": 3,
    "totalPrice": 103500,
    "subtotal": 103500
  }
}
```

---

### Example 3: Change Installment Plan

**Request:**
```http
PUT /api/cart/update-plan
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "productId": "64abc123def456789",
  "variantId": "GOLD-10G-24K",
  "oldPlan": {
    "totalDays": 100,
    "dailyAmount": 960
  },
  "newPlan": {
    "totalDays": 50,
    "dailyAmount": 1920
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Installment plan updated successfully",
  "data": {
    "productId": "64abc123def456789",
    "variantId": "GOLD-10G-24K",
    "updatedPlan": {
      "totalDays": 50,
      "dailyAmount": 1920,
      "totalAmount": 96000
    }
  }
}
```

---

## Error Handling

### Standard Error Response Format

All errors follow this format:
```json
{
  "success": false,
  "message": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing or invalid token) |
| 404 | Not Found (product/cart not found) |
| 500 | Internal Server Error |

### Common Error Scenarios

#### 1. Authentication Errors
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

#### 2. Validation Errors
```json
{
  "success": false,
  "message": "Quantity must be between 1 and 10"
}
```

#### 3. Stock Errors
```json
{
  "success": false,
  "message": "Only 3 items available in stock"
}
```

#### 4. Product Not Found
```json
{
  "success": false,
  "message": "Product not found"
}
```

#### 5. Variant Not Available
```json
{
  "success": false,
  "message": "Variant 'VAR001' is not available"
}
```

---

## Integration Guide

### Step-by-Step Integration

#### Step 1: User Authentication
All cart APIs require authentication. Include the user's JWT token in the Authorization header.

```javascript
const headers = {
  'Authorization': `Bearer ${userToken}`,
  'Content-Type': 'application/json'
};
```

---

#### Step 2: Display Product Page
When user views a product:
1. Show product details
2. Show available variants (if any)
3. Let user select installment plan (totalDays, dailyAmount)

---

#### Step 3: Add to Cart
When user clicks "Add to Cart":

```javascript
async function addToCart(productId, quantity, variantId, totalDays, dailyAmount) {
  try {
    const response = await fetch(`${BASE_URL}/api/cart/add/${productId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quantity,
        variantId,
        totalDays,
        dailyAmount
      })
    });

    const data = await response.json();

    if (data.success) {
      // Show success message
      alert('Product added to cart!');
      // Update cart badge count
      updateCartBadge(data.data.cartItemCount);
    } else {
      // Show error
      alert(data.message);
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
  }
}
```

---

#### Step 4: Display Cart
Fetch and display user's cart:

```javascript
async function getCart() {
  try {
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    const data = await response.json();

    if (data.success) {
      const cart = data.data;
      // Display cart items
      displayCartItems(cart.products);
      // Show totals
      displayTotals(cart.totalItems, cart.totalPrice);
    }
  } catch (error) {
    console.error('Error fetching cart:', error);
  }
}
```

---

#### Step 5: Update Quantity
When user changes quantity:

```javascript
async function updateQuantity(productId, newQuantity) {
  try {
    const response = await fetch(`${BASE_URL}/api/cart/update/${productId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quantity: newQuantity
      })
    });

    const data = await response.json();

    if (data.success) {
      // Refresh cart
      getCart();
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error updating quantity:', error);
  }
}
```

---

#### Step 6: Change Installment Plan
When user wants to change payment plan:

```javascript
async function changeInstallmentPlan(productId, variantId, oldPlan, newPlan) {
  try {
    const response = await fetch(`${BASE_URL}/api/cart/update-plan`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId,
        variantId,
        oldPlan,
        newPlan
      })
    });

    const data = await response.json();

    if (data.success) {
      alert('Plan updated successfully!');
      getCart(); // Refresh cart
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Error updating plan:', error);
  }
}
```

---

#### Step 7: Remove from Cart
When user removes an item:

```javascript
async function removeFromCart(productId) {
  try {
    const response = await fetch(`${BASE_URL}/api/cart/remove/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    const data = await response.json();

    if (data.success) {
      alert('Product removed from cart');
      getCart(); // Refresh cart
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
  }
}
```

---

#### Step 8: Cart Badge Count
Display cart item count in header/navbar:

```javascript
async function getCartCount() {
  try {
    const response = await fetch(`${BASE_URL}/api/cart/count`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });

    const data = await response.json();

    if (data.success) {
      // Update badge
      document.getElementById('cart-badge').textContent = data.data.count;
    }
  } catch (error) {
    console.error('Error fetching cart count:', error);
  }
}
```

---

## Important Business Logic

### 1. Same Product with Different Plans
If user adds the **same product** with a **different installment plan**, it creates a **separate cart entry**.

**Example:**
```
Cart Entry 1: Gold Coin (100 days, ₹100/day)
Cart Entry 2: Gold Coin (50 days, ₹200/day)
```
Both entries are independent.

---

### 2. Same Product with Same Plan
If user adds the **same product** with the **same plan**, quantity is **incremented**.

**Example:**
```
Existing: Gold Coin × 2 (100 days, ₹100/day)
Add: Gold Coin × 1 (100 days, ₹100/day)
Result: Gold Coin × 3 (100 days, ₹100/day)
```

---

### 3. Variant Handling
Products with variants are treated as different items.

**Example:**
```
Cart Entry 1: Gold Coin - 10g variant
Cart Entry 2: Gold Coin - 20g variant
```
These are two separate entries.

---

### 4. Dynamic Pricing
Cart always fetches the **latest price** from the product catalog. Prices are not locked when adding to cart.

---

### 5. Stock Validation
- Stock is validated when adding to cart
- Stock is re-validated when updating quantity
- If stock becomes unavailable, item remains in cart but flagged as unavailable

---

## UI/UX Recommendations

### Cart Page Layout
```
┌─────────────────────────────────────────┐
│  Shopping Cart (3 items)                │
├─────────────────────────────────────────┤
│  [Image] Gold Coin 10g                  │
│  Variant: 10g, 24K                      │
│  Quantity: 2  [- 2 +]                   │
│  Plan: 100 days @ ₹960/day              │
│  [Change Plan] [Remove]                 │
│  Price: ₹96,000                         │
├─────────────────────────────────────────┤
│  [Image] Silver Bar 100g                │
│  Quantity: 1  [- 1 +]                   │
│  Plan: 50 days @ ₹150/day               │
│  [Change Plan] [Remove]                 │
│  Price: ₹7,500                          │
├─────────────────────────────────────────┤
│  Subtotal: ₹103,500                     │
│  [Continue Shopping] [Proceed to Order] │
└─────────────────────────────────────────┘
```

---

### Plan Selection Modal
When changing plan, show:
```
Select Installment Plan
○ 50 days @ ₹1,920/day
○ 100 days @ ₹960/day
● 150 days @ ₹640/day (Selected)

[Cancel] [Update Plan]
```

---

## Testing Checklist

- [ ] Add product without variant
- [ ] Add product with variant
- [ ] Add product with custom plan
- [ ] Add same product with different plan (should create separate entry)
- [ ] Add same product with same plan (should increment quantity)
- [ ] Update quantity
- [ ] Update installment plan
- [ ] Remove product
- [ ] Clear cart
- [ ] Get cart with multiple products
- [ ] Get cart count
- [ ] Handle out of stock products
- [ ] Handle invalid token
- [ ] Handle product not found
- [ ] Handle variant not found

---

## Support & Contact

For questions or issues:
- **Backend Team:** Create issue in repository
- **API Testing:** Use Postman collection (provided separately)
- **Integration Help:** Refer to examples in this documentation

---

**Last Updated:** December 2025
**Document Version:** 1.0
**API Base URL:** `/api/cart`
