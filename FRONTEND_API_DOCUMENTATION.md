# Frontend API Documentation

Complete API documentation for frontend integration.

**Base URL:** `https://api.epielio.com` (or your backend URL)

---

## 📋 Table of Contents

1. [Transaction History API](#1-transaction-history-api)
2. [Order History API](#2-order-history-api)
3. [Delivered Products API](#3-delivered-products-api)
4. [Withdrawal API](#4-withdrawal-api)
5. [User Profile Image Update API](#5-user-profile-image-update-api)

---

## Authentication

All APIs require authentication using Bearer Token in the header:

```
Authorization: Bearer <your_token_here>
```

---

## 1. Transaction History API

Get all transactions (Razorpay payments, wallet transactions, EMI payments, commissions, etc.)

### Endpoint
```
GET /api/wallet/transactions
```

### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

### Request Body
No body required (GET request)

### Success Response (200 OK)
```json
{
  "success": true,
  "transactions": [
    {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "user": "65f1a2b3c4d5e6f7g8h9i0j1",
      "type": "emi_payment",
      "amount": 100,
      "status": "completed",
      "paymentMethod": "razorpay",
      "paymentDetails": {
        "orderId": "order_NXR2jK3lO9p2Qs",
        "paymentId": "pay_NXR3kL4mP0q3Rt",
        "signature": "abc123...",
        "emiNumber": 1,
        "totalEmis": 50
      },
      "product": {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "name": "iPhone 15 Pro",
        "images": ["https://..."],
        "pricing": {
          "finalPrice": 5000
        }
      },
      "order": {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "orderAmount": 5000,
        "orderStatus": "confirmed"
      },
      "description": "EMI payment #1 for iPhone 15 Pro",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "summary": {
    "total": 50,
    "completed": 45,
    "pending": 3,
    "failed": 2,
    "razorpayPayments": 20,
    "walletTransactions": 10,
    "emiPayments": 15,
    "commissions": 5,
    "totalEarnings": 5000,
    "totalSpent": 15000
  }
}
```

### Transaction Types
- `emi_payment` - EMI payment by user
- `referral_commission` - 20% referral commission
- `commission` - Admin commission (10%)
- `withdrawal` - Wallet withdrawal
- `bonus` - Wallet bonus/credit
- `purchase` - Direct product purchase
- `investment` - Investment transaction
- `refund` - Refund transaction

### Payment Methods
- `razorpay` - Razorpay payment
- `bank_transfer` - Bank transfer
- `upi` - UPI payment
- `referral_bonus` - Referral bonus
- `system` - System transaction

### Status Values
- `pending` - Transaction pending
- `completed` - Transaction completed
- `failed` - Transaction failed
- `cancelled` - Transaction cancelled

### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## 2. Order History API

Get all orders of the logged-in user

### Endpoint
```
GET /api/orders/user/history
```

### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

### Request Body
No body required (GET request)

### Success Response (200 OK)
```json
{
  "success": true,
  "orders": [
    {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "user": "65f1a2b3c4d5e6f7g8h9i0j1",
      "product": {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "name": "iPhone 15 Pro",
        "images": ["https://..."],
        "description": "Latest iPhone model",
        "pricing": {
          "basePrice": 6000,
          "discount": 1000,
          "finalPrice": 5000
        },
        "category": "Electronics",
        "brand": "Apple"
      },
      "orderAmount": 5000,
      "paymentOption": "daily",
      "paymentStatus": "partial",
      "orderStatus": "confirmed",
      "paymentDetails": {
        "dailyAmount": 100,
        "totalDuration": 50,
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-02-20T00:00:00.000Z",
        "totalEmis": 50
      },
      "deliveryAddress": {
        "addressLine1": "123 Main Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
      },
      "currentEmiNumber": 10,
      "emiPaidAmount": 1000,
      "totalPaid": 1000,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 5
}
```

### Order Status Values
- `pending` - Order pending
- `confirmed` - Order confirmed
- `completed` - Order completed/delivered
- `cancelled` - Order cancelled

### Payment Status Values
- `pending` - No payment made
- `partial` - Partial payment made
- `completed` - Full payment completed

### Payment Options
- `upfront` - Full payment upfront
- `daily` - Daily EMI plan

### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## 3. Delivered Products API

Get all delivered/completed orders of the logged-in user

### Endpoint
```
GET /api/orders/user/delivered
```

### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

### Request Body
No body required (GET request)

### Success Response (200 OK)
```json
{
  "success": true,
  "orders": [
    {
      "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "user": "65f1a2b3c4d5e6f7g8h9i0j1",
      "product": {
        "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
        "name": "iPhone 15 Pro",
        "images": ["https://s3.amazonaws.com/..."],
        "description": "Latest iPhone model",
        "pricing": {
          "finalPrice": 5000
        },
        "category": "Electronics",
        "brand": "Apple"
      },
      "orderAmount": 5000,
      "paymentStatus": "completed",
      "orderStatus": "completed",
      "deliveryAddress": {
        "addressLine1": "123 Main Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
      },
      "totalPaid": 5000,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-02-20T10:30:00.000Z"
    }
  ],
  "count": 3
}
```

**Note:** This API returns only orders with `orderStatus: "completed"`

### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## 4. Withdrawal API

### 4.1 Create Withdrawal Request

Request to withdraw money from wallet

#### Endpoint
```
POST /api/payments/withdraw
```

#### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

#### Request Body
```json
{
  "amount": 1000,
  "paymentMethod": "bank_transfer",
  "bankDetailsId": "65f1a2b3c4d5e6f7g8h9i0j1"
}
```

**Required Fields:**
- `amount` (number, minimum: 100) - Withdrawal amount
- `paymentMethod` (string) - Either "bank_transfer" or "upi"
- `bankDetailsId` (string, optional) - Specific bank details ID. If not provided, default bank details will be used

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "transaction": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "user": "65f1a2b3c4d5e6f7g8h9i0j1",
    "type": "withdrawal",
    "amount": 1000,
    "status": "pending",
    "paymentMethod": "bank_transfer",
    "paymentDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "1234567890",
      "accountHolderName": "John Doe",
      "ifscCode": "HDFC0001234",
      "bankDetailsId": "65f1a2b3c4d5e6f7g8h9i0j1"
    },
    "description": "Withdrawal via bank transfer",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Amount**
```json
{
  "message": "Minimum withdrawal amount is 100"
}
```

**400 Bad Request - Invalid Payment Method**
```json
{
  "message": "Invalid payment method"
}
```

**400 Bad Request - Insufficient Balance**
```json
{
  "message": "Insufficient wallet balance"
}
```

**400 Bad Request - No Bank Details**
```json
{
  "message": "No bank details available"
}
```

**403 Forbidden - KYC Not Verified**
```json
{
  "message": "KYC verification required for withdrawals: Document verification needed. ID verification (Aadhar/PAN) needed."
}
```

**404 Not Found - Bank Details Not Found**
```json
{
  "message": "Bank details not found"
}
```

---

### 4.2 Get Withdrawal History

Get all withdrawal transactions of the logged-in user

#### Endpoint
```
GET /api/payments/withdrawals
```

#### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

#### Request Body
No body required (GET request)

#### Success Response (200 OK)
```json
[
  {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "user": "65f1a2b3c4d5e6f7g8h9i0j1",
    "type": "withdrawal",
    "amount": 1000,
    "status": "completed",
    "paymentMethod": "bank_transfer",
    "paymentDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "1234567890",
      "accountHolderName": "John Doe",
      "ifscCode": "HDFC0001234"
    },
    "description": "Withdrawal via bank transfer",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
]
```

#### Error Response (401 Unauthorized)
```json
{
  "message": "Unauthorized"
}
```

---

## 5. User Profile Image Update API

Update user profile picture (uploads to S3)

### Endpoint
```
PUT /api/users/:userId/profile-picture
```

**URL Parameters:**
- `userId` - User's MongoDB ObjectId

### Request Headers
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "multipart/form-data"
}
```

### Request Body (FormData)

**Form Field:**
- `image` (file) - Image file to upload

**Supported Formats:** JPG, JPEG, PNG, WebP
**Maximum Size:** 10MB
**Auto-resize:** Image will be resized to 480px width

### Example JavaScript/Axios Request
```javascript
const formData = new FormData();
formData.append('image', selectedFile); // selectedFile is the File object

const response = await axios.put(
  `/api/users/${userId}/profile-picture`,
  formData,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  }
);
```

### Example React Native Request
```javascript
const formData = new FormData();
formData.append('image', {
  uri: imageUri,
  type: 'image/jpeg',
  name: 'profile.jpg',
});

const response = await fetch(`${API_URL}/api/users/${userId}/profile-picture`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "profilePicture": "https://company-video-storage-prod.s3.ap-south-1.amazonaws.com/profile-pictures/1705312345678-a1b2c3d.jpg",
  "uploadDetails": {
    "size": 123456,
    "mimeType": "image/jpeg"
  }
}
```

### Error Responses

**400 Bad Request - No File**
```json
{
  "success": false,
  "message": "Please upload an image file"
}
```

**400 Bad Request - Invalid File Type**
```json
{
  "success": false,
  "message": "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
}
```

**400 Bad Request - File Too Large**
```json
{
  "success": false,
  "message": "File too large"
}
```

**403 Forbidden - Unauthorized**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**404 Not Found - User Not Found**
```json
{
  "success": false,
  "message": "User not found"
}
```

**500 Server Error**
```json
{
  "success": false,
  "message": "Server error: <error_message>"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

This occurs when:
- Token is missing
- Token is invalid
- Token is expired

### 500 Server Error
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## Best Practices

1. **Always include Authorization header** with Bearer token
2. **Handle all error responses** properly in your frontend
3. **Show loading states** while API calls are in progress
4. **Cache data** when appropriate to reduce API calls
5. **Validate data** on frontend before sending to backend
6. **Show user-friendly error messages** based on error responses
7. **Implement retry logic** for failed requests (except 4xx errors)
8. **Use async/await** or Promises for cleaner code

---

## Testing

You can test these APIs using:
- **Postman** - Import this documentation as Postman collection
- **Thunder Client** (VS Code extension)
- **Insomnia**
- **cURL** commands

### Example cURL Commands

**Transaction History:**
```bash
curl -X GET https://api.epielio.com/api/wallet/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Create Withdrawal:**
```bash
curl -X POST https://api.epielio.com/api/payments/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "paymentMethod": "bank_transfer"
  }'
```

**Upload Profile Picture:**
```bash
curl -X PUT https://api.epielio.com/api/users/USER_ID/profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

---

## Support

For any issues or questions, contact the backend team or raise an issue on the project repository.

---

**Last Updated:** January 2024
**API Version:** 1.0
**Backend Team:** Epi Backend Development
