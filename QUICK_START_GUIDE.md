# 🚀 Quick Start Guide - Admin RBAC Implementation

## For Frontend Team

This is a **5-minute quick start** to get you up and running.

---

## 📋 Step 1: Copy Frontend Files (2 minutes)

### Create these files in your project:

1. **`assets/js/config.js`**
```javascript
const API_CONFIG = {
  BASE_URL: 'https://api.epielio.com/api',
  ENDPOINTS: {
    ADMIN_LOGIN: '/admin-auth/login',
    SUB_ADMINS: '/admin-mgmt/sub-admins'
  }
};
```

2. **`assets/js/auth.js`**
```javascript
const AUTH = {
  async login(email, password) {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem('adminToken', result.data.accessToken);
      localStorage.setItem('adminUser', JSON.stringify({
        userId: result.data.userId,
        name: result.data.name,
        email: result.data.email,
        isSuperAdmin: result.data.isSuperAdmin,
        modules: result.data.modules
      }));
    }

    return result;
  },

  getUser() {
    return JSON.parse(localStorage.getItem('adminUser') || '{}');
  },

  isSuperAdmin() {
    return this.getUser().isSuperAdmin === true;
  },

  hasModule(moduleName) {
    return this.isSuperAdmin() || this.getUser().modules?.includes(moduleName);
  },

  logout() {
    localStorage.clear();
    window.location.href = '/admin/login.html';
  }
};
```

3. **Copy full examples from `FRONTEND_CODE_EXAMPLES.js`** (in project root)

---

## 🔐 Step 2: Test Login (1 minute)

### Open your browser console and test:

```javascript
// Test login
const result = await AUTH.login('admin@epi.com', 'Admin@123456');
console.log(result);

// Check if super admin
console.log('Is Super Admin:', AUTH.isSuperAdmin());

// Check modules
console.log('Modules:', AUTH.getUser().modules);
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "name": "Admin",
    "email": "admin@epi.com",
    "role": "super_admin",
    "isSuperAdmin": true,
    "modules": [],
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

✅ **If you see this, backend is working!**

---

## 📊 Step 3: Update Sidebar (1 minute)

### In your `navigation.js` or similar:

```javascript
function renderSidebar() {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', url: '/admin/dashboard.html' },
    { id: 'products', label: 'Products', url: '/admin/products.html' },
    { id: 'orders', label: 'Orders', url: '/admin/orders.html' },
    { id: 'categories', label: 'Categories', url: '/admin/categories.html' },
    // Add more...

    // Super admin only
    {
      id: 'admin_management',
      label: 'Admin Management',
      url: '/admin/admin-management.html',
      superAdminOnly: true
    }
  ];

  // Filter based on access
  const visible = menuItems.filter(item => {
    if (item.superAdminOnly) return AUTH.isSuperAdmin();
    return AUTH.hasModule(item.id);
  });

  // Render sidebar HTML
  document.getElementById('sidebar').innerHTML = visible.map(item => `
    <a href="${item.url}">${item.label}</a>
  `).join('');
}
```

---

## 🔒 Step 4: Add Page Guards (30 seconds per page)

### At the top of EACH admin page (products.html, orders.html, etc.):

```html
<script src="/assets/js/config.js"></script>
<script src="/assets/js/auth.js"></script>
<script>
// products.html → check 'products' access
if (!AUTH.hasModule('products')) {
  alert('Access denied');
  window.location.href = '/admin/dashboard.html';
}
</script>
```

---

## 👨‍💼 Step 5: Create Admin Management Page (Optional)

### Create `admin/admin-management.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Admin Management</title>
  <script src="/assets/js/config.js"></script>
  <script src="/assets/js/auth.js"></script>
