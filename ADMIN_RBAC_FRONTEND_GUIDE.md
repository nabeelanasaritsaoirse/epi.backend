# Admin Role-Based Access Control (RBAC) - Frontend Integration Guide

## 🎯 Overview

This document explains how to integrate the backend RBAC system into your admin panel frontend. The system allows **Super Admin** to create sub-admins and control which sidebar modules they can access.

---

## 📋 Key Concepts

### 1. **Super Admin**
- Has access to **ALL modules** automatically
- Can create/edit/delete sub-admins
- Can assign modules to sub-admins
- Sees "Admin Management" section in sidebar (sub-admins don't see this)

### 2. **Sub-Admin**
- Has access only to assigned modules
- Cannot see or access "Admin Management"
- Cannot create other admins

### 3. **Modules**
- **You define the modules** in your frontend (e.g., `products`, `orders`, `categories`, etc.)
- Backend just stores whatever array you send
- No validation on backend - full frontend control
- If you add a new sidebar item, just include it in the array - **no backend changes needed**

---

## 🔐 How It Works

### Flow 1: Super Admin Creates First Account
```
1. Super admin uses existing endpoint: POST /api/auth/admin-login
   - Email: From env (ADMIN_EMAIL) or default: admin@epi.com
   - Password: From env (ADMIN_PASSWORD) or default: Admin@123456

2. This endpoint auto-creates super admin if doesn't exist

3. Response includes:
   {
     role: "super_admin",
     isSuperAdmin: true,
     modules: []  // Empty array means show ALL modules
   }
```

### Flow 2: Super Admin Creates Sub-Admin
```
1. Super admin goes to "Admin Management" page

2. Clicks "Create Sub-Admin" button

3. Modal opens with:
   - Name input
   - Email input
   - Password input
   - Module checkboxes (you define these in frontend!)

4. Super admin checks modules:
   ☑ Products
   ☑ Orders
   ☐ KYC
   ☐ Users

5. Frontend sends:
   POST /api/admin-mgmt/sub-admins
   {
     "name": "John Manager",
     "email": "john@epi.com",
     "password": "TempPass123",
     "moduleAccess": ["products", "orders"]
   }

6. Backend creates sub-admin and returns success

7. Super admin shares credentials with John
```

### Flow 3: Sub-Admin Logs In
```
1. Sub-admin opens login page

2. Enters credentials: john@epi.com / TempPass123

3. Frontend calls:
   POST /api/admin-auth/login
   {
     "email": "john@epi.com",
     "password": "TempPass123"
   }

4. Backend returns:
   {
     "success": true,
     "data": {
       "userId": "...",
       "name": "John Manager",
       "email": "john@epi.com",
       "role": "admin",
       "isSuperAdmin": false,
       "modules": ["products", "orders"],
       "accessToken": "...",
       "refreshToken": "..."
     }
   }

5. Frontend stores this data

6. Sidebar renders only "Dashboard", "Products", "Orders"
   (hides KYC, Users, Admin Management, etc.)
```

---

## 🔌 API Endpoints

### Authentication

#### 1. Admin Login (Email/Password)
```http
POST /api/admin-auth/login
Content-Type: application/json

{
  "email": "admin@epi.com",
  "password": "Admin@123456"
}
```

**Success Response:**
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
  "data": {
    "userId": "...",
    "name": "John Manager",
    "email": "john@epi.com",
    "role": "admin",
    "isSuperAdmin": false,
    "modules": ["products", "orders", "categories"],
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

### Sub-Admin Management (Super Admin Only)

#### 2. Get All Sub-Admins
```http
GET /api/admin-mgmt/sub-admins
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "John Manager",
      "email": "john@epi.com",
      "moduleAccess": ["products", "orders"],
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLogin": "2024-01-16T09:15:00Z",
      "createdBy": {
        "_id": "...",
        "name": "Super Admin",
        "email": "admin@epi.com"
      }
    }
  ],
  "count": 1
}
```

#### 3. Create Sub-Admin
```http
POST /api/admin-mgmt/sub-admins
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "John Manager",
  "email": "john@epi.com",
  "password": "TempPass123",
  "moduleAccess": ["products", "orders", "categories"]
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Sub-admin created successfully",
  "data": {
    "_id": "...",
    "name": "John Manager",
    "email": "john@epi.com",
    "role": "admin",
    "moduleAccess": ["dashboard", "products", "orders", "categories"],
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Note:** Backend automatically adds "dashboard" to moduleAccess if not included.

#### 4. Get Single Sub-Admin
```http
GET /api/admin-mgmt/sub-admins/{adminId}
Authorization: Bearer {accessToken}
```

#### 5. Update Sub-Admin
```http
PUT /api/admin-mgmt/sub-admins/{adminId}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "John Updated",
  "moduleAccess": ["products", "orders", "kyc"],
  "isActive": true
}
```

#### 6. Delete Sub-Admin (Soft Delete)
```http
DELETE /api/admin-mgmt/sub-admins/{adminId}
Authorization: Bearer {accessToken}
```

**Note:** This deactivates the account (sets `isActive: false`), doesn't delete from database.

#### 7. Reset Sub-Admin Password
```http
POST /api/admin-mgmt/sub-admins/{adminId}/reset-password
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "newPassword": "NewSecurePass456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "email": "john@epi.com",
    "newPassword": "NewSecurePass456"
  }
}
```

**Note:** Backend returns the plain password so super admin can share it with the sub-admin.

#### 8. Get My Modules (Current User)
```http
GET /api/admin-mgmt/my-modules
Authorization: Bearer {accessToken}
```

**Response for Super Admin:**
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "name": "Super Admin",
    "email": "admin@epi.com",
    "role": "super_admin",
    "isSuperAdmin": true,
    "modules": []
  }
}
```

