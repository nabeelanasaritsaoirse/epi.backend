# Sales Team Dashboard - API Documentation

## Overview

Sales Team Dashboard allows sales personnel to view ALL users, their referrals (Level 1 & Level 2), orders, wishlists, and cart data with **read-only** access.

---

## Authentication

Sales team members login through the **same admin panel** using email/password authentication.

### Login Endpoint

**POST** `/api/admin-auth/login`

**Request Body:**
```json
{
  "email": "sales@example.com",
  "password": "password123"
}
```

**Response for Sales Team:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "65xyz...",
    "name": "Sales Person Name",
    "email": "sales@example.com",
    "role": "sales_team",
    "profilePicture": "",
    "isSuperAdmin": false,
    "isSalesTeam": true,
    "modules": ["sales-dashboard", "users"],
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Frontend Routing Logic:**
```javascript
if (response.data.isSalesTeam) {
  window.location.href = '/admin/sales-dashboard.html';
} else if (response.data.isSuperAdmin) {
  window.location.href = '/admin/dashboard.html';
} else if (response.data.role === 'admin') {
  window.location.href = '/admin/dashboard.html';
}
```

---

## Sales Team APIs

All endpoints require `Authorization: Bearer {accessToken}` header.

### 1. Dashboard Statistics

**GET** `/api/sales/dashboard-stats`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeOrders": 450,
    "totalRevenue": 5250000.00,
    "pendingKYC": 120
  }
}
```

**Use Case:** Overview cards on sales dashboard

---

### 2. Get All Users (with Level 1 Count)

**GET** `/api/sales/users?page=1&limit=20&search=keyword`

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page
- `search` (optional) - Search by name, email, phone, or referral code

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "65abc...",
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "+919876543210",
        "profilePicture": "https://...",
        "referralCode": "JOHN1234",
        "createdAt": "2025-01-01T10:00:00.000Z",
        "wallet": {
          "balance": 1500
        },
        "level1Count": 5
      }
    ],
    "pagination": {
      "total": 1250,
      "page": 1,
      "limit": 20,
      "totalPages": 63
    }
  }
}
```

**Use Case:** User list table with search and pagination

---

### 3. Get User Detail (with Level 1 & Level 2 Referrals)

**GET** `/api/sales/users/:userId`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "65abc...",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+919876543210",
      "profilePicture": "https://...",
      "firebaseUid": "abc123...",
      "role": "user",
      "referralCode": "JOHN1234",
      "referredBy": {
        "_id": "65xyz...",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "referralCode": "JANE5678"
      },
      "wallet": {
        "balance": 1500,
        "holdBalance": 0,
        "referralBonus": 500,
        "investedAmount": 10000,
        "commissionEarned": 200
      },
      "kycDetails": {
        "aadharCardNumber": "****-****-1234",
        "panCardNumber": "ABC***1234D",
        "aadharVerified": true,
        "panVerified": true
      },
      "createdAt": "2025-01-01T10:00:00.000Z",
      "lastLogin": "2025-01-07T12:30:00.000Z",
      "isActive": true,
      "level1Count": 5,
      "level2Count": 15
    },
    "level1Referrals": [
      {
        "_id": "65def...",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "phoneNumber": "+919876543211",
        "profilePicture": "https://...",
        "referralCode": "ALICE9012",
        "createdAt": "2025-01-05T14:00:00.000Z",
        "level2Count": 3,
        "level2Users": [
          {
            "_id": "65ghi...",
            "name": "Bob Wilson",
            "email": "bob@example.com",
            "phoneNumber": "+919876543212",
            "createdAt": "2025-01-06T16:00:00.000Z",
            "referredBy": "65def..."
          }
        ]
      }
    ],
    "wishlist": [
      {
        "_id": "65prod1...",
        "name": "Gold Ring 22K",
        "price": 25000,
        "images": ["https://..."],
        "brand": "Tanishq"
      }
    ],
    "cart": [
      {
        "productId": "65prod2...",
        "quantity": 1,
        "variantId": "variant123",
        "installmentPlan": {
          "totalDays": 30,
          "dailyAmount": 100
        },
        "productDetails": {
          "_id": "65prod2...",
          "name": "Silver Necklace",
          "price": 3000,
          "images": ["https://..."],
          "brand": "Joyalukkas",
          "stock": 10
        }
      }
    ],
    "orders": [
      {
        "_id": "65order1...",
        "orderId": "ORD-2025-001",
        "productName": "Gold Chain 22K",
        "status": "ACTIVE",
        "deliveryStatus": "SHIPPED",
        "totalDays": 90,
        "paidInstallments": 45,
        "totalPaidAmount": 45000,
        "remainingAmount": 45000,
        "createdAt": "2024-12-01T10:00:00.000Z"
      }
    ]
  }
}
```

**Use Case:** User detail page with complete information

---

### 4. Get User Orders

**GET** `/api/sales/users/:userId/orders?page=1&limit=10`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "65order1...",
        "orderId": "ORD-2025-001",
        "productName": "Gold Chain 22K",
        "productSnapshot": {
          "productId": "prod123",
          "images": ["https://..."]
        },
        "quantity": 1,
        "pricePerUnit": 90000,
        "totalProductPrice": 90000,
        "totalDays": 90,
        "dailyPaymentAmount": 1000,
        "paidInstallments": 45,
        "totalPaidAmount": 45000,
        "remainingAmount": 45000,
        "status": "ACTIVE",
        "deliveryStatus": "SHIPPED",
        "deliveryAddress": {
          "name": "John Doe",
          "addressLine1": "123 Main St",
          "city": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400001"
        },
        "createdAt": "2024-12-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### 5. Get User Wishlist

**GET** `/api/sales/users/:userId/wishlist`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65prod1...",
      "name": "Gold Ring 22K",
      "price": 25000,
      "finalPrice": 23000,
      "discount": 2000,
      "images": ["https://..."],
      "brand": "Tanishq",
      "stock": 5,
      "isActive": true
    }
  ]
}
```

