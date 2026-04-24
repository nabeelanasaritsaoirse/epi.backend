# Admin Referral API Guide

This guide explains how admins can view and manage user referral details.

## 🔐 Authentication Required

All these endpoints require:
- Admin authentication (Bearer token)
- Admin role (role: 'admin' or 'super_admin')

## 📋 Available Endpoints

### 1. Get User Referral Details by Phone or Email

**Endpoint:** `GET /api/admin/referrals/user`

**Description:** Get complete referral details for a user by their phone number or email.

**Query Parameters:**
- `phone` - User's phone number (optional)
- `email` - User's email address (optional)

**Note:** Provide either `phone` OR `email`, not both.

**Example Requests:**

```bash
# By Phone Number
GET /api/admin/referrals/user?phone=1234567890
Authorization: Bearer <ADMIN_TOKEN>

# By Email
GET /api/admin/referrals/user?email=user@example.com
Authorization: Bearer <ADMIN_TOKEN>
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "userInfo": {
      "userId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "1234567890",
      "profilePicture": "https://example.com/pic.jpg",
      "referralCode": "JOHN123",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "referralStats": {
      "totalReferrals": 5,
      "referralLimit": 50,
      "remainingReferrals": 45,
      "referralLimitReached": false,
      "activeReferrals": 3,
      "pendingReferrals": 1,
      "completedReferrals": 1,
      "totalProducts": 8
    },
    "earnings": {
      "totalEarnings": 1500.50,
      "totalCommission": 1500.50,
      "availableBalance": 1200.30,
      "totalWithdrawn": 300.20
    },
    "referredUsers": [
      {
        "userId": "507f1f77bcf86cd799439012",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phoneNumber": "9876543210",
        "profilePicture": "",
        "joinedAt": "2024-02-01T08:15:00.000Z",
        "status": "ACTIVE",
        "totalProducts": 2,
        "totalCommission": 450.00,
        "products": [
          {
            "productName": "Investment Plan A",
            "productId": "PROD001",
            "totalAmount": 3399,
            "dateOfPurchase": "2024-02-05T10:00:00.000Z",
            "days": 34,
            "paidDays": 15,
            "pendingDays": 19,
            "commissionPerDay": 30,
            "status": "ACTIVE"
          }
        ]
      }
    ],
    "withdrawals": [
      {
        "id": "507f1f77bcf86cd799439013",
        "amount": 300.20,
        "status": "COMPLETED",
        "paymentMethod": "UPI",
        "requestedAt": "2024-03-01T10:00:00.000Z",
        "processedAt": "2024-03-02T14:30:00.000Z"
      }
    ]
  }
}
```

---

### 2. Get User Referral Details by User ID

**Endpoint:** `GET /api/admin/referrals/user/:userId`

**Description:** Get complete referral details for a user by their MongoDB ObjectId.

**Path Parameters:**
- `userId` - MongoDB ObjectId of the user

**Example Request:**

```bash
GET /api/admin/referrals/user/507f1f77bcf86cd799439011
Authorization: Bearer <ADMIN_TOKEN>
```

**Response:** Same as endpoint #1

---

### 3. Get All Users with Referral Statistics

**Endpoint:** `GET /api/admin/referrals/all-users`

**Description:** Get a paginated list of all users with their referral statistics summary.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `search` - Search by name, email, phone, or referral code (optional)

**Example Requests:**

```bash
# Get first page with 20 users
GET /api/admin/referrals/all-users?page=1&limit=20
Authorization: Bearer <ADMIN_TOKEN>

# Search for specific user
GET /api/admin/referrals/all-users?search=john
Authorization: Bearer <ADMIN_TOKEN>

# Get second page with 50 users
GET /api/admin/referrals/all-users?page=2&limit=50
Authorization: Bearer <ADMIN_TOKEN>
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "1234567890",
        "referralCode": "JOHN123",
        "joinedAt": "2024-01-15T10:30:00.000Z",
        "totalReferrals": 5,
        "activeReferrals": 3,
        "totalEarnings": 1500.50
      },
      {
        "userId": "507f1f77bcf86cd799439012",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phoneNumber": "9876543210",
        "referralCode": "JANE456",
        "joinedAt": "2024-02-01T08:15:00.000Z",
        "totalReferrals": 2,
        "activeReferrals": 2,
        "totalEarnings": 800.00
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 95,
      "limit": 20
    }
  }
}
```

---

### 4. Update User's Referral Relationship

**Endpoint:** `PUT /api/admin/referrals/user/:userId/referrer`

**Description:** Change who referred a user (update the `referredBy` field). This is a powerful admin-only feature for correcting referral mistakes or data migration.

**Path Parameters:**
- `userId` - MongoDB ObjectId of the user whose referrer needs to be changed

**Body Parameters:**
- `newReferrerId` - MongoDB ObjectId of the new referrer (required, use `null` to remove referral)
- `reason` - Reason for the change (optional, recommended for audit trail)