**Response for Sub-Admin:**
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "name": "John Manager",
    "email": "john@epi.com",
    "role": "admin",
    "isSuperAdmin": false,
    "modules": ["products", "orders", "categories"]
  }
}
```

---

## 💻 Frontend Implementation

### 1. Login Page

```javascript
// login.js

async function handleAdminLogin(email, password) {
  try {
    const response = await fetch('/api/admin-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store in localStorage
      localStorage.setItem('adminToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('adminUser', JSON.stringify({
        userId: data.data.userId,
        name: data.data.name,
        email: data.data.email,
        role: data.data.role,
        isSuperAdmin: data.data.isSuperAdmin,
        modules: data.data.modules
      }));

      // Redirect to dashboard
      window.location.href = '/admin/dashboard.html';
    } else {
      alert(data.message);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed. Please try again.');
  }
}
```

### 2. Auth Helper Functions

```javascript
// auth.js

const AUTH = {
  getToken() {
    return localStorage.getItem('adminToken');
  },

  getUser() {
    const userStr = localStorage.getItem('adminUser');
    return userStr ? JSON.parse(userStr) : null;
  },

  isSuperAdmin() {
    const user = this.getUser();
    return user?.isSuperAdmin === true;
  },

  hasModule(moduleName) {
    const user = this.getUser();

    // Super admin has access to ALL modules
    if (user?.isSuperAdmin) {
      return true;
    }

    // Sub-admin only has assigned modules
    return user?.modules?.includes(moduleName) || false;
  },

  getModules() {
    const user = this.getUser();
    return user?.modules || [];
  },

  logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login.html';
  }
};
```

### 3. Sidebar Navigation

```javascript
// navigation.js

function renderSidebar() {
  // Define all possible sidebar items
  // YOU control this list - backend doesn't validate it
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', url: '/admin/dashboard.html' },
    { id: 'users', label: 'User Management', icon: '👥', url: '/admin/users.html' },
    { id: 'wallet', label: 'Wallet', icon: '💰', url: '/admin/wallet.html' },
    { id: 'kyc', label: 'KYC Verification', icon: '✅', url: '/admin/kyc.html' },
    { id: 'categories', label: 'Categories', icon: '📁', url: '/admin/categories.html' },
    { id: 'products', label: 'Products', icon: '📦', url: '/admin/products.html' },
    { id: 'orders', label: 'Orders', icon: '🛒', url: '/admin/orders.html' },
    { id: 'analytics', label: 'Analytics', icon: '📈', url: '/admin/analytics.html' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', url: '/admin/notifications.html' },
    { id: 'chat', label: 'Support Chat', icon: '💬', url: '/admin/chat.html' },
    { id: 'banners', label: 'Banners', icon: '🖼️', url: '/admin/banners.html' },
    { id: 'coupons', label: 'Coupons', icon: '🎟️', url: '/admin/coupons.html' },
    { id: 'stories', label: 'Success Stories', icon: '⭐', url: '/admin/stories.html' },
    { id: 'settings', label: 'Settings', icon: '⚙️', url: '/admin/settings.html' },

    // Admin Management - ONLY for super admin
    {
      id: 'admin_management',
      label: 'Admin Management',
      icon: '👨‍💼',
      url: '/admin/admin-management.html',
      superAdminOnly: true  // Special flag
    }
  ];

  // Filter based on user's access
  const visibleItems = allMenuItems.filter(item => {
    // Super admin-only items
    if (item.superAdminOnly) {
      return AUTH.isSuperAdmin();
    }

    // Regular module access
    return AUTH.hasModule(item.id);
  });

  // Render sidebar
  const sidebarHTML = visibleItems.map(item => `
    <a href="${item.url}" class="nav-item">
      <span class="icon">${item.icon}</span>
      <span class="label">${item.label}</span>
    </a>
  `).join('');

  document.getElementById('sidebar').innerHTML = sidebarHTML;
}

