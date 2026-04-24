# Answers to Frontend Team Questions

## 🔴 CRITICAL ANSWERS

### ❓ Question 1: Which Login Endpoint?

**ANSWER: ONE unified endpoint for BOTH super admin and sub-admin**

```
✅ USE THIS FOR ALL LOGINS: POST /api/admin-auth/login
```

**Full URL:**
```
https://api.epielio.com/api/admin-auth/login
```

**Request Body (same for both super admin and sub-admin):**
```json
{
  "email": "admin@epi.com",
  "password": "Admin@123456"
}
```

**How it works:**
- Backend checks the email in database
- Finds the user's role (`super_admin` or `admin`)
- Returns appropriate response with `isSuperAdmin` flag
- Frontend doesn't need to know user type before login

**What about `/api/auth/admin-login`?**
- ❌ **IGNORE THIS** - It's for initial setup only
- Uses environment variables (ADMIN_EMAIL, ADMIN_PASSWORD)
- Auto-creates super admin if doesn't exist
- You can use it ONCE to bootstrap the first super admin
- After that, everyone uses `/api/admin-auth/login`

**Summary:**
```
First time ever: Use /api/auth/admin-login to create super admin
                 (uses env variables)

All subsequent logins: Use /api/admin-auth/login
                       (super admin AND sub-admins)
```

---

### ❓ Question 2: Login Response Structure

**ANSWER: Response is WRAPPED in `{ success, data }`**

**Exact Response Structure:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "64f5a1b2c3d4e5f6g7h8i9j0",
    "name": "Super Administrator",
    "email": "admin@epi.com",
    "role": "super_admin",
    "profilePicture": "",
    "isSuperAdmin": true,
    "modules": [],
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**For Sub-Admin:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "64f5a1b2c3d4e5f6g7h8i9j0",
    "name": "John Manager",
    "email": "john@epi.com",
    "role": "admin",
    "profilePicture": "",
    "isSuperAdmin": false,
    "modules": ["dashboard", "products", "orders"],
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Frontend Code:**
```javascript
const response = await fetch('/api/admin-auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const result = await response.json();

if (result.success) {
  const {
    userId,
    name,
    email,
    role,
    profilePicture,
    isSuperAdmin,
    modules,
    accessToken,
    refreshToken
  } = result.data;  // ← Data is inside result.data

  // Store tokens
  localStorage.setItem('adminToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}
```

---

### ❓ Question 3: Module Field Name - `modules` or `moduleAccess`?

**ANSWER: Use `modules` in frontend, backend handles both**

**Standardized Field Names:**

| Context | Field Name | Example |
|---------|-----------|---------|
| **Login Response** | `modules` | `{ data: { modules: [...] } }` |
| **Create Sub-Admin Request** | `moduleAccess` | `{ moduleAccess: [...] }` |
| **Update Sub-Admin Request** | `moduleAccess` | `{ moduleAccess: [...] }` |
| **Get Sub-Admins Response** | `moduleAccess` | `{ moduleAccess: [...] }` |

**Why different?**
- Login returns `modules` (user-facing)
- CRUD operations use `moduleAccess` (database field name)

**Frontend Implementation:**

```javascript
// 1. After Login - Use "modules"
const loginResponse = {
  success: true,
  data: {
    modules: ["dashboard", "products", "orders"]  // ← Use this
  }
};

// Store it
localStorage.setItem('userModules', JSON.stringify(loginResponse.data.modules));

// 2. Creating Sub-Admin - Use "moduleAccess"
await fetch('/api/admin-mgmt/sub-admins', {
  method: 'POST',
  body: JSON.stringify({
    name: "John",
    email: "john@epi.com",
    password: "Pass123",
    moduleAccess: ["products", "orders"]  // ← Use this
  })
});

// 3. Updating Sub-Admin - Use "moduleAccess"
await fetch('/api/admin-mgmt/sub-admins/123', {
  method: 'PUT',
  body: JSON.stringify({
    moduleAccess: ["products", "orders", "categories"]  // ← Use this
  })
});

// 4. Display Sub-Admin List - Read "moduleAccess"
const subAdmins = await fetch('/api/admin-mgmt/sub-admins');
const data = await subAdmins.json();
// data.data[0].moduleAccess ← Array of modules
```

**Summary:**
```
Login response          → modules
Create/Update requests  → moduleAccess
Get sub-admins response → moduleAccess
```

---

### ❓ Question 4: First Super Admin Creation

**ANSWER: Two methods available**

#### Method 1: Auto-Create on First Use (Recommended)

**Endpoint:** `POST /api/auth/admin-login`

**Default Credentials:**
```
Email: admin@epi.com
Password: Admin@123456
```

