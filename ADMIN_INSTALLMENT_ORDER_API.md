# Admin Installment Order Management API

This document describes the admin APIs for managing installment orders on behalf of users. These endpoints allow admins to create orders, mark payments as paid, and perform all actions that normal users can do.

## Base URL
```
https://api.epielio.com
```

## Authentication
All endpoints require admin authentication. Include the admin access token in the Authorization header:
```
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
```

### Admin Login
```http
POST /api/admin-auth/login
Content-Type: application/json

{
  "email": "admin@epi.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "userId": "...",
    "role": "admin",
    "email": "admin@epi.com"
  }
}
```

---

## 1. Create Installment Order for User

Creates an installment order on behalf of a user. Admin can optionally auto-mark the first payment as completed.

**Endpoint:** `POST /api/installments/admin/orders/create-for-user`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "694a453ef1deff8edfdd194b",
  "productId": "693babf155ab8ac6ec1cb7fb",
  "totalDays": 5,
  "shippingAddress": {
    "fullName": "Punagani Suresh Babu",
    "phone": "8897193576",
    "addressLine1": "Balaji venture",
    "addressLine2": "",
    "city": "Darsi",
    "state": "Andhra Pradesh",
    "pincode": "523247",
    "country": "India"
  },
  "paymentMethod": "WALLET",
  "autoPayFirstInstallment": true,
  "couponCode": "SAVE10",
  "variantId": "variant_123"
}
```

**Parameters:**
- `userId` (string, required) - User's MongoDB ID
- `productId` (string, required) - Product ID
- `totalDays` (number, required) - Number of days for installment plan
- `shippingAddress` (object, required) - Delivery address
- `paymentMethod` (string, optional) - 'WALLET' or 'RAZORPAY' (default: 'WALLET')
- `autoPayFirstInstallment` (boolean, optional) - Auto mark first payment as done (default: true)
- `couponCode` (string, optional) - Coupon code to apply
- `variantId` (string, optional) - Product variant ID

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Order created successfully on behalf of user",
  "data": {
    "order": {
      "_id": "694e6d7ec4c50014e7dcce4d",
      "orderId": "INS-1234567890",
      "user": "694a453ef1deff8edfdd194b",
      "product": "693babf155ab8ac6ec1cb7fb",
      "totalAmount": 460,
      "dailyInstallmentAmount": 92,
      "totalDays": 5,
      "paidInstallments": 1,
      "status": "ACTIVE",
      "createdByAdmin": true,
      "createdByAdminEmail": "admin@epi.com"
    },
    "firstPayment": {
      "_id": "694e6d7fc4c50014e7dcce50",
      "paymentId": "PAY-1234567890",
      "order": "694e6d7ec4c50014e7dcce4d",
      "amount": 92,
      "status": "COMPLETED",
      "installmentNumber": 1,
      "paymentMethod": "ADMIN_MARKED"
    },
    "note": "Order created and first payment marked as completed"
  }
}
```

---

## 2. Mark Single Payment as Paid

Marks a specific payment installment as paid. Used when a customer makes offline payment or needs manual intervention.

**Endpoint:** `POST /api/installments/admin/payments/:paymentId/mark-paid`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "transactionId": "CASH_12345",
  "note": "Customer paid cash at office",
  "paymentMethod": "CASH"
}
```

**Parameters:**
- `transactionId` (string, optional) - Transaction reference ID
- `note` (string, optional) - Admin note explaining the payment
- `paymentMethod` (string, optional) - Payment method (e.g., 'CASH', 'BANK_TRANSFER', 'UPI')

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Payment marked as paid successfully",
  "data": {
    "payment": {
      "_id": "694e6d7fc4c50014e7dcce51",
      "paymentId": "PAY-1234567891",
      "order": "694e6d7ec4c50014e7dcce4d",
      "amount": 92,
      "status": "COMPLETED",
      "installmentNumber": 2,
      "paymentMethod": "CASH",
      "transactionId": "CASH_12345",
      "adminMarked": true,
      "markedByEmail": "admin@epi.com",
      "adminNote": "Customer paid cash at office",
      "paidAt": "2025-12-26T12:00:00.000Z"
    }
  }
}
```

---

## 3. Mark All Payments as Paid

Marks all pending payments for an order as paid. Useful when customer wants to pay off entire order at once.

**Endpoint:** `POST /api/installments/admin/orders/:orderId/mark-all-paid`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "note": "Customer paid full amount via bank transfer"
}
```

**Parameters:**
- `note` (string, optional) - Admin note

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Successfully marked 4 payment(s) as paid",
  "data": {
    "order": {
      "_id": "694e6d7ec4c50014e7dcce4d",
      "orderId": "INS-1234567890",
      "status": "COMPLETED",
      "paidInstallments": 5,
      "totalDays": 5,
      "totalPaidAmount": 460
    },
    "paymentsMarked": 4,
    "totalPending": 4
  }
}
```