// Call on page load
document.addEventListener('DOMContentLoaded', renderSidebar);
```

### 4. Page Access Guard

Add this to **EVERY admin page** (products.html, orders.html, etc.):

```html
<script src="/assets/js/auth.js"></script>
<script>
// Check authentication
if (!AUTH.getToken()) {
  window.location.href = '/admin/login.html';
}

// Check module access
const CURRENT_MODULE = 'products'; // Change this for each page

if (!AUTH.hasModule(CURRENT_MODULE)) {
  alert('You do not have access to this module');
  window.location.href = '/admin/dashboard.html';
}
</script>
```

### 5. Admin Management Page (Super Admin Only)

```html
<!-- admin-management.html -->

<script src="/assets/js/auth.js"></script>
<script>
// Only super admin can access this page
if (!AUTH.isSuperAdmin()) {
  alert('Access denied. Super admin only.');
  window.location.href = '/admin/dashboard.html';
}
</script>

<div class="admin-management-page">
  <h1>Admin Management</h1>

  <button onclick="openCreateModal()">Create Sub-Admin</button>

  <table id="subAdminsTable">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Modules</th>
        <th>Status</th>
        <th>Last Login</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <!-- Populated by loadSubAdmins() -->
    </tbody>
  </table>
</div>

<!-- Create/Edit Modal -->
<div id="adminModal" class="modal">
  <div class="modal-content">
    <h2 id="modalTitle">Create Sub-Admin</h2>

    <input type="text" id="adminName" placeholder="Name" required>
    <input type="email" id="adminEmail" placeholder="Email" required>
    <input type="password" id="adminPassword" placeholder="Password" required>

    <div class="module-selection">
      <h3>Select Modules</h3>
      <label>
        <input type="checkbox" value="dashboard" checked disabled>
        Dashboard (Required)
      </label>
      <label>
        <input type="checkbox" value="users">
        User Management
      </label>
      <label>
        <input type="checkbox" value="products">
        Products
      </label>
      <label>
        <input type="checkbox" value="orders">
        Orders
      </label>
      <label>
        <input type="checkbox" value="categories">
        Categories
      </label>
      <label>
        <input type="checkbox" value="kyc">
        KYC Verification
      </label>
      <!-- Add more checkboxes for each module -->
    </div>

    <button onclick="saveAdmin()">Save</button>
    <button onclick="closeModal()">Cancel</button>
  </div>
</div>

<script src="/assets/js/admin-management.js"></script>
```

```javascript
// admin-management.js