**Or use Environment Variables:**
```env
ADMIN_EMAIL=youremail@company.com
ADMIN_PASSWORD=YourSecurePassword123
ADMIN_NAME=Your Name
```

**How it works:**
```
1. You call /api/auth/admin-login with default credentials
2. Backend checks if user exists
3. If doesn't exist, creates super admin automatically
4. Returns login response with tokens
```

**Testing:**
```bash
curl -X POST https://api.epielio.com/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@epi.com","password":"Admin@123456"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "userId": "...",
    "name": "Admin",
    "email": "admin@epi.com",
    "role": "super_admin",
    "profilePicture": "",
    "isSuperAdmin": true,
    "modules": [],
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

#### Method 2: After First Login

**Once super admin exists, everyone uses:**
```
POST /api/admin-auth/login
```

**Recommendation:**
1. First time: Use `/api/auth/admin-login` to bootstrap
2. Share credentials with super admin
3. Super admin logs in using `/api/admin-auth/login`
4. Super admin can now create sub-admins

---

### ❓ Question 5: Dashboard Auto-Include

**ANSWER: Backend AUTOMATICALLY adds "dashboard"**

**What You Send:**
```json
{
  "moduleAccess": ["products", "orders"]
}
```

**What Backend Stores:**
```json
{
  "moduleAccess": ["dashboard", "products", "orders"]
}
```

**Backend Code Logic:**
```javascript
// Backend automatically does this:
const modulesWithDashboard = moduleAccess.includes('dashboard')
  ? moduleAccess
  : ['dashboard', ...moduleAccess];
```

**Frontend Best Practice:**

**Option 1: Don't send dashboard (recommended)**
```javascript
// Backend adds it automatically
const selectedModules = ["products", "orders", "categories"];
// Backend stores: ["dashboard", "products", "orders", "categories"]
```

**Option 2: Include dashboard explicitly**
```javascript
// You can include it if you want
const selectedModules = ["dashboard", "products", "orders"];
// Backend stores: ["dashboard", "products", "orders"]
```

**Both work! Backend ensures dashboard is always present.**

**Edge Case - What if we don't want dashboard?**
- Not supported currently
- Dashboard is mandatory for all admins
- Every admin needs dashboard access

---

### ❓ Question 6: API Base Path

**ANSWER: Correct base path is `https://api.epielio.com/api`**

**Complete Endpoint URLs:**

| Endpoint | Full URL |
|----------|----------|
| Admin Login (unified) | `https://api.epielio.com/api/admin-auth/login` |
| Get All Sub-Admins | `https://api.epielio.com/api/admin-mgmt/sub-admins` |
| Create Sub-Admin | `https://api.epielio.com/api/admin-mgmt/sub-admins` |
| Get Single Sub-Admin | `https://api.epielio.com/api/admin-mgmt/sub-admins/{id}` |
| Update Sub-Admin | `https://api.epielio.com/api/admin-mgmt/sub-admins/{id}` |
| Delete Sub-Admin | `https://api.epielio.com/api/admin-mgmt/sub-admins/{id}` |
| Reset Password | `https://api.epielio.com/api/admin-mgmt/sub-admins/{id}/reset-password` |
| Get My Modules | `https://api.epielio.com/api/admin-mgmt/my-modules` |

**Legacy Endpoint (for initial setup only):**
| Endpoint | Full URL | Note |
|----------|----------|------|
| Admin Login (legacy) | `https://api.epielio.com/api/auth/admin-login` | Use once to bootstrap first super admin |

**Frontend Config:**
```javascript
const API_CONFIG = {
  BASE_URL: 'https://api.epielio.com/api',
  ENDPOINTS: {
    ADMIN_LOGIN: '/admin-auth/login',
    SUB_ADMINS: '/admin-mgmt/sub-admins',
    MY_MODULES: '/admin-mgmt/my-modules'
  }
};

// Usage
const loginUrl = API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.ADMIN_LOGIN;
// Result: https://api.epielio.com/api/admin-auth/login
```

---

### ❓ Question 7: Token Refresh Flow

**ANSWER: Token refresh endpoint EXISTS**

**Endpoint:** `POST /api/auth/refresh-token`

**Full URL:** `https://api.epielio.com/api/auth/refresh-token`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_access_token...",
    "refreshToken": "new_refresh_token..."
  }
}
```

**Token Expiry Times:**
- `accessToken`: 7 days
- `refreshToken`: 30 days

**Implementation Strategy:**

#### Option 1: Automatic Token Refresh (Recommended)
```javascript
// interceptor.js
async function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem('adminToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });

  // If token expired
  if (response.status === 401) {
    const errorData = await response.json();

    if (errorData.code === 'TOKEN_EXPIRED') {
      // Try to refresh token
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry original request with new token
        const newToken = localStorage.getItem('adminToken');
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      } else {
        // Refresh failed, redirect to login
        window.location.href = '/admin/login.html';
      }
    }
  }

  return response;
}