**Important Notes:**
- ⚠️ This will DELETE the old referral record if it exists
- ⚠️ Will FAIL if user has active purchases under current referral (safety check)
- ✅ Will create a new PENDING referral record with the new referrer
- ✅ All changes are logged for audit purposes

**Example Requests:**

```bash
# Change user's referrer
PUT /api/admin/referrals/user/507f1f77bcf86cd799439011/referrer
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "newReferrerId": "507f1f77bcf86cd799439012",
  "reason": "User entered wrong referral code during signup"
}
```

```bash
# Remove referral relationship
PUT /api/admin/referrals/user/507f1f77bcf86cd799439011/referrer
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "newReferrerId": null,
  "reason": "Removing fraudulent referral"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Referral relationship updated successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "userName": "John Doe",
    "previousReferrer": {
      "id": "507f1f77bcf86cd799439013"
    },
    "newReferrer": {
      "id": "507f1f77bcf86cd799439012"
    },
    "referralRecordCreated": true
  }
}
```

**Error Responses:**

**User Not Found (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

**New Referrer Not Found (404):**
```json
{
  "success": false,
  "error": "New referrer user not found"
}
```

**Self-Referral Attempt (400):**
```json
{
  "success": false,
  "error": "User cannot refer themselves"
}
```

**User Has Active Purchases (400):**
```json
{
  "success": false,
  "error": "Cannot change referrer: User has active purchases under current referral. Please contact technical team.",
  "details": {
    "totalPurchases": 3,
    "totalCommission": 1500.00
  }
}
```

**Already Has This Referrer (400):**
```json
{
  "success": false,
  "error": "User is already referred by this referrer"
}
```

**Missing Parameter (400):**
```json
{
  "success": false,
  "error": "Please provide newReferrerId (or null to remove referral)"
}
```

---

## 📊 What Information Can Admin See?

For each user, the admin can see:

### User Information:
- User ID, Name, Email, Phone Number
- Profile Picture
- Referral Code
- Account creation date

### Referral Statistics:
- Total number of people referred
- Referral limit and remaining slots
- Active, pending, and completed referrals
- Total products purchased by referred users

### Earnings Information:
- Total earnings from referrals
- Total commission generated
- Available balance (can be withdrawn)
- Total amount withdrawn

### Referred Users Details:
- Who used the user's referral code
- Each referred user's information
- Products purchased by each referred user
- Commission earned from each product
- Payment status (days paid vs pending)

### Withdrawal History:
- All withdrawal requests
- Withdrawal amounts and status
- Payment method and processing dates

---

## 🧪 Testing the Endpoints

### Using cURL:

```bash
# Example: Get user by phone
curl -X GET "http://localhost:5000/api/admin/referrals/user?phone=1234567890" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Example: Get all users with pagination
curl -X GET "http://localhost:5000/api/admin/referrals/all-users?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Example: Search for a user
curl -X GET "http://localhost:5000/api/admin/referrals/all-users?search=john" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Using JavaScript/Fetch:

```javascript
// Get user by email
const response = await fetch(
  'http://localhost:5000/api/admin/referrals/user?email=user@example.com',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
console.log(data);
```

### Using Postman:

1. **Set Request Type:** GET
2. **Enter URL:** `http://localhost:5000/api/admin/referrals/user?phone=1234567890`
3. **Add Header:**
   - Key: `Authorization`
   - Value: `Bearer YOUR_ADMIN_TOKEN`
4. **Click Send**

---

## ⚠️ Error Responses

### User Not Found (404)
```json
{
  "success": false,
  "error": "User not found"
}
```

### Missing Parameters (400)
```json
{
  "success": false,
  "error": "Please provide either phone number or email"
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Authentication token required",
  "code": "NO_TOKEN"
}
```

### Forbidden - Not Admin (403)
```json
{
  "success": false,
  "message": "Access denied",
  "code": "ADMIN_REQUIRED"
}
```

---

## 🎯 Use Cases

### 1. Check a Specific User's Referral Performance
Admin receives a call from a user asking about their referrals:
```
GET /api/admin/referrals/user?phone=9876543210
```

### 2. Find Top Referrers
Get all users and sort by totalEarnings on the frontend:
```
GET /api/admin/referrals/all-users?limit=100
```

### 3. Search for User by Name
Customer support needs to find a user:
```
GET /api/admin/referrals/all-users?search=john
```

### 4. Verify Commission Payments
Check who referred a user and their commission status:
```
GET /api/admin/referrals/user?email=referred-user@example.com
```

---

## 🔒 Security Notes

- All endpoints require admin authentication
- Only users with `role: 'admin'` or `role: 'super_admin'` can access
- Phone numbers and emails are case-insensitive for searching
- User data includes sensitive information - use securely
- **NEW:** Referrer updates are logged with admin ID and reason for audit trail
- **NEW:** Safety check prevents referrer changes when user has active purchases/commissions

---

## 📝 Notes

- All monetary values are in rupees and rounded to 2 decimal places
- Dates are returned in ISO 8601 format
- The `search` parameter searches across name, email, phone, and referral code
- Pagination limits max out at 100 items per page for performance
- Commission calculations are based on daily SIP amounts and commission percentages