async function loadSubAdmins() {
  const token = AUTH.getToken();

  const response = await fetch('/api/admin-mgmt/sub-admins', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (data.success) {
    displaySubAdmins(data.data);
  }
}

function displaySubAdmins(admins) {
  const tbody = document.querySelector('#subAdminsTable tbody');

  tbody.innerHTML = admins.map(admin => `
    <tr>
      <td>${admin.name}</td>
      <td>${admin.email}</td>
      <td>${admin.moduleAccess.length} modules</td>
      <td>
        <span class="badge ${admin.isActive ? 'active' : 'inactive'}">
          ${admin.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</td>
      <td>
        <button onclick="editAdmin('${admin._id}')">Edit</button>
        <button onclick="resetPassword('${admin._id}')">Reset Password</button>
        <button onclick="deleteAdmin('${admin._id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function createAdmin() {
  const name = document.getElementById('adminName').value;
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;

  // Get selected modules
  const checkboxes = document.querySelectorAll('.module-selection input[type="checkbox"]:checked');
  const moduleAccess = Array.from(checkboxes).map(cb => cb.value);

  const token = AUTH.getToken();

  const response = await fetch('/api/admin-mgmt/sub-admins', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      password,
      moduleAccess
    })
  });

  const data = await response.json();

  if (data.success) {
    alert('Sub-admin created successfully!\n\nCredentials to share:\nEmail: ' + email + '\nPassword: ' + password);
    closeModal();
    loadSubAdmins();
  } else {
    alert('Error: ' + data.message);
  }
}

async function resetPassword(adminId) {
  const newPassword = prompt('Enter new password (min 6 characters):');

  if (!newPassword || newPassword.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  const token = AUTH.getToken();

  const response = await fetch(`/api/admin-mgmt/sub-admins/${adminId}/reset-password`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newPassword })
  });

  const data = await response.json();

  if (data.success) {
    alert('Password reset successfully!\n\nNew credentials:\nEmail: ' + data.data.email + '\nPassword: ' + data.data.newPassword);
  } else {
    alert('Error: ' + data.message);
  }
}

async function deleteAdmin(adminId) {
  if (!confirm('Are you sure you want to deactivate this sub-admin?')) {
    return;
  }

  const token = AUTH.getToken();

  const response = await fetch(`/api/admin-mgmt/sub-admins/${adminId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (data.success) {
    alert('Sub-admin deactivated successfully');
    loadSubAdmins();
  } else {
    alert('Error: ' + data.message);
  }
}

// Load sub-admins on page load
document.addEventListener('DOMContentLoaded', loadSubAdmins);
```

---

## 🎨 Module Configuration

### Adding New Modules (No Backend Changes Needed!)

When you want to add a new sidebar item:

1. **Add to your frontend sidebar config:**
```javascript
const allMenuItems = [
  // ... existing items ...

  // NEW MODULE - just add it!
  { id: 'reports', label: 'Reports', icon: '📄', url: '/admin/reports.html' },
  { id: 'customers', label: 'Customers', icon: '👤', url: '/admin/customers.html' }
];
```

2. **That's it!** No backend changes needed. When creating a sub-admin, just include the new module IDs in the array.

3. Backend will store whatever you send - no validation.

---

## ⚠️ Important Security Notes

### Frontend (UX Only - NOT Security)
- ✅ Hide buttons/menus based on modules
- ✅ Redirect if user tries to access restricted page
- ✅ Improve user experience
- ⚠️ **NOT real security** - a smart user can bypass this

### Backend (Real Security)
- ✅ All API endpoints already protected with `verifyToken, isAdmin`
- ✅ Both super_admin and admin can access routes
- ✅ Sub-admin management routes require `super_admin` role
- ✅ Real security enforcement happens here

**Remember:** Frontend hiding is for UX. Backend enforcement is for security.

---

## 🧪 Testing Checklist

### Test 1: Super Admin Login
- [ ] Login with existing admin credentials
- [ ] Receives `isSuperAdmin: true`
- [ ] Receives `modules: []` (empty array)
- [ ] Sees ALL sidebar items including "Admin Management"

### Test 2: Create Sub-Admin
- [ ] Super admin can access Admin Management page
- [ ] Can create sub-admin with name, email, password
- [ ] Can select multiple modules
- [ ] Dashboard is auto-included
- [ ] Receives success message with credentials

### Test 3: Sub-Admin Login
- [ ] Sub-admin can login with provided credentials
- [ ] Receives `isSuperAdmin: false`
- [ ] Receives only assigned modules in array
- [ ] Sidebar shows only assigned modules
- [ ] "Admin Management" is hidden

### Test 4: Page Access
- [ ] Sub-admin can access assigned pages
- [ ] Sub-admin is redirected from non-assigned pages
- [ ] Super admin can access all pages

### Test 5: Module Management
- [ ] Super admin can update sub-admin modules
- [ ] Sub-admin's sidebar updates on next login
- [ ] Can add/remove modules dynamically

### Test 6: Password Reset
- [ ] Super admin can reset sub-admin password
- [ ] New password is returned to share
- [ ] Sub-admin can login with new password

### Test 7: Delete Sub-Admin
- [ ] Super admin can deactivate sub-admin
- [ ] Deactivated admin cannot login
- [ ] Shows "inactive" in admin list

---

## 🚀 Quick Start

1. **Super Admin First Login:**
   - Use existing endpoint: `POST /api/auth/admin-login`
   - Email: From env or `admin@epi.com`
   - Password: From env or `Admin@123456`

2. **Create Login Page:**
   - Email/password form
   - Calls `/api/admin-auth/login`
   - Stores response in localStorage

3. **Update Sidebar:**
   - Filter items based on `AUTH.hasModule()`
   - Show "Admin Management" only for super admin

4. **Create Admin Management Page:**
   - List all sub-admins
   - Create/Edit/Delete functionality
   - Module checkboxes (you define them!)

5. **Add Page Guards:**
   - Check module access on each page
   - Redirect if no access

---

## 📝 Summary

### Backend Responsibilities:
✅ Store module array (whatever frontend sends)
✅ Authenticate users with email/password
✅ Protect sub-admin management routes (super admin only)
✅ Return user's modules on login

### Frontend Responsibilities:
✅ Define all available modules
✅ Show/hide sidebar items based on modules
✅ Create admin management UI
✅ Handle module selection (checkboxes)
✅ Add page access guards

### Key Benefits:
✅ **No backend changes** when you add new modules
✅ **Full frontend control** over sidebar items
✅ **Simple** - just a modules array
✅ **Flexible** - easy to extend

---

## 🆘 Support

If you have questions or issues:
1. Check this documentation first
2. Test API endpoints with Postman/Thunder Client
3. Check browser console for errors
4. Verify token is being sent in headers

Good luck with your implementation! 🚀