async function refreshAccessToken() {
  try {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      return false;
    }

    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();

    if (data.success) {
      // Store new tokens
      localStorage.setItem('adminToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}
```

#### Option 2: Manual Re-Login (Simpler)
```javascript
// When token expires, just redirect to login
if (response.status === 401) {
  alert('Session expired. Please login again.');
  window.location.href = '/admin/login.html';
}
```

**Recommendation:**
- For admin panels, **manual re-login** is usually fine
- Token lasts 7 days, so rarely expires during active use
- Simpler implementation, less complexity
- But automatic refresh provides better UX

---

## 📊 Complete API Reference Summary

### Authentication Endpoints

| Endpoint | Method | Purpose | Request Body |
|----------|--------|---------|--------------|
| `/api/admin-auth/login` | POST | Login (super admin & sub-admin) | `{ email, password }` |
| `/api/auth/refresh-token` | POST | Refresh access token | `{ refreshToken }` |
| `/api/auth/admin-login` | POST | Bootstrap first super admin (legacy) | `{ email, password }` |

### Sub-Admin Management (Require Super Admin)

| Endpoint | Method | Purpose | Request Body |
|----------|--------|---------|--------------|
| `/api/admin-mgmt/sub-admins` | GET | Get all sub-admins | - |
| `/api/admin-mgmt/sub-admins` | POST | Create sub-admin | `{ name, email, password, moduleAccess }` |
| `/api/admin-mgmt/sub-admins/:id` | GET | Get single sub-admin | - |
| `/api/admin-mgmt/sub-admins/:id` | PUT | Update sub-admin | `{ name?, moduleAccess?, isActive? }` |
| `/api/admin-mgmt/sub-admins/:id` | DELETE | Deactivate sub-admin | - |
| `/api/admin-mgmt/sub-admins/:id/reset-password` | POST | Reset password | `{ newPassword }` |
| `/api/admin-mgmt/my-modules` | GET | Get current user's modules | - |

---

## 🎯 Quick Reference

### Field Name Cheat Sheet
```
Login Response:
  ✅ data.modules

Create/Update Sub-Admin:
  ✅ moduleAccess (in request body)

Sub-Admin List Response:
  ✅ item.moduleAccess
```

### Endpoint Cheat Sheet
```
All Logins (super admin + sub-admin):
  ✅ POST /api/admin-auth/login

Sub-Admin CRUD:
  ✅ /api/admin-mgmt/sub-admins

Token Refresh:
  ✅ POST /api/auth/refresh-token

Bootstrap First Super Admin (one-time):
  ✅ POST /api/auth/admin-login
```

### Token Expiry
```
Access Token:  7 days
Refresh Token: 30 days
```

### Dashboard Module
```
✅ Backend automatically includes "dashboard"
✅ You can send or omit - doesn't matter
✅ Always present in response
```

---

## ✅ Implementation Checklist

- [ ] Use `/api/admin-auth/login` for all logins
- [ ] Access response data via `result.data.accessToken`
- [ ] Use `modules` from login, `moduleAccess` for CRUD
- [ ] Don't worry about dashboard - backend adds it
- [ ] Use full URL: `https://api.epielio.com/api/...`
- [ ] Store both `accessToken` and `refreshToken`
- [ ] Implement token refresh or re-login on expiry

---

## 🆘 Still Have Questions?

Test the endpoints with these curl commands:

### Test Login
```bash
curl -X POST https://api.epielio.com/api/admin-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@epi.com","password":"Admin@123456"}'
```

### Test Create Sub-Admin
```bash
curl -X POST https://api.epielio.com/api/admin-mgmt/sub-admins \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test User",
    "email":"test@epi.com",
    "password":"Test123",
    "moduleAccess":["products","orders"]
  }'
```

### Test Get Sub-Admins
```bash
curl -X GET https://api.epielio.com/api/admin-mgmt/sub-admins \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Summary

1. ✅ **One login endpoint** for everyone: `/api/admin-auth/login`
2. ✅ **Response wrapped** in `{ success, data }`
3. ✅ **Use `modules` after login**, `moduleAccess` for CRUD
4. ✅ **Dashboard auto-included** by backend
5. ✅ **Full URL**: `https://api.epielio.com/api/...`
6. ✅ **Token refresh available** at `/api/auth/refresh-token`

**You're ready to implement! 🚀**