---

### 6. Get User Cart

**GET** `/api/sales/users/:userId/cart`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "65prod1...",
      "quantity": 1,
      "variantId": "var123",
      "variantDetails": {
        "sku": "SKU123",
        "attributes": {
          "size": "M",
          "color": "Gold"
        },
        "price": 3000
      },
      "installmentPlan": {
        "totalDays": 30,
        "dailyAmount": 100
      },
      "addedAt": "2025-01-05T10:00:00.000Z",
      "product": {
        "_id": "65prod1...",
        "name": "Silver Necklace",
        "price": 3000,
        "finalPrice": 2800,
        "images": ["https://..."],
        "brand": "Joyalukkas",
        "stock": 10
      }
    }
  ]
}
```

---

## Super Admin - Sales Team Management APIs

Only **Super Admin** can create and manage sales team members.

### 7. Get All Sales Team Members

**GET** `/api/admin-mgmt/sales-team`

**Headers:**
```
Authorization: Bearer {super_admin_access_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65sales1...",
      "name": "Sales Person 1",
      "email": "sales1@example.com",
      "isActive": true,
      "createdAt": "2025-01-01T10:00:00.000Z",
      "lastLogin": "2025-01-07T12:00:00.000Z",
      "createdBy": {
        "_id": "65super...",
        "name": "Super Admin",
        "email": "admin@example.com"
      }
    }
  ],
  "count": 5
}
```

---

### 8. Create Sales Team Member

**POST** `/api/admin-mgmt/sales-team`

**Headers:**
```
Authorization: Bearer {super_admin_access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "New Sales Person",
  "email": "newsales@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sales team member created successfully",
  "data": {
    "salesMemberId": "65sales2...",
    "name": "New Sales Person",
    "email": "newsales@example.com",
    "createdAt": "2025-01-07T14:00:00.000Z"
  }
}
```

**Validation Rules:**
- Name, email, password required
- Email must be valid format
- Password minimum 6 characters
- Email must not already exist

---

### 9. Update Sales Team Member

**PUT** `/api/admin-mgmt/sales-team/:salesId`

**Headers:**
```
Authorization: Bearer {super_admin_access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sales team member updated successfully",
  "data": {
    "salesMemberId": "65sales1...",
    "name": "Updated Name",
    "email": "sales1@example.com",
    "isActive": false
  }
}
```

---

### 10. Deactivate Sales Team Member

**DELETE** `/api/admin-mgmt/sales-team/:salesId`

**Headers:**
```
Authorization: Bearer {super_admin_access_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Sales team member deactivated successfully"
}
```

---

### 11. Reset Sales Team Member Password

**POST** `/api/admin-mgmt/sales-team/:salesId/reset-password`

**Headers:**
```
Authorization: Bearer {super_admin_access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "email": "sales1@example.com",
    "temporaryPassword": "newpassword123"
  }
}
```

---

## API Endpoints Summary

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/admin-auth/login` | POST | Public | Login (supports sales_team) |
| `/api/sales/dashboard-stats` | GET | Sales Team+ | Dashboard statistics |
| `/api/sales/users` | GET | Sales Team+ | All users with Level 1 count |
| `/api/sales/users/:userId` | GET | Sales Team+ | User detail with L1, L2, wishlist, cart, orders |
| `/api/sales/users/:userId/orders` | GET | Sales Team+ | User order history |
| `/api/sales/users/:userId/wishlist` | GET | Sales Team+ | User wishlist |
| `/api/sales/users/:userId/cart` | GET | Sales Team+ | User cart |
| `/api/admin-mgmt/sales-team` | GET | Super Admin | List all sales team members |
| `/api/admin-mgmt/sales-team` | POST | Super Admin | Create sales team member |
| `/api/admin-mgmt/sales-team/:id` | PUT | Super Admin | Update sales team member |
| `/api/admin-mgmt/sales-team/:id` | DELETE | Super Admin | Deactivate sales team member |
| `/api/admin-mgmt/sales-team/:id/reset-password` | POST | Super Admin | Reset password |

