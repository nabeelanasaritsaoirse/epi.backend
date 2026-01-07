# Admin Registration Request System - API Guide

## Overview

Yeh system sub-admin registration requests ko handle karta hai. New admins khud register kar sakte hain, aur Super Admin unhe approve ya reject kar sakta hai.

---

## Architecture

### Flow Diagram

```
1. User Registration
   ↓
   POST /api/admin-auth/register-request (Public)
   ↓
   AdminRegistrationRequest created (status: pending)
   ↓
2. Super Admin Review
   ↓
   GET /api/admin-mgmt/registration-requests?status=pending
   ↓
   Super Admin decides: Approve or Reject
   ↓
3a. Approval Path                    3b. Rejection Path
   ↓                                    ↓
   POST .../approve                     POST .../reject
   ↓                                    ↓
   User created in DB                   Request marked rejected
   role: 'admin'                        User can re-register
   moduleAccess assigned
   ↓
4. New Admin Login
   ↓
   POST /api/admin-auth/login
   ↓
   Success (with assigned modules)
```

---

## API Endpoints

### 1. Submit Registration Request

**Endpoint:** `POST /api/admin-auth/register-request`
**Access:** Public (No authentication required)
**Purpose:** Naye admin apna registration request submit kar sakte hain

#### Request Body

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

#### Validation Rules

