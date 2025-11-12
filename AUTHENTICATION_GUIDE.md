# 🔐 Authentication Guide

## Overview

Your EPI Backend API has **mixed authentication requirements**:
- ✅ **Public endpoints** - No token needed
- 🔒 **Protected endpoints** - JWT token required

---

## Which Endpoints Need Authentication?

### ✅ PUBLIC (No Token Needed)
- ✅ `GET /categories` - Get all categories
- ✅ `GET /categories/dropdown/all` - Categories for dropdown
- ✅ `GET /categories/search/{query}` - Search categories
- ✅ `GET /categories/:id` - Get single category
- ✅ `POST /products` - **Create product** (no auth required!)
- ✅ `GET /products` - Get all products
- ✅ `GET /products/stats` - Product statistics
- ✅ `GET /products/search` - Search products
- ✅ `GET /products/:id` - Get single product
- ✅ `PUT /products/:id` - Update product (no auth required!)
- ✅ `DELETE /products/:id` - Delete product (no auth required!)

### 🔒 PROTECTED (JWT Token Required)
- 🔒 `POST /categories` - **Create category**
- 🔒 `PUT /categories/:id` - **Update category**
- 🔒 `DELETE /categories/:id` - **Delete category**
- 🔒 `PUT /categories/bulk/reorder` - Bulk reorder categories

---

## How to Get a JWT Token

### Option 1: Using Admin Dashboard

You need to create an admin user first. Use the test script:

```bash
# Create an admin user
node scripts/create-admin.js
```

This will output a JWT token that you can use.

### Option 2: Using Firebase Authentication

If Firebase is configured:

```javascript
// Frontend (Firebase Auth)
const user = await firebase.auth().currentUser;
const token = await user.getIdToken();
// Use this token in "Admin JWT Token" field
```

### Option 3: Using cURL to Get Token

```bash
# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

---

## Using Token in Admin Dashboard

1. **Open the dashboard**: `/admin-dashboard.html`
2. **In "Admin JWT Token" field** at the top, paste your token
3. **Click "Test Connection"** to verify
4. Now you can:
   - Create/edit/delete categories
   - Create/edit/delete products

---

## Using Token in cURL

Include the token in the `Authorization` header:

```bash
# Create category (requires token)
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{"name": "Electronics"}'

# Create product (NO token needed)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name": "iPhone 14", "price": 999.99}'
```

---

## Using Token in Frontend Code

### React Example

```javascript
async function createCategory(categoryData) {
  const token = localStorage.getItem('authToken'); // Get from local storage
  
  const response = await fetch('http://localhost:3000/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(categoryData)
  });
  
  const result = await response.json();
  return result;
}
```

### Vanilla JS Example

```javascript
function createCategory(data) {
  const token = document.getElementById('adminToken').value;
  
  fetch('/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(data => console.log('Success:', data));
}
```

---

## Token Format

Your JWT tokens should look like:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDcwOTMwOWUzYjY3MDAwMTY4ZjNmNDYiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaWF0IjoxNjMwNzAyMDAwfQ.abcd1234efgh5678ijkl9012mnop3456
```

**Parts:**
1. **Header** - Algorithm (HS256)
2. **Payload** - User data (userId, email, isAdmin)
3. **Signature** - Encrypted with server secret

---

## Decoding Your Token (Optional)

Use JWT.io to decode (don't share tokens!):

```javascript
// Decode in browser console
const token = "YOUR_TOKEN_HERE";
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

Output example:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "admin@example.com",
  "isAdmin": true,
  "iat": 1630702000,
  "exp": 1630788400
}
```

---

## Error Responses

### Missing Token (401)
```json
{
  "success": false,
  "message": "No token provided or token is invalid"
}
```

### Expired Token (401)
```json
{
  "success": false,
  "message": "Token has expired"
}
```

### Not Admin (403)
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### Invalid Token Format (400)
```json
{
  "success": false,
  "message": "Invalid token format"
}
```

---

## Admin Dashboard Token Handling

The dashboard automatically:
- ✅ Sends token for category operations (create/update/delete)
- ✅ Skips token for product operations (no auth needed)
- ✅ Shows warning if token is missing when needed
- ✅ Tests connection to verify token validity

---

## Quick Start

1. **Start backend:**
   ```bash
   npm run dev
   ```

2. **Create admin user:**
   ```bash
   node scripts/create-admin.js
   # Copy the JWT token output
   ```

3. **Open dashboard:**
   ```
   file:///path/to/admin-dashboard.html
   ```

4. **Paste token:**
   - Paste JWT in "Admin JWT Token" field
   - Click "Test Connection"
   - Create categories and products!

---

## Security Best Practices

❌ **DON'T:**
- Share your JWT token publicly
- Hardcode tokens in frontend code
- Store tokens in plain text
- Commit tokens to Git

✅ **DO:**
- Store tokens in secure HTTP-only cookies (backend)
- Use localStorage for temporary client-side storage
- Refresh tokens before expiration
- Invalidate tokens on logout
- Use HTTPS in production

---

## Token Expiration

Tokens typically expire after:
- **Development**: 24 hours
- **Production**: 1-8 hours (configurable)

When expired, you need to:
1. Login again to get a new token
2. Or use refresh token (if implemented)

---

## Troubleshooting

### "No token provided" error on category create?
→ Paste your JWT token in the "Admin JWT Token" field at the top

### "Token is invalid" error?
→ Token might be expired. Get a new one by logging in again

### Can't create categories but can create products?
→ This is normal! Category creation requires auth, products don't

### Token field shows "Bearer undefined"?
→ Check that you pasted the full token without extra spaces

---

**Status:** ✅ Complete Authentication Guide  
**Last Updated:** November 12, 2025