</head>
<body>
  <h1>Admin Management</h1>

  <!-- Only super admin can access this page -->
  <script>
    if (!AUTH.isSuperAdmin()) {
      alert('Super admin only!');
      window.location.href = '/admin/dashboard.html';
    }
  </script>

  <button onclick="openCreateModal()">Create Sub-Admin</button>

  <table id="subAdminsTable">
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Modules</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <script>
    async function loadSubAdmins() {
      const token = localStorage.getItem('adminToken');

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SUB_ADMINS}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        // Display in table
        const tbody = document.querySelector('#subAdminsTable tbody');
        tbody.innerHTML = result.data.map(admin => `
          <tr>
            <td>${admin.name}</td>
            <td>${admin.email}</td>
            <td>${admin.moduleAccess.length} modules</td>
            <td>${admin.isActive ? 'Active' : 'Inactive'}</td>
            <td>
              <button onclick="editAdmin('${admin._id}')">Edit</button>
              <button onclick="resetPassword('${admin._id}')">Reset Password</button>
            </td>
          </tr>
        `).join('');
      }
    }

    loadSubAdmins();
  </script>
</body>
</html>
```

---

## 🧪 Step 6: Test Complete Flow (2 minutes)

### Test Super Admin:
1. Login with `admin@epi.com` / `Admin@123456`
2. Should see ALL sidebar items including "Admin Management"
3. Can access all pages

### Test Creating Sub-Admin:
```javascript
const token = localStorage.getItem('adminToken');

const response = await fetch('https://api.epielio.com/api/admin-mgmt/sub-admins', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Test Manager',
    email: 'test@epi.com',
    password: 'Test123',
    moduleAccess: ['products', 'orders']
  })
});

const result = await response.json();
console.log(result);
```

### Test Sub-Admin Login:
```javascript
const result = await AUTH.login('test@epi.com', 'Test123');
console.log('Modules:', result.data.modules);
// Should see: ["dashboard", "products", "orders"]
```

### Test Sidebar Filtering:
- Sub-admin should only see Dashboard, Products, Orders
- Should NOT see Admin Management

---

## ✅ Checklist

- [ ] Copied `config.js`, `auth.js` files
- [ ] Tested super admin login
- [ ] Updated sidebar to filter by modules
- [ ] Added page guards to all admin pages
- [ ] Created admin management page (optional)
- [ ] Tested creating sub-admin
- [ ] Tested sub-admin login
- [ ] Verified sidebar shows only assigned modules

---

## 🆘 Troubleshooting

### Problem: Login returns 404
**Solution:** Check API base URL is `https://api.epielio.com/api`

### Problem: Can't create sub-admin
**Solution:** Make sure you're logged in as super admin (`isSuperAdmin: true`)

### Problem: Sub-admin sees all modules
**Solution:** Check `AUTH.hasModule()` logic - should check `isSuperAdmin` first

### Problem: Dashboard not showing for sub-admin
**Solution:** Backend automatically adds "dashboard" - frontend should always include it

### Problem: Token expired error
**Solution:** Implement token refresh (see `FRONTEND_CODE_EXAMPLES.js`)

---

## 📚 Full Documentation

- **Complete Guide:** [ADMIN_RBAC_FRONTEND_GUIDE.md](ADMIN_RBAC_FRONTEND_GUIDE.md)
- **Q&A:** [FRONTEND_TEAM_ANSWERS.md](FRONTEND_TEAM_ANSWERS.md)
- **Code Examples:** [FRONTEND_CODE_EXAMPLES.js](FRONTEND_CODE_EXAMPLES.js)
- **Backend Summary:** [RBAC_IMPLEMENTATION_SUMMARY.md](RBAC_IMPLEMENTATION_SUMMARY.md)

---

## 🎯 Key Takeaways

1. ✅ **One login endpoint** for everyone: `/api/admin-auth/login`
2. ✅ **Response format**: `{ success, data: { modules, isSuperAdmin, ... } }`
3. ✅ **Use `modules` from login**, `moduleAccess` for CRUD
4. ✅ **Super admin**: `isSuperAdmin: true`, `modules: []` (empty = all access)
5. ✅ **Sub-admin**: `isSuperAdmin: false`, `modules: ["products", "orders"]`
6. ✅ **Dashboard**: Always included by backend automatically
7. ✅ **You define modules** - backend just stores them

---

## 🚀 You're Ready!

Start with the login page, then add sidebar filtering, then page guards. That's it!

**Total implementation time: ~30 minutes** ⏱️
