/**
 * Test Data for API Endpoints
 * Contains sample data for testing each API endpoint
 */

const testData = {
  // ===== ROOT =====
  'GET /': {
    requiresAuth: false
  },

  // ===== AUTHENTICATION ENDPOINTS =====
  'POST /api/auth/login': {
    body: {
      idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1NzMzYmJiZDgxOGFhNWRiMTk1MTk5Y2Q1NjhlNWQ2ODUxMzJkM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTU1NTE1NTk3NTEzNTU5MjM4MjQiLCJlbWFpbCI6InJhdGhvZGRlZXByQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiRGVlcCBSYXRob2QiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS0pseXhIaVE1Rmhfc2kwODRpWU40d1B1TF82VTdnSG9qNEFfbm94UHFhV1c4bHl2ST1zOTYtYyIsImdpdmVuX25hbWUiOiJEZWVwIiwiZmFtaWx5X25hbWUiOiJSYXRob2QiLCJpYXQiOjE3NjM2NTExOTUsImV4cCI6MTc2MzY1NDc5NX0.ij8Ox4mCKU4AWHNVVYNXNPfa91OBVEex-jrZuaCL57HAzxYLtj3SHyBnNj8q0_GDL59H1R9CImWqbZEAiwhkCZdmVeQisHxiPJ5qn480Da9qFXYL1oFItm_g1xJBE-Nl4TsG2TPPbY7B9zo0d6sw0lP1mI6KaJ6ouXdpOkYlUIbq-YdkKiibaZEtJsJjY_4_vN5TV6pnxgSrCMOcgBapFWXDJEpxZ8UfBnrb5LxTA6u7s_OK0RLbHFfrp5QrjrDcFaVKMATt'
    },
    requiresAuth: false
  },

  'POST /api/auth/signup': {
    body: {
      name: 'Test User API',
      email: `test${Date.now()}@example.com`,
      phoneNumber: '9876543210',
      firebaseUid: `test_${Date.now()}`,
      referralCode: ''
    },
    requiresAuth: false
  },

  'POST /api/auth/admin-login': {
    body: {
      email: 'admin@epi.com',
      password: 'Admin@123456'
    },
    requiresAuth: false
  },

  'POST /api/auth/checkUserExists': {
    body: {
      email: 'rathoddeepre@gmail.com'
    },
    requiresAuth: false
  },

  'POST /api/auth/logout': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/auth/refresh-token': {
    body: {
      refreshToken: 'DYNAMIC_REFRESH_TOKEN'
    },
    requiresAuth: false
  },

  'GET /api/auth/profile/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/auth/profile': {
    body: {
      name: 'Updated Test User',
      deviceToken: 'test_device_token_123'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/auth/profiles/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      name: 'Updated Name',
      profilePicture: 'https://example.com/profile.jpg'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/auth/update-user-details': {
    body: {
      idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1NzMzYmJiZDgxOGFhNWRiMTk1MTk5Y2Q1NjhlNWQ2ODUxMzJkM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTU1NTE1NTk3NTEzNTU5MjM4MjQiLCJlbWFpbCI6InJhdGhvZGRlZXByQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiRGVlcCBSYXRob2QiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS0pseXhIaVE1Rmhfc2kwODRpWU40d1B1TF82VTdnSG9qNEFfbm94UHFhV1c4bHl2ST1zOTYtYyIsImdpdmVuX25hbWUiOiJEZWVwIiwiZmFtaWx5X25hbWUiOiJSYXRob2QiLCJpYXQiOjE3NjM2NTExOTUsImV4cCI6MTc2MzY1NDc5NX0.ij8Ox4mCKU4AWHNVVYNXNPfa91OBVEex-jrZuaCL57HAzxYLtj3SHyBnNj8q0_GDL59H1R9CImWqbZEAiwhkCZdmVeQisHxiPJ5qn480Da9qFXYL1oFItm_g1xJBE-Nl4TsG2TPPbY7B9zo0d6sw0lP1mI6KaJ6ouXdpOkYlUIbq-YdkKiibaZEtJsJjY_4_vN5TV6pnxgSrCMOcgBapFWXDJEpxZ8UfBnrb5LxTA6u7s_OK0RLbHFfrp5QrjrDcFaVKMATt',
      name: 'Deep Rathod Updated',
      deviceToken: 'new_device_token'
    },
    requiresAuth: false
  },

  'POST /api/auth/applyReferralCode': {
    body: {
      referralCode: 'TEST123'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/auth/:userId/bank-details': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      accountHolderName: 'Test User',
      bankName: 'State Bank of India',
      branchName: 'Main Branch',
      upiId: 'test@paytm',
      isDefault: true
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/auth/:userId/kyc': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      aadharCardNumber: '123456789012',
      panCardNumber: 'ABCDE1234F',
      documents: [
        {
          docType: 'AADHAR',
          docUrl: 'https://example.com/aadhar.jpg'
        }
      ]
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/auth/:userId/agree-terms': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      isAgree: true
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== CATEGORIES ENDPOINTS =====
  'GET /api/categories': {
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/categories/:categoryId': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    requiresAuth: false
  },

  'POST /api/categories': {
    body: {
      name: 'Test Category',
      description: 'Test category description',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/categories/dropdown/all': {
    requiresAuth: false
  },

  'GET /api/categories/search/:query': {
    params: { query: 'test' },
    requiresAuth: false
  },

  // ===== PRODUCTS ENDPOINTS =====
  'GET /api/products': {
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: false
  },

  'GET /api/products/search': {
    query: { q: 'test', page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/category/:category': {
    params: { category: 'electronics' },
    requiresAuth: false
  },

  'GET /api/products/featured/all': {
    query: { limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/featured/popular': {
    query: { limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/featured/trending': {
    query: { limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/featured/best-sellers': {
    query: { limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== CART ENDPOINTS =====
  'GET /api/cart/cart': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/cart/add/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    body: { quantity: 1 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'DELETE /api/cart/remove/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== WISHLIST ENDPOINTS =====
  'GET /api/wishlist': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/wishlist/add/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'DELETE /api/wishlist/remove/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== ORDERS ENDPOINTS =====
  'GET /api/orders': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/orders/:id': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/orders': {
    body: {
      productId: 'DYNAMIC_PRODUCT_ID',
      quantity: 1,
      paymentMethod: 'RAZORPAY'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== WALLET ENDPOINTS =====
  'GET /api/wallet': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/wallet/transactions': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/wallet/add-money': {
    body: {
      amount: 1000,
      paymentMethod: 'RAZORPAY'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== ADMIN WALLET ENDPOINTS =====
  'GET /api/admin/wallet': {
    query: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/admin/wallet/credit': {
    body: {
      userId: 'DYNAMIC_USER_ID',
      amount: 100,
      description: 'Test credit'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/admin/wallet/debit': {
    body: {
      userId: 'DYNAMIC_USER_ID',
      amount: 50,
      description: 'Test debit'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== BANNERS ENDPOINTS =====
  'GET /api/banners/public/active': {
    requiresAuth: false
  },

  'GET /api/banners/admin/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/banners/admin/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== SUCCESS STORIES ENDPOINTS =====
  'GET /api/success-stories/public/active': {
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/success-stories/admin/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/success-stories/admin/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== IMAGES ENDPOINTS =====
  'GET /api/images/admin/active': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/images/admin/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/images/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/images/types': {
    requiresAuth: false
  },

  // ===== REFERRAL ENDPOINTS =====
  'GET /api/referral/dashboard': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/referral/generate-code': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/referral/list/:referrerId': {
    params: { referrerId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== INSTALLMENT ENDPOINTS =====
  'GET /api/installment/orders': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/orders/stats': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/payments/my-payments': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/payments/stats': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/admin/orders/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/installment/admin/orders/completed': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/installment/admin/orders/pending-approval': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/installment/admin/orders/dashboard/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/installment/admin/payments/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== USER ENDPOINTS =====
  'GET /api/users': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/users/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/transactions': {
    params: { userId: 'DYNAMIC_USER_ID' },
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/addresses': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/users/:userId/addresses': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      type: 'HOME',
      addressLine1: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '9876543210'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/wishlist': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/wishlist/count': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/bank-details': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/kyc-details': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/kycDocuments': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/admin/kyc-documents/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/users/admin/create': {
    body: {
      name: 'Admin Created User',
      email: `admin_user_${Date.now()}@example.com`,
      password: 'Test@123456',
      phoneNumber: '9876543210',
      role: 'user'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== PAYMENTS ENDPOINTS =====
  'GET /api/payments/withdrawals': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/payments/create-order': {
    body: {
      amount: 1000,
      currency: 'INR',
      orderId: 'DYNAMIC_ORDER_ID'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/payments/verify': {
    body: {
      razorpay_order_id: 'order_test123',
      razorpay_payment_id: 'pay_test123',
      razorpay_signature: 'signature_test123'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/payments/withdraw': {
    body: {
      amount: 500,
      bankAccountId: 'DYNAMIC_BANK_ID'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/payments/transaction/:id': {
    params: { id: 'DYNAMIC_TRANSACTION_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== ADMIN ENDPOINTS =====
  'GET /api/admin/users': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/users/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/users/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    body: {
      name: 'Updated by Admin',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/admin/users/:userId': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/orders': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/orders/:id': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/orders/:id': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    body: {
      status: 'PROCESSING'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/products': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/admin/products': {
    body: {
      name: 'Admin Test Product',
      description: 'Test product description',
      price: 9999,
      categoryId: 'DYNAMIC_CATEGORY_ID',
      isActive: true,
      images: ['https://example.com/image.jpg']
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/products/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    body: {
      name: 'Updated Product Name',
      price: 19999
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/admin/products/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/categories': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/categories/:categoryId': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    body: {
      name: 'Updated Category',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/admin/categories/:categoryId': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/dashboard/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/dashboard/revenue': {
    query: { period: 'month' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/transactions': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/admin/withdrawals': {
    query: { page: 1, limit: 10, status: 'PENDING' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/withdrawals/:id/approve': {
    params: { id: 'DYNAMIC_TRANSACTION_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/admin/withdrawals/:id/reject': {
    params: { id: 'DYNAMIC_TRANSACTION_ID' },
    body: {
      reason: 'Invalid bank details'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== PLANS ENDPOINTS =====
  'GET /api/plans': {
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/plans/:planId': {
    params: { planId: 'DYNAMIC_PLAN_ID' },
    requiresAuth: false
  },

  'POST /api/plans': {
    body: {
      name: 'Test Plan',
      description: 'Test plan description',
      duration: 12,
      price: 5000,
      features: ['Feature 1', 'Feature 2']
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/plans/:planId': {
    params: { planId: 'DYNAMIC_PLAN_ID' },
    body: {
      name: 'Updated Plan',
      price: 6000
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/plans/:planId': {
    params: { planId: 'DYNAMIC_PLAN_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/plans/:planId/products': {
    params: { planId: 'DYNAMIC_PLAN_ID' },
    requiresAuth: false
  },

  'POST /api/plans/:planId/products/:productId': {
    params: { planId: 'DYNAMIC_PLAN_ID', productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/plans/:planId/products/:productId': {
    params: { planId: 'DYNAMIC_PLAN_ID', productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== BANNERS WITH ID ENDPOINTS =====
  'GET /api/banners/admin/:id': {
    params: { id: 'DYNAMIC_BANNER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/banners/admin': {
    body: {
      title: 'Test Banner',
      imageUrl: 'https://example.com/banner.jpg',
      link: 'https://example.com',
      isActive: true,
      order: 1
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/banners/admin/:id': {
    params: { id: 'DYNAMIC_BANNER_ID' },
    body: {
      title: 'Updated Banner',
      isActive: false
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/banners/admin/:id': {
    params: { id: 'DYNAMIC_BANNER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PATCH /api/banners/admin/:id/toggle': {
    params: { id: 'DYNAMIC_BANNER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PATCH /api/banners/admin/:id/order': {
    params: { id: 'DYNAMIC_BANNER_ID' },
    body: { order: 5 },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== SUCCESS STORIES WITH ID ENDPOINTS =====
  'GET /api/success-stories/public/:id': {
    params: { id: 'DYNAMIC_STORY_ID' },
    requiresAuth: false
  },

  'GET /api/success-stories/admin/:id': {
    params: { id: 'DYNAMIC_STORY_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/success-stories/admin': {
    body: {
      name: 'Test User',
      title: 'Success Story',
      description: 'This is a test success story',
      imageUrl: 'https://example.com/story.jpg',
      earnings: 50000,
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/success-stories/admin/:id': {
    params: { id: 'DYNAMIC_STORY_ID' },
    body: {
      title: 'Updated Success Story',
      earnings: 75000
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/success-stories/admin/:id': {
    params: { id: 'DYNAMIC_STORY_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PATCH /api/success-stories/admin/:id/toggle': {
    params: { id: 'DYNAMIC_STORY_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== IMAGES WITH ID ENDPOINTS =====
  'GET /api/images/admin/:id': {
    params: { id: 'DYNAMIC_IMAGE_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'POST /api/images/admin': {
    body: {
      url: 'https://example.com/image.jpg',
      type: 'PRODUCT',
      alt: 'Test Image',
      isActive: true
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/images/admin/:id': {
    params: { id: 'DYNAMIC_IMAGE_ID' },
    body: {
      alt: 'Updated Image',
      isActive: false
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'DELETE /api/images/admin/:id': {
    params: { id: 'DYNAMIC_IMAGE_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PATCH /api/images/admin/:id/toggle': {
    params: { id: 'DYNAMIC_IMAGE_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== INSTALLMENT WITH ORDER ID ENDPOINTS =====
  'GET /api/installment/orders/:orderId': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/orders/:orderId/payments': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/installment/orders/:orderId/pay': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    body: {
      installmentNumber: 1,
      amount: 1000,
      paymentMethod: 'RAZORPAY'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/installment/admin/orders/:orderId': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/installment/admin/orders/:orderId/approve': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/installment/admin/orders/:orderId/reject': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    body: {
      reason: 'Incomplete documentation'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/installment/admin/payments/:paymentId': {
    params: { paymentId: 'DYNAMIC_PAYMENT_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== PRODUCT ADVANCED ENDPOINTS =====
  'GET /api/products/:productId/reviews': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'POST /api/products/:productId/reviews': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    body: {
      rating: 5,
      comment: 'Great product!'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/products/:productId/related': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    query: { limit: 5 },
    requiresAuth: false
  },

  'POST /api/products/:productId/view': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    requiresAuth: false
  },

  'GET /api/products/region/:region': {
    params: { region: 'IN' },
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/products/project/:projectId': {
    params: { projectId: 'DYNAMIC_PROJECT_ID' },
    requiresAuth: false
  },

  // ===== USER NESTED ENDPOINTS =====
  'PUT /api/users/:userId/addresses/:addressId': {
    params: { userId: 'DYNAMIC_USER_ID', addressId: 'DYNAMIC_ADDRESS_ID' },
    body: {
      addressLine1: 'Updated Address',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'DELETE /api/users/:userId/addresses/:addressId': {
    params: { userId: 'DYNAMIC_USER_ID', addressId: 'DYNAMIC_ADDRESS_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/users/:userId/addresses/:addressId/default': {
    params: { userId: 'DYNAMIC_USER_ID', addressId: 'DYNAMIC_ADDRESS_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/orders': {
    params: { userId: 'DYNAMIC_USER_ID' },
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/cart': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/users/:userId/wallet': {
    params: { userId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'DELETE /api/users/:userId/bank-details/:bankId': {
    params: { userId: 'DYNAMIC_USER_ID', bankId: 'DYNAMIC_BANK_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/users/:userId/bank-details/:bankId/default': {
    params: { userId: 'DYNAMIC_USER_ID', bankId: 'DYNAMIC_BANK_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/users/:userId/kyc-documents/:docId': {
    params: { userId: 'DYNAMIC_USER_ID', docId: 'DYNAMIC_DOC_ID' },
    body: {
      docUrl: 'https://example.com/updated-doc.jpg',
      status: 'PENDING'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'DELETE /api/users/:userId/kyc-documents/:docId': {
    params: { userId: 'DYNAMIC_USER_ID', docId: 'DYNAMIC_DOC_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'PUT /api/users/admin/kyc-documents/:docId/approve': {
    params: { docId: 'DYNAMIC_DOC_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/users/admin/kyc-documents/:docId/reject': {
    params: { docId: 'DYNAMIC_DOC_ID' },
    body: {
      reason: 'Document not clear'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== REFERRAL ADVANCED ENDPOINTS =====
  'GET /api/referral/validate/:code': {
    params: { code: 'TEST123' },
    requiresAuth: false
  },

  'GET /api/referral/earnings': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/referral/stats': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/referral/claim-commission/:orderId': {
    params: { orderId: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/referral/commission-history': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/referral/referred-users/:referredUserId': {
    params: { referredUserId: 'DYNAMIC_USER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/referral/admin/all': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresAdmin: true
  },

  'GET /api/referral/admin/stats': {
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/referral/admin/commission/:commissionId/approve': {
    params: { commissionId: 'DYNAMIC_COMMISSION_ID' },
    requiresAuth: true,
    requiresAdmin: true
  },

  'PUT /api/referral/admin/commission/:commissionId/reject': {
    params: { commissionId: 'DYNAMIC_COMMISSION_ID' },
    body: {
      reason: 'Invalid order'
    },
    requiresAuth: true,
    requiresAdmin: true
  },

  // ===== CART WITH TRAILING SLASH =====
  'GET /api/cart/cart/': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/cart/cart/clear': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'PATCH /api/cart/update/:productId': {
    params: { productId: 'DYNAMIC_PRODUCT_ID' },
    body: { quantity: 2 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/cart/count': {
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== ORDER STATUS ENDPOINTS =====
  'PUT /api/orders/:id/cancel': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    body: {
      reason: 'Changed mind'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/orders/:id/track': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/orders/:id/invoice': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/orders/:id/return': {
    params: { id: 'DYNAMIC_ORDER_ID' },
    body: {
      reason: 'Product damaged',
      description: 'Product received in damaged condition'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== WALLET ADVANCED ENDPOINTS =====
  'POST /api/wallet/withdraw': {
    body: {
      amount: 500,
      bankAccountId: 'DYNAMIC_BANK_ID'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/wallet/balance': {
    requiresAuth: true,
    requiresFirebase: true
  },

  'GET /api/wallet/withdrawal-requests': {
    query: { page: 1, limit: 10 },
    requiresAuth: true,
    requiresFirebase: true
  },

  'POST /api/wallet/transfer': {
    body: {
      toUserId: 'DYNAMIC_USER_ID',
      amount: 100,
      description: 'Test transfer'
    },
    requiresAuth: true,
    requiresFirebase: true
  },

  // ===== CATEGORY ADVANCED ENDPOINTS =====
  'GET /api/categories/:categoryId/products': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    query: { page: 1, limit: 10 },
    requiresAuth: false
  },

  'GET /api/categories/:categoryId/subcategories': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    requiresAuth: false
  },

  'POST /api/categories/:categoryId/subcategories': {
    params: { categoryId: 'DYNAMIC_CATEGORY_ID' },
    body: {
      name: 'Test Subcategory',
      description: 'Test subcategory description'
    },
    requiresAuth: true,
    requiresAdmin: true
  }
};

module.exports = testData;
