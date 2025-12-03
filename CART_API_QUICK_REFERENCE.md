# Cart API - Quick Reference Guide

## 🚀 Base URL
```
/api/cart
```

---

## 📋 All Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/cart` | Get user's cart | ✅ Required |
| GET | `/api/cart/count` | Get cart item count | ✅ Required |
| POST | `/api/cart/add/:productId` | Add product to cart | ✅ Required |
| PUT | `/api/cart/update/:productId` | Update quantity | ✅ Required |
| PUT | `/api/cart/update-plan` | Update installment plan | ✅ Required |
| DELETE | `/api/cart/remove/:productId` | Remove product | ✅ Required |
| DELETE | `/api/cart/clear` | Clear entire cart | ✅ Required |

---

## 🔑 Authentication Header
```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

---

## 📦 Quick Examples

### 1️⃣ Add Product to Cart
```javascript
POST /api/cart/add/64abc123def456789

{
  "quantity": 2,
  "variantId": "VAR001",
  "totalDays": 100,
  "dailyAmount": 100
}
```

### 2️⃣ Get Cart
```javascript
GET /api/cart

Response:
{
  "success": true,
  "data": {
    "products": [...],
    "totalItems": 5,
    "totalPrice": 103500
  }
}
```

### 3️⃣ Update Quantity
```javascript
PUT /api/cart/update/64abc123def456789

{
  "quantity": 5
}
```

### 4️⃣ Change Installment Plan
```javascript
PUT /api/cart/update-plan

{
  "productId": "64abc123def456789",
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

### 5️⃣ Remove Product
```javascript
DELETE /api/cart/remove/64abc123def456789
```

### 6️⃣ Clear Cart
```javascript
DELETE /api/cart/clear
```

---

## ⚡ Key Features

✅ **Product Variants** - Support for product variants (size, color, weight, etc.)
✅ **Custom Plans** - Each product can have different installment plans
✅ **Multiple Entries** - Same product with different plans = separate cart entries
✅ **Dynamic Pricing** - Always fetches latest price from product catalog
✅ **Stock Validation** - Validates stock availability

---

## 🎯 Cart Item Structure

```javascript
{
  "productId": "64abc123...",
  "name": "Gold Coin 10g",
  "quantity": 2,
  "variant": {
    "variantId": "VAR001",
    "sku": "GOLD-10G-24K",
    "attributes": { "weight": "10g", "purity": "24K" }
  },
  "installmentPlan": {
    "totalDays": 100,
    "dailyAmount": 960,
    "totalAmount": 96000
  },
  "itemTotal": 96000
}
```

---

## ⚠️ Common Errors

| Status | Message | Solution |
|--------|---------|----------|
| 400 | Quantity must be between 1 and 10 | Check quantity value |
| 400 | totalDays is required and must be at least 5 | Add totalDays field |
| 404 | Product not found | Check productId |
| 404 | Variant not found | Check variantId |
| 400 | Only X items available in stock | Reduce quantity |

---

## 📱 Mobile/App Integration Flow

```
1. User views product
   ↓
2. User selects variant (if applicable)
   ↓
3. User selects installment plan
   ↓
4. User clicks "Add to Cart"
   ↓
5. Call: POST /api/cart/add/:productId
   ↓
6. Update cart badge: GET /api/cart/count
   ↓
7. Show success message
```

---

## 💡 Business Logic

### Same Product + Same Plan = Increment Quantity
```
Existing: Gold Coin × 2 (100 days)
Add: Gold Coin × 1 (100 days)
Result: Gold Coin × 3 (100 days)
```

### Same Product + Different Plan = New Entry
```
Entry 1: Gold Coin × 2 (100 days, ₹100/day)
Entry 2: Gold Coin × 1 (50 days, ₹200/day)
```

---

## 🧪 Testing with cURL

```bash
# Get Cart
curl -X GET http://localhost:3000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"

# Add to Cart
curl -X POST http://localhost:3000/api/cart/add/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 2,
    "totalDays": 100,
    "dailyAmount": 100
  }'

# Update Quantity
curl -X PUT http://localhost:3000/api/cart/update/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5}'

# Remove from Cart
curl -X DELETE http://localhost:3000/api/cart/remove/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 Full Documentation

For detailed documentation, see: [CART_API_DOCUMENTATION.md](./CART_API_DOCUMENTATION.md)

---

**Last Updated:** December 2025
