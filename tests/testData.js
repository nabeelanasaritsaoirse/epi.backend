/**
 * Test Data for API Health Checks
 * Contains sample data for categories and products
 */

const config = require('./testConfig');

const sampleCategories = [
  {
    name: "Electronics",
    description: "Electronic devices and gadgets",
    displayOrder: 1,
    isFeatured: true,
    showInMenu: true,
    icon: "📱"
  },
  {
    name: "Fashion",
    description: "Clothing and accessories",
    displayOrder: 2,
    isFeatured: true,
    showInMenu: true,
    icon: "👔"
  }
];

const sampleProducts = [
  {
    name: "iPhone 15 Pro",
    description: {
      short: "Latest flagship smartphone from Apple",
      long: "Experience the power of A17 Pro chip",
      features: ["A17 Pro chip", "48MP camera"],
      specifications: { display: "6.1 inch", storage: "256GB" }
    },
    brand: "Apple",
    pricing: { regularPrice: 129900, currency: "INR" },
    availability: { isAvailable: true, stockQuantity: 50 },
    plans: [
      { name: "Standard Plan", days: 60, perDayAmount: 2000, isRecommended: true }
    ],
    status: "published"
  }
];

// Endpoint test configurations
const endpointTests = {
  // Auth endpoints
  'POST /api/auth/login': {
    body: {
      idToken: config.testUser.firebaseToken
    },
    requiresAuth: false
  },

  'POST /api/auth/admin-login': {
    body: {
      email: config.adminUser.email,
      password: config.adminUser.password
    },
    requiresAuth: false
  },

  'POST /api/auth/signup': {
    body: {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      firebaseUid: `test_uid_${Date.now()}`
    },
    requiresAuth: false
  },

  'POST /api/auth/refresh-token': {
    body: {},
    requiresAuth: true
  },

  'POST /api/auth/logout': {
    body: {},
    requiresAuth: true
  },

  // User endpoints
  'GET /api/auth/profile/:userId': {
    requiresAuth: true
  },

  'PUT /api/auth/profile': {
    body: {
      name: 'Updated Name'
    },
    requiresAuth: true
  },

  'PUT /api/auth/profiles/:userId': {
    body: {
      name: 'Updated Profile Name'
    },
    requiresAuth: true
  },

  'POST /api/auth/checkUserExists': {
    body: {
      email: 'test@example.com'
    },
    requiresAuth: false
  },

  // Categories
  'GET /api/categories': {
    requiresAuth: false
  },

  'GET /api/categories/:id': {
    requiresAuth: false
  },

  'POST /api/categories': {
    body: sampleCategories[0],
    requiresAuth: true,
    requiresAdmin: true
  },

  // Products
  'GET /api/products': {
    requiresAuth: false
  },

  'GET /api/products/:id': {
    requiresAuth: false
  },

  'POST /api/products': {
    body: sampleProducts[0],
    requiresAuth: true,
    requiresAdmin: true
  },

  // Plans
  'GET /api/plans': {
    requiresAuth: false
  },

  'GET /api/plans/:id': {
    requiresAuth: false
  },

  // Orders
  'GET /api/orders': {
    requiresAuth: true
  },

  'GET /api/orders/:orderId': {
    requiresAuth: true
  },

  // Wishlist
  'GET /api/wishlist': {
    requiresAuth: true
  },

  'POST /api/wishlist': {
    body: {},
    requiresAuth: true
  },

  // Notifications
  'GET /api/notifications': {
    requiresAuth: true
  },

  'PUT /api/notifications/:id/read': {
    body: {},
    requiresAuth: true
  },

  // Banners
  'GET /api/banners': {
    requiresAuth: false
  },

  'GET /api/banners/active': {
    requiresAuth: false
  },

  'POST /api/banners': {
    body: {
      title: 'Test Banner',
      imageUrl: 'https://example.com/banner.jpg',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // Success Stories
  'GET /api/success-stories': {
    requiresAuth: false
  },

  'GET /api/success-stories/active': {
    requiresAuth: false
  },

  'POST /api/success-stories': {
    body: {
      title: 'Test Story',
      content: 'This is a test success story',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // Image Store
  'GET /api/image-store': {
    requiresAuth: false
  },

  // Payments
  'POST /api/payments/create-order': {
    body: {
      amount: 1000,
      currency: 'INR'
    },
    requiresAuth: true
  },

  // Referrals
  'POST /api/auth/applyReferralCode': {
    body: {
      referralCode: 'TEST123'
    },
    requiresAuth: true
  },

  // Bank Details
  'PUT /api/auth/:userId/bank-details': {
    body: {
      accountNumber: '1234567890',
      ifscCode: 'TEST0001234',
      accountHolderName: 'Test User',
      bankName: 'Test Bank'
    },
    requiresAuth: true
  },

  // KYC
  'POST /api/auth/:userId/kyc': {
    body: {
      documents: [
        {
          docType: 'aadhar',
          docUrl: 'https://example.com/aadhar.jpg'
        }
      ]
    },
    requiresAuth: true
  },

  // Terms Agreement
  'PUT /api/auth/:userId/agree-terms': {
    body: {
      isAgree: true
    },
    requiresAuth: true
  }
};

module.exports = {
  sampleCategories,
  sampleProducts,
  ...endpointTests
};