- ✅ Name required (non-empty)
- ✅ Email valid format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- ✅ Password minimum 6 characters
- ✅ Email NOT already registered as admin
- ✅ No pending request for same email

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Registration request submitted successfully. Please wait for admin approval.",
  "data": {
    "requestId": "65abc123def456...",
    "email": "john@example.com",
    "status": "pending",
    "requestedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

#### Error Responses

| Status | Code | Message | Reason |
|--------|------|---------|--------|
| 400 | `MISSING_FIELDS` | Name, email, and password are required | Missing fields |
| 400 | `INVALID_EMAIL` | Invalid email format | Email regex fail |
| 400 | `WEAK_PASSWORD` | Password must be at least 6 characters long | Password too short |
| 400 | `EMAIL_EXISTS` | Email already registered as admin | Email in User collection |
| 400 | `REQUEST_PENDING` | Registration request already pending for this email | Duplicate pending request |
| 500 | - | Failed to submit registration request | Server error |

#### Frontend Example

```javascript
async function registerAdmin(formData) {
  try {
    const response = await fetch('http://localhost:8080/api/admin-auth/register-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        password: formData.password
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Registration request submitted! Please wait for admin approval.');
      // Redirect to login or confirmation page
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Registration failed:', error);
    alert('Failed to submit registration request');
  }
}
```

---

### 2. Get All Registration Requests

**Endpoint:** `GET /api/admin-mgmt/registration-requests`
**Access:** Super Admin only
**Purpose:** Sab registration requests ko list karna with filtering

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `pending` | Filter: `pending`, `approved`, `rejected`, `all` |
| `page` | number | `1` | Page number for pagination |
| `limit` | number | `20` | Items per page |

#### Request Headers

```
Authorization: Bearer <super_admin_access_token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "65abc123...",
        "name": "John Doe",
        "email": "john@example.com",
        "status": "pending",
        "requestedAt": "2025-01-07T10:30:00.000Z",
        "reviewedAt": null,
        "reviewedBy": null,
        "rejectionReason": null,
        "approvedAdminId": null
      },
      {
        "_id": "65abc456...",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "status": "approved",
        "requestedAt": "2025-01-06T15:20:00.000Z",
        "reviewedAt": "2025-01-07T09:00:00.000Z",
        "reviewedBy": {
          "_id": "65xyz...",
          "name": "Super Admin",
          "email": "admin@example.com"
        },
        "approvedAdminId": {
          "_id": "65pqr...",
          "name": "Jane Smith",
          "email": "jane@example.com"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 401 | `NOT_AUTHENTICATED` | Authentication required |
| 403 | `SUPER_ADMIN_REQUIRED` | Access denied. Only Super Admin can perform this action. |
| 500 | - | Failed to fetch registration requests |

#### Frontend Example

```javascript
async function fetchPendingRequests(accessToken, page = 1) {
  try {
    const response = await fetch(
      `http://localhost:8080/api/admin-mgmt/registration-requests?status=pending&page=${page}&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      return result.data; // { requests: [...], pagination: {...} }
    }
  } catch (error) {
    console.error('Failed to fetch requests:', error);
  }
}
```

---

### 3. Get Single Registration Request

**Endpoint:** `GET /api/admin-mgmt/registration-requests/:requestId`
**Access:** Super Admin only
**Purpose:** Ek specific request ki complete details

#### URL Parameters

- `requestId` - The MongoDB ObjectId of the request

#### Request Headers

```
Authorization: Bearer <super_admin_access_token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "_id": "65abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "pending",
    "requestedAt": "2025-01-07T10:30:00.000Z",
    "reviewedAt": null,
    "reviewedBy": null,
    "rejectionReason": null,
    "approvedAdminId": null,
    "createdAt": "2025-01-07T10:30:00.000Z",
    "updatedAt": "2025-01-07T10:30:00.000Z"
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 404 | `REQUEST_NOT_FOUND` | Registration request not found |
| 401 | `NOT_AUTHENTICATED` | Authentication required |
| 403 | `SUPER_ADMIN_REQUIRED` | Access denied |
| 500 | - | Failed to fetch registration request |

---

### 4. Approve Registration Request

**Endpoint:** `POST /api/admin-mgmt/registration-requests/:requestId/approve`
**Access:** Super Admin only
**Purpose:** Request approve karke naya admin user create karna

#### URL Parameters

- `requestId` - The request ID to approve

#### Request Headers

```
Authorization: Bearer <super_admin_access_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "moduleAccess": ["dashboard", "products", "orders", "categories"]
}
```

**Note:**
- `moduleAccess` array required hai (can be empty `[]` for full access)
- Dashboard automatically include ho jata hai agar missing hai
- Frontend ki responsibility hai ki valid modules bheje

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Registration request approved and admin created successfully",
  "data": {
    "adminId": "65xyz789...",
    "email": "john@example.com",
    "name": "John Doe",
    "moduleAccess": ["dashboard", "products", "orders", "categories"],
    "createdAt": "2025-01-07T11:00:00.000Z"
  }
}
```

#### What Happens Behind the Scenes

1. ✅ Request validation (exists, status=pending)
2. ✅ Double-check email not already admin
3. ✅ Start MongoDB transaction
4. ✅ Create User with:
   - `role: 'admin'`
   - `password` from request (already hashed)
   - `moduleAccess` from request body
   - `createdBy: super_admin._id`
   - `isActive: true`
   - `firebaseUid: admin_<random>`
5. ✅ Update AdminRegistrationRequest:
   - `status: 'approved'`
   - `reviewedAt: now`
   - `reviewedBy: super_admin._id`
   - `approvedAdminId: new_admin._id`
6. ✅ Commit transaction

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_MODULE_ACCESS` | moduleAccess array is required |
| 404 | `REQUEST_NOT_FOUND` | Registration request not found |
| 400 | `REQUEST_ALREADY_PROCESSED` | Request already approved/rejected |
| 400 | `EMAIL_EXISTS` | Email already registered as admin |
| 401 | `NOT_AUTHENTICATED` | Authentication required |
| 403 | `SUPER_ADMIN_REQUIRED` | Access denied |
| 500 | - | Failed to approve registration request |

#### Frontend Example

```javascript
async function approveRequest(requestId, selectedModules, accessToken) {
  try {
    const response = await fetch(
      `http://localhost:8080/api/admin-mgmt/registration-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          moduleAccess: selectedModules // e.g., ['dashboard', 'products']
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      alert('Admin created successfully!');
      // Refresh pending requests list
    } else {
      alert(`Error: ${result.message}`);
    }
  } catch (error) {
    console.error('Approval failed:', error);
  }
}
```

---

### 5. Reject Registration Request

**Endpoint:** `POST /api/admin-mgmt/registration-requests/:requestId/reject`
**Access:** Super Admin only
**Purpose:** Request ko reject karna with optional reason

#### URL Parameters

- `requestId` - The request ID to reject

#### Request Headers

```
Authorization: Bearer <super_admin_access_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "reason": "Email domain not allowed"
}
```

**Note:** `reason` is optional

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Registration request rejected",
  "data": {
    "requestId": "65abc123...",
    "email": "john@example.com",
    "status": "rejected",
    "rejectionReason": "Email domain not allowed"
  }
}
```

#### What Happens

1. ✅ Find request, verify status=pending
2. ✅ Update:
   - `status: 'rejected'`
   - `reviewedAt: now`
   - `reviewedBy: super_admin._id`
   - `rejectionReason` (if provided)
3. ✅ User CAN re-register with same email later (no blacklist)

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 404 | `REQUEST_NOT_FOUND` | Registration request not found |
| 400 | `REQUEST_ALREADY_PROCESSED` | Request already approved/rejected |
| 401 | `NOT_AUTHENTICATED` | Authentication required |
| 403 | `SUPER_ADMIN_REQUIRED` | Access denied |
| 500 | - | Failed to reject registration request |

#### Frontend Example

```javascript
async function rejectRequest(requestId, reason, accessToken) {
  try {
    const response = await fetch(
      `http://localhost:8080/api/admin-mgmt/registration-requests/${requestId}/reject`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || undefined // Optional
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      alert('Request rejected');
      // Refresh list
    }
  } catch (error) {
    console.error('Rejection failed:', error);
  }
}
```

---

## Database Schema

### AdminRegistrationRequest Model

```javascript
{
  name: String (required),
  email: String (required, lowercase, validated),
  password: String (required, bcrypt hashed),
  status: Enum ['pending', 'approved', 'rejected'] (default: 'pending'),
  requestedAt: Date (auto: Date.now),
  reviewedAt: Date (nullable),
  reviewedBy: ObjectId -> User (nullable),
  rejectionReason: String (nullable),
  approvedAdminId: ObjectId -> User (nullable),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- `{ email: 1, status: 1 }` - Compound index for pending checks
- `{ status: 1 }` - For filtering
- `{ requestedAt: -1 }` - For sorting

---

## Frontend Integration Checklist

### Registration Screen (Public)

- [ ] Form with: Name, Email, Password fields
- [ ] Client-side validation (email format, password >= 6 chars)
- [ ] Submit to `POST /api/admin-auth/register-request`
- [ ] Show success message: "Request submitted, wait for approval"
- [ ] Handle errors (duplicate email, weak password, etc.)

### Super Admin Dashboard - Pending Requests

- [ ] Fetch pending requests on mount
- [ ] Display table: Name, Email, Requested Date
- [ ] Approve button → Shows module selection dialog
- [ ] Reject button → Optional reason input
- [ ] Pagination controls
- [ ] Filter: Pending / Approved / Rejected / All
- [ ] Real-time refresh or manual refresh button

### Module Selection Dialog (On Approve)

- [ ] Checkboxes for available modules
- [ ] Dashboard auto-selected (or auto-added on backend)
- [ ] Submit to approve endpoint with selected modules
- [ ] Show success/error messages

---

## Security Features

✅ **Password Security:** Bcrypt hashing (10 salt rounds)
✅ **Email Validation:** Regex + lowercase normalization
✅ **Duplicate Prevention:** Unique pending request per email
✅ **Role Validation:** Only super_admin can approve/reject
✅ **Transaction Safety:** Approve uses MongoDB transactions
✅ **Input Sanitization:** Trim whitespace on name/email
✅ **No Password Exposure:** Never return password hash in responses

---

## Testing Guide

### Manual Testing Steps

1. **Test Registration:**
   ```bash
   curl -X POST http://localhost:8080/api/admin-auth/register-request \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","password":"testpass123"}'
   ```

2. **List Pending (as Super Admin):**
   ```bash
   curl http://localhost:8080/api/admin-mgmt/registration-requests?status=pending \
     -H "Authorization: Bearer <super_admin_token>"
   ```

3. **Approve Request:**
   ```bash
   curl -X POST http://localhost:8080/api/admin-mgmt/registration-requests/<request_id>/approve \
     -H "Authorization: Bearer <super_admin_token>" \
     -H "Content-Type: application/json" \
     -d '{"moduleAccess":["dashboard","products"]}'
   ```

4. **Login as New Admin:**
   ```bash
   curl -X POST http://localhost:8080/api/admin-auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123"}'
   ```

### Automated Test Script

```bash
node scripts/testRegistrationFlow.js
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Email already registered" | User already exists with admin/super_admin role |
| "Request already pending" | Delete old pending request or wait for review |
| "SUPER_ADMIN_REQUIRED" | Ensure logged-in user has `role: 'super_admin'` |
| "Request already processed" | Cannot approve/reject already approved/rejected requests |
| Password not working after approval | Ensure password was hashed before storing in request |

---

## Future Enhancements (Not Implemented)

- ❌ Email notifications on approval/rejection
- ❌ Email verification before request creation
- ❌ Rate limiting on registration endpoint
- ❌ Blacklist for permanently banned emails
- ❌ Request expiration (auto-delete old pending requests)
- ❌ Admin activity logs (who approved whom)

---

## Summary

✅ **5 New Endpoints** - 1 public, 4 super-admin-only
✅ **New Model** - AdminRegistrationRequest collection
✅ **Transaction Safety** - Approval uses atomic operations
✅ **Proper Error Handling** - All edge cases covered
✅ **Same Code Structure** - Follows existing patterns
✅ **Frontend Ready** - Complete API documentation

**Routes Added:**
1. `POST /api/admin-auth/register-request` (Public)
2. `GET /api/admin-mgmt/registration-requests` (Super Admin)
3. `GET /api/admin-mgmt/registration-requests/:id` (Super Admin)
4. `POST /api/admin-mgmt/registration-requests/:id/approve` (Super Admin)
5. `POST /api/admin-mgmt/registration-requests/:id/reject` (Super Admin)