---

## Error Codes

| Code | Status | Message |
|------|--------|---------|
| `NOT_AUTHENTICATED` | 401 | Authentication required |
| `SALES_TEAM_REQUIRED` | 403 | Access denied. Sales team role required. |
| `SUPER_ADMIN_REQUIRED` | 403 | Access denied. Only Super Admin can perform this action. |
| `MISSING_FIELDS` | 400 | Required fields missing |
| `INVALID_EMAIL` | 400 | Invalid email format |
| `WEAK_PASSWORD` | 400 | Password must be at least 6 characters long |
| `EMAIL_EXISTS` | 400 | Email already registered |
| `REQUEST_NOT_FOUND` | 404 | User/Sales member not found |

---

## Security & Data Access

### Read-Only Access
- ✅ Sales team can VIEW all user data
- ❌ Sales team CANNOT modify users, orders, wallets
- ❌ Sales team CANNOT approve KYC or withdrawals
- ❌ Sales team CANNOT access admin-only endpoints

### Data Filtering
**Included in Responses:**
- Name, email, phone, profile picture
- Referral code, Level 1 & Level 2 counts
- Wallet balance (summary only)
- Wishlist, cart, orders
- KYC status (verified/pending)

**Excluded from Responses:**
- Password (always excluded)
- Bank account numbers (not in sales endpoints)
- KYC document images (Aadhaar, PAN)
- Internal admin notes

---

## Frontend Implementation Examples

### Fetch Dashboard Stats
```javascript
async function fetchDashboardStats() {
  const response = await fetch('/api/sales/dashboard-stats', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const result = await response.json();

  // result.data: { totalUsers, activeOrders, totalRevenue, pendingKYC }
  return result.data;
}
```

### Fetch Users with Search
```javascript
async function fetchUsers(page = 1, search = '') {
  const url = `/api/sales/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const result = await response.json();

  return result.data; // { users: [...], pagination: {...} }
}
```

### Fetch User Detail
```javascript
async function fetchUserDetail(userId) {
  const response = await fetch(`/api/sales/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const result = await response.json();

  // result.data: { user, level1Referrals, wishlist, cart, orders }
  return result.data;
}
```

---

## Implementation Notes

- **Login System:** Same admin panel, role-based routing
- **Database:** No new collections, just new `sales_team` role value
- **Performance:** Pagination enabled, lean() queries for speed
- **Level 2 Tracking:** Shows count and basic info (no commission calculation)
- **Frontend Needed:** Sales dashboard HTML pages (not in backend scope)

---

## Testing

All endpoints have been syntax-checked and are ready for integration testing.

**Test Flow:**
1. Super admin creates sales team member
2. Sales team member logs in via admin panel
3. Redirects to sales dashboard
4. Can view all users, referrals, orders, wishlist, cart
5. Cannot modify any data (read-only)

---

## Support

For questions or issues, contact the backend development team.