---

## 4. Cancel/Reverse a Payment

Cancels or reverses a completed payment. Used when there's an error or refund is needed.

**Endpoint:** `POST /api/installments/admin/payments/:paymentId/cancel`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_ACCESS_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Payment was duplicate, reversing the transaction"
}
```

**Parameters:**
- `reason` (string, required) - Reason for cancellation

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Payment cancelled successfully",
  "data": {
    "payment": {
      "_id": "694e6d7fc4c50014e7dcce51",
      "paymentId": "PAY-1234567891",
      "status": "CANCELLED",
      "cancelledBy": "admin_user_id",
      "cancelledByEmail": "admin@epi.com",
      "cancellationReason": "Payment was duplicate, reversing the transaction",
      "cancelledAt": "2025-12-26T12:30:00.000Z"
    }
  }
}
```

---

## 5. Get All Orders (Admin View)

Get all installment orders with filters. Admin can see all users' orders.

**Endpoint:** `GET /api/installments/admin/orders/all`

**Query Parameters:**
- `userId` (string, optional) - Filter by specific user ID
- `status` (string, optional) - Filter by status: 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'
- `deliveryStatus` (string, optional) - Filter by delivery status
- `limit` (number, optional) - Results per page (default: 50, max: 100)
- `page` (number, optional) - Page number
- `skip` (number, optional) - Skip N results

**Example:**
```
GET /api/installments/admin/orders/all?userId=694a453ef1deff8edfdd194b&status=ACTIVE&limit=20
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": {
    "orders": [ /* array of orders */ ],
    "count": 20,
    "totalCount": 50,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

---

## 6. Get Order Details (Admin View)

Get detailed information about a specific order including all payment records.

**Endpoint:** `GET /api/installments/admin/orders/:orderId`

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Order details retrieved successfully",
  "data": {
    "order": { /* full order object */ },
    "payments": [ /* array of all payments */ ]
  }
}
```

---

## 7. Get All Payments (Admin View)

Get all payment records across all orders.

**Endpoint:** `GET /api/installments/admin/payments/all`

**Query Parameters:**
- `orderId` (string, optional) - Filter by order ID
- `status` (string, optional) - Filter by status: 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'
- `limit` (number, optional)
- `page` (number, optional)

---

## Example Usage with cURL

### Create Order for User
```bash
# Login as admin
curl -X POST https://api.epielio.com/api/admin-auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@epi.com",
    "password": "your_password"
  }'

# Create order for user
curl -X POST https://api.epielio.com/api/installments/admin/orders/create-for-user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "694a453ef1deff8edfdd194b",
    "productId": "693babf155ab8ac6ec1cb7fb",
    "totalDays": 5,
    "shippingAddress": {
      "fullName": "Punagani Suresh Babu",
      "phone": "8897193576",
      "addressLine1": "Balaji venture",
      "city": "Darsi",
      "state": "Andhra Pradesh",
      "pincode": "523247",
      "country": "India"
    },
    "autoPayFirstInstallment": true
  }'
```

### Mark Payment as Paid
```bash
curl -X POST https://api.epielio.com/api/installments/admin/payments/PAYMENT_ID/mark-paid \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "CASH_12345",
    "note": "Paid cash at office",
    "paymentMethod": "CASH"
  }'
```

### Mark All Payments as Paid
```bash
curl -X POST https://api.epielio.com/api/installments/admin/orders/ORDER_ID/mark-all-paid \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Full payment received via bank transfer"
  }'
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields: userId, productId, totalDays, shippingAddress"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication failed"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Order not found"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Error creating order",
  "error": "Detailed error message"
}
```

---

## Notes

1. **Admin Tracking**: All admin actions are logged with the admin's user ID and email
2. **First Payment**: When `autoPayFirstInstallment` is true, the first payment is automatically marked as completed
3. **Commission**: Commission is calculated and credited to referrers if applicable
4. **Order Status**: Orders automatically transition to 'COMPLETED' when all payments are marked as paid
5. **Payment Methods**: Admin-marked payments use special payment methods like 'ADMIN_MARKED', 'CASH', 'BANK_TRANSFER', etc.
6. **Transaction IDs**: Auto-generated if not provided (format: `ADMIN_timestamp`)

---

## Migration Use Case

To migrate a user from normal orders to installment orders:

1. Get the user's details and original order information
2. Use `/api/installments/admin/orders/create-for-user` to create the new installment order
3. Set `autoPayFirstInstallment: true` to automatically mark the first payment as done
4. Use `/api/installments/admin/orders/:orderId/mark-all-paid` if you want to mark all payments as done

Example script is provided in `scripts/adminCreateOrderForUser.js`
