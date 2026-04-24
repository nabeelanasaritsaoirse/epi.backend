/**
 * PRODUCTION-READY FRONTEND CODE EXAMPLES
 * Copy-paste these into your project
 */

// ============================================
// CONFIG.JS - API Configuration
// ============================================

const API_CONFIG = {
  BASE_URL: 'https://api.epielio.com/api',
  ENDPOINTS: {
    // Authentication
    ADMIN_LOGIN: '/admin-auth/login',
    REFRESH_TOKEN: '/auth/refresh-token',

    // Sub-Admin Management
    SUB_ADMINS: '/admin-mgmt/sub-admins',
    MY_MODULES: '/admin-mgmt/my-modules'
  }
};

// ============================================
// AUTH.JS - Authentication Helper
// ============================================

const AUTH = {
  /**
   * Login with email and password
   * Works for both super admin and sub-admin
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (result.success) {
        // Store tokens
        localStorage.setItem('adminToken', result.data.accessToken);
        localStorage.setItem('refreshToken', result.data.refreshToken);

        // Store user info
        localStorage.setItem('adminUser', JSON.stringify({
          userId: result.data.userId,
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
          profilePicture: result.data.profilePicture,
          isSuperAdmin: result.data.isSuperAdmin,
          modules: result.data.modules  // ← Use "modules" from login response
        }));

        return { success: true, data: result.data };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  },

  /**
   * Get stored access token
   */
  getToken() {
    return localStorage.getItem('adminToken');
  },

  /**
   * Get stored user data
   */
  getUser() {
    const userStr = localStorage.getItem('adminUser');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Check if current user is super admin
   */
  isSuperAdmin() {
    const user = this.getUser();
    return user?.isSuperAdmin === true;
  },

  /**
   * Check if user has access to a specific module
   * @param {string} moduleName - Module ID (e.g., 'products', 'orders')
   */
  hasModule(moduleName) {
    const user = this.getUser();

    // Super admin has access to ALL modules
    if (user?.isSuperAdmin) {
      return true;
    }

    // Sub-admin only has assigned modules
    return user?.modules?.includes(moduleName) || false;
  },

  /**
   * Get list of accessible modules
   */
  getModules() {
    const user = this.getUser();
    return user?.modules || [];
  },

  /**
   * Logout and clear stored data
   */
  logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login.html';
  },

  /**
   * Refresh access token
   */
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const result = await response.json();

      if (result.success) {
        // Store new tokens
        localStorage.setItem('adminToken', result.data.accessToken);
        localStorage.setItem('refreshToken', result.data.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }
};

// ============================================
// API.JS - API Request Helper with Auth
// ============================================

const API = {
  /**
   * Make authenticated API request
   * Automatically handles token refresh
   */
  async request(endpoint, options = {}) {
    const token = AUTH.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // Add auth token if available
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      let response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);

      // Handle token expiration
      if (response.status === 401) {
        const errorData = await response.json();

        if (errorData.code === 'TOKEN_EXPIRED') {
          // Try to refresh token
          const refreshed = await AUTH.refreshToken();

          if (refreshed) {
            // Retry with new token
            const newToken = AUTH.getToken();
            config.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);
          } else {
            // Refresh failed, redirect to login
            alert('Session expired. Please login again.');
            AUTH.logout();
            return null;
          }
        }
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  },

  // Convenience methods
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// ============================================
// ADMIN-MANAGEMENT.JS - Sub-Admin CRUD
// ============================================

const AdminManagement = {
  /**
   * Get all sub-admins
   */
  async getAllSubAdmins() {
    return await API.get(API_CONFIG.ENDPOINTS.SUB_ADMINS);
  },

  /**
   * Get single sub-admin by ID
   */
  async getSubAdmin(adminId) {
    return await API.get(`${API_CONFIG.ENDPOINTS.SUB_ADMINS}/${adminId}`);
  },

  /**
   * Create new sub-admin
   * @param {Object} adminData - { name, email, password, moduleAccess }
   */
  async createSubAdmin(adminData) {
    // Note: Use "moduleAccess" for create/update
    return await API.post(API_CONFIG.ENDPOINTS.SUB_ADMINS, {
      name: adminData.name,
      email: adminData.email,
      password: adminData.password,
      moduleAccess: adminData.modules  // ← Use "moduleAccess" in request
    });
  },

  /**
   * Update sub-admin
   * @param {string} adminId
   * @param {Object} updates - { name?, moduleAccess?, isActive? }
   */
  async updateSubAdmin(adminId, updates) {
    const payload = {};

    if (updates.name) payload.name = updates.name;
    if (updates.modules) payload.moduleAccess = updates.modules; // ← Use "moduleAccess"
    if (updates.isActive !== undefined) payload.isActive = updates.isActive;

    return await API.put(`${API_CONFIG.ENDPOINTS.SUB_ADMINS}/${adminId}`, payload);
  },

  /**
   * Delete/deactivate sub-admin
   */
  async deleteSubAdmin(adminId) {
    return await API.delete(`${API_CONFIG.ENDPOINTS.SUB_ADMINS}/${adminId}`);
  },

  /**
   * Reset sub-admin password
   */
  async resetPassword(adminId, newPassword) {
    return await API.post(
      `${API_CONFIG.ENDPOINTS.SUB_ADMINS}/${adminId}/reset-password`,
      { newPassword }
    );
  },

  /**
   * Get current user's modules
   */
  async getMyModules() {
    return await API.get(API_CONFIG.ENDPOINTS.MY_MODULES);
  }
};

// ============================================
// NAVIGATION.JS - Sidebar Rendering
// ============================================

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
    <a href="${item.url}" class="nav-item ${isCurrentPage(item.url) ? 'active' : ''}">
      <span class="icon">${item.icon}</span>
      <span class="label">${item.label}</span>
    </a>
  `).join('');

  document.getElementById('sidebar').innerHTML = sidebarHTML;
}

function isCurrentPage(url) {
  return window.location.pathname.endsWith(url.split('/').pop());
}

// ============================================
// LOGIN PAGE IMPLEMENTATION
// ============================================

// Add to login.html
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error');
  const submitBtn = document.getElementById('submitBtn');

  // Show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  errorDiv.style.display = 'none';

  try {
    const result = await AUTH.login(email, password);

    if (result.success) {
      // Redirect to dashboard
      window.location.href = '/admin/dashboard.html';
    } else {
      // Show error
      errorDiv.textContent = result.message || 'Login failed';
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
});

// ============================================
// PAGE ACCESS GUARD
// ============================================

// Add to the TOP of every admin page (products.html, orders.html, etc.)
function checkPageAccess(requiredModule) {
  // Check if user is logged in
  if (!AUTH.getToken()) {
    window.location.href = '/admin/login.html';
    return;
  }

  // Check if user has access to this module
  if (!AUTH.hasModule(requiredModule)) {
    alert('You do not have access to this module');
    window.location.href = '/admin/dashboard.html';
    return;
  }
}

// Usage in products.html:
// checkPageAccess('products');

// Usage in orders.html:
// checkPageAccess('orders');

// ============================================
// ADMIN MANAGEMENT PAGE - CREATE SUB-ADMIN
// ============================================

async function loadSubAdmins() {
  const result = await AdminManagement.getAllSubAdmins();

  if (result.success) {
    displaySubAdmins(result.data);
  } else {
    alert('Failed to load sub-admins: ' + result.message);
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

async function createSubAdmin() {
  const name = document.getElementById('adminName').value;
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;

  // Get selected modules from checkboxes
  const checkboxes = document.querySelectorAll('.module-selection input[type="checkbox"]:checked');
  const selectedModules = Array.from(checkboxes).map(cb => cb.value);

  // Validation
  if (!name || !email || !password) {
    alert('Please fill all fields');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  if (selectedModules.length === 0) {
    alert('Please select at least one module');
    return;
  }

  // Create sub-admin
  const result = await AdminManagement.createSubAdmin({
    name,
    email,
    password,
    modules: selectedModules  // Function converts to moduleAccess
  });

  if (result.success) {
    alert(`Sub-admin created successfully!\n\nShare these credentials:\nEmail: ${email}\nPassword: ${password}`);
    closeModal();
    loadSubAdmins();
  } else {
    alert('Error: ' + result.message);
  }
}

async function resetPasswordHandler(adminId) {
  const newPassword = prompt('Enter new password (min 6 characters):');

  if (!newPassword || newPassword.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  const result = await AdminManagement.resetPassword(adminId, newPassword);

  if (result.success) {
    alert(`Password reset successfully!\n\nNew credentials:\nEmail: ${result.data.email}\nPassword: ${result.data.newPassword}`);
  } else {
    alert('Error: ' + result.message);
  }
}

async function deleteAdmin(adminId) {
  if (!confirm('Are you sure you want to deactivate this sub-admin?')) {
    return;
  }

  const result = await AdminManagement.deleteSubAdmin(adminId);

  if (result.success) {
    alert('Sub-admin deactivated successfully');
    loadSubAdmins();
  } else {
    alert('Error: ' + result.message);
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar on every page
  if (document.getElementById('sidebar')) {
    renderSidebar();
  }

  // Load sub-admins if on admin management page
  if (document.getElementById('subAdminsTable')) {
    // Check super admin access
    if (!AUTH.isSuperAdmin()) {
      alert('Access denied. Super admin only.');
      window.location.href = '/admin/dashboard.html';
      return;
    }

    loadSubAdmins();
  }
});

// ============================================
// EXPORT FOR USE
// ============================================

// If using modules:
// export { AUTH, API, AdminManagement, renderSidebar, checkPageAccess };

// If using global scope:
window.AUTH = AUTH;
window.API = API;
window.AdminManagement = AdminManagement;
window.renderSidebar = renderSidebar;
window.checkPageAccess = checkPageAccess;
