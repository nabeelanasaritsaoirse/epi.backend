/**
 * API Tester
 * Main testing logic for API endpoints
 */

const axios = require('axios');
const testData = require('./testData');
const config = require('./testConfig');

class APITester {
  constructor(baseURL = config.baseURL) {
    this.baseURL = baseURL;
    this.results = [];
    this.tokens = {
      firebaseToken: null,
      userToken: null,
      adminToken: null
    };
    this.dynamicIds = {
      userId: null,
      productId: null,
      categoryId: null,
      conversationId: null,
      notificationId: null,
      referralId: null,
      orderId: null,
      planId: null,
      bankId: null,
      addressId: null,
      docId: null,
      transactionId: null,
      paymentId: null,
      commissionId: null,
      bannerId: null,
      storyId: null,
      imageId: null,
      projectId: null
    };
    this.skipRoutes = config.skipRoutes;
  }

  /**
   * Test all endpoints
   */
  async testAllEndpoints(routes) {
    console.log('\n🚀 STARTING API HEALTH CHECK');
    console.log('='.repeat(80));
    console.log(`Base URL: ${this.baseURL}`);
    console.log(`Total Routes: ${routes.length}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    // Step 1: Setup test environment
    await this.setupTestEnvironment();

    // Step 2: Test each route
    let tested = 0;
    for (const route of routes) {
      const routeKey = `${route.method} ${route.path}`;

      // Skip certain routes
      if (this.skipRoutes.includes(route.path)) {
        continue;
      }

      await this.testEndpoint(route);
      tested++;

      // Add small delay to avoid rate limiting
      if (tested % 10 === 0) {
        await this.sleep(500);
      }
    }

    // Step 3: Generate summary
    this.generateSummary();

    return this.results;
  }

  /**
   * Setup test environment
   */
  async setupTestEnvironment() {
    console.log('📋 SETTING UP TEST ENVIRONMENT\n');

    try {
      // 1. Login with Firebase token
      console.log('  🔐 Logging in with Firebase token...');
      const loginResponse = await this.makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        data: testData['POST /api/auth/login'].body
      });

      if (loginResponse.success && loginResponse.data) {
        this.tokens.firebaseToken = config.testUser.firebaseToken;
        this.tokens.userToken = loginResponse.data.accessToken;
        this.dynamicIds.userId = loginResponse.data.userId;
        console.log('  ✅ User logged in successfully');
        console.log(`  📝 User ID: ${this.dynamicIds.userId}`);
      }
    } catch (error) {
      console.log('  ⚠️  User login failed:', error.message);
    }

    try {
      // 2. Admin login
      console.log('\n  🔐 Logging in as admin...');
      const adminLoginResponse = await this.makeRequest({
        method: 'POST',
        path: '/api/auth/admin-login',
        data: testData['POST /api/auth/admin-login'].body
      });

      if (adminLoginResponse.success && adminLoginResponse.data) {
        this.tokens.adminToken = adminLoginResponse.data.accessToken;
        console.log('  ✅ Admin logged in successfully');
      }
    } catch (error) {
      console.log('  ⚠️  Admin login failed:', error.message);
    }

    try {
      // 3. Get sample category
      console.log('\n  📦 Fetching sample category...');
      const categoriesResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/categories',
        query: { limit: 1 }
      });

      if (categoriesResponse.success && categoriesResponse.data && categoriesResponse.data.length > 0) {
        this.dynamicIds.categoryId = categoriesResponse.data[0]._id;
        console.log('  ✅ Sample category fetched');
      }
    } catch (error) {
      console.log('  ⚠️  Category fetch failed:', error.message);
    }

    try {
      // 4. Get sample product
      console.log('\n  📦 Fetching sample product...');
      const productsResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/products',
        query: { limit: 1 }
      });

      if (productsResponse.success && productsResponse.data) {
        const products = productsResponse.data.products || productsResponse.data;
        if (Array.isArray(products) && products.length > 0) {
          this.dynamicIds.productId = products[0]._id;
          console.log('  ✅ Sample product fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Product fetch failed:', error.message);
    }


    try {
      // 5. Get sample plan
      console.log('\n  📦 Fetching sample plan...');
      const plansResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/plans',
        query: { limit: 1 }
      });

      if (plansResponse.success && plansResponse.data) {
        const plans = Array.isArray(plansResponse.data) ? plansResponse.data : plansResponse.data.plans;
        if (plans && plans.length > 0) {
          this.dynamicIds.planId = plans[0]._id;
          console.log('  ✅ Sample plan fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Plan fetch failed:', error.message);
    }

    try {
      // 6. Get sample banner (admin)
      console.log('\n  📦 Fetching sample banner...');
      const bannersResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/banners/admin/all',
        query: { limit: 1 },
        token: this.tokens.adminToken
      });

      if (bannersResponse.success && bannersResponse.data) {
        const banners = Array.isArray(bannersResponse.data) ? bannersResponse.data : bannersResponse.data.banners;
        if (banners && banners.length > 0) {
          this.dynamicIds.bannerId = banners[0]._id;
          console.log('  ✅ Sample banner fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Banner fetch failed:', error.message);
    }

    try {
      // 7. Get sample success story (admin)
      console.log('\n  📦 Fetching sample success story...');
      const storiesResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/success-stories/admin/all',
        query: { limit: 1 },
        token: this.tokens.adminToken
      });

      if (storiesResponse.success && storiesResponse.data) {
        const stories = Array.isArray(storiesResponse.data) ? storiesResponse.data : storiesResponse.data.stories;
        if (stories && stories.length > 0) {
          this.dynamicIds.storyId = stories[0]._id;
          console.log('  ✅ Sample success story fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Success story fetch failed:', error.message);
    }

    try {
      // 8. Get sample image (admin)
      console.log('\n  📦 Fetching sample image...');
      const imagesResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/images/admin/all',
        query: { limit: 1 },
        token: this.tokens.adminToken
      });

      if (imagesResponse.success && imagesResponse.data) {
        const images = Array.isArray(imagesResponse.data) ? imagesResponse.data : imagesResponse.data.images;
        if (images && images.length > 0) {
          this.dynamicIds.imageId = images[0]._id;
          console.log('  ✅ Sample image fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Image fetch failed:', error.message);
    }

    try {
      // 9. Get sample order (user)
      console.log('\n  📦 Fetching sample order...');
      const ordersResponse = await this.makeRequest({
        method: 'GET',
        path: '/api/orders',
        query: { limit: 1 },
        token: this.tokens.userToken
      });

      if (ordersResponse.success && ordersResponse.data) {
        const orders = Array.isArray(ordersResponse.data) ? ordersResponse.data : ordersResponse.data.orders;
        if (orders && orders.length > 0) {
          this.dynamicIds.orderId = orders[0]._id;
          console.log('  ✅ Sample order fetched');
        }
      }
    } catch (error) {
      console.log('  ⚠️  Order fetch failed:', error.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST ENVIRONMENT READY');
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Test a single endpoint
   */
  async testEndpoint(route) {
    const routeKey = `${route.method} ${route.path}`;
    const testConfig = testData[routeKey];

    if (!testConfig) {
      this.results.push({
        method: route.method,
        path: route.path,
        status: 'SKIPPED',
        reason: 'No test data configured',
        timestamp: new Date()
      });

      if (config.verbose) {
        console.log(`⏭️  ${route.method.padEnd(7)} ${route.path.padEnd(50)} SKIPPED (No test data)`);
      }
      return;
    }

    try {
      // Replace dynamic IDs in path
      let path = route.path;

      // Replace all dynamic IDs in path
      if (path.includes(':userId')) {
        if (!this.dynamicIds.userId) {
          throw new Error('User ID not available');
        }
        path = path.replace(':userId', this.dynamicIds.userId);
      }

      if (path.includes(':productId')) {
        if (!this.dynamicIds.productId) {
          throw new Error('Product ID not available');
        }
        path = path.replace(':productId', this.dynamicIds.productId);
      }

      if (path.includes(':categoryId')) {
        if (!this.dynamicIds.categoryId) {
          throw new Error('Category ID not available');
        }
        path = path.replace(':categoryId', this.dynamicIds.categoryId);
      }

      if (path.includes(':referrerId')) {
        if (!this.dynamicIds.userId) {
          throw new Error('Referrer ID not available');
        }
        path = path.replace(':referrerId', this.dynamicIds.userId);
      }

      if (path.includes(':id')) {
        // Use product ID as fallback for generic :id
        const genericId = this.dynamicIds.productId || this.dynamicIds.userId;
        if (!genericId) {
          throw new Error('Dynamic ID not available');
        }
        path = path.replace(':id', genericId);
      }

      if (path.includes(':conversationId')) {
        if (!this.dynamicIds.conversationId) {
          throw new Error('Conversation ID not available');
        }
        path = path.replace(':conversationId', this.dynamicIds.conversationId);
      }

      if (path.includes(':orderId')) {
        if (!this.dynamicIds.orderId) {
          throw new Error('Order ID not available');
        }
        path = path.replace(':orderId', this.dynamicIds.orderId);
      }

      if (path.includes(':planId')) {
        if (!this.dynamicIds.planId) {
          throw new Error('Plan ID not available');
        }
        path = path.replace(':planId', this.dynamicIds.planId);
      }

      if (path.includes(':bankId')) {
        if (!this.dynamicIds.bankId) {
          throw new Error('Bank ID not available');
        }
        path = path.replace(':bankId', this.dynamicIds.bankId);
      }

      if (path.includes(':addressId')) {
        if (!this.dynamicIds.addressId) {
          throw new Error('Address ID not available');
        }
        path = path.replace(':addressId', this.dynamicIds.addressId);
      }

      if (path.includes(':docId')) {
        if (!this.dynamicIds.docId) {
          throw new Error('Document ID not available');
        }
        path = path.replace(':docId', this.dynamicIds.docId);
      }

      if (path.includes(':transactionId')) {
        if (!this.dynamicIds.transactionId) {
          throw new Error('Transaction ID not available');
        }
        path = path.replace(':transactionId', this.dynamicIds.transactionId);
      }

      if (path.includes(':paymentId')) {
        if (!this.dynamicIds.paymentId) {
          throw new Error('Payment ID not available');
        }
        path = path.replace(':paymentId', this.dynamicIds.paymentId);
      }

      if (path.includes(':commissionId')) {
        if (!this.dynamicIds.commissionId) {
          throw new Error('Commission ID not available');
        }
        path = path.replace(':commissionId', this.dynamicIds.commissionId);
      }

      if (path.includes(':bannerId')) {
        if (!this.dynamicIds.bannerId) {
          throw new Error('Banner ID not available');
        }
        path = path.replace(':bannerId', this.dynamicIds.bannerId);
      }

      if (path.includes(':storyId')) {
        if (!this.dynamicIds.storyId) {
          throw new Error('Story ID not available');
        }
        path = path.replace(':storyId', this.dynamicIds.storyId);
      }

      if (path.includes(':imageId')) {
        if (!this.dynamicIds.imageId) {
          throw new Error('Image ID not available');
        }
        path = path.replace(':imageId', this.dynamicIds.imageId);
      }

      if (path.includes(':projectId')) {
        if (!this.dynamicIds.projectId) {
          throw new Error('Project ID not available');
        }
        path = path.replace(':projectId', this.dynamicIds.projectId);
      }

      if (path.includes(':referredUserId')) {
        // Use userId for referredUserId
        if (!this.dynamicIds.userId) {
          throw new Error('Referred User ID not available');
        }
        path = path.replace(':referredUserId', this.dynamicIds.userId);
      }

      if (path.includes(':query')) {
        path = path.replace(':query', 'test');
      }

      if (path.includes(':category')) {
        path = path.replace(':category', 'electronics');
      }

      if (path.includes(':region')) {
        path = path.replace(':region', 'IN');
      }

      if (path.includes(':code')) {
        path = path.replace(':code', 'TEST123');
      }

      // Prepare request config
      const requestConfig = {
        method: route.method,
        path: path,
        data: testConfig.body,
        query: testConfig.query
      };

      // Add authentication token
      if (testConfig.requiresAuth || route.protected) {
        if (testConfig.requiresAdmin || route.requiresAdmin) {
          if (!this.tokens.adminToken) {
            throw new Error('Admin token not available');
          }
          requestConfig.token = this.tokens.adminToken;
        } else if (testConfig.requiresFirebase) {
          if (!this.tokens.firebaseToken) {
            throw new Error('Firebase token not available');
          }
          requestConfig.token = this.tokens.firebaseToken;
        } else {
          if (!this.tokens.userToken) {
            throw new Error('User token not available');
          }
          requestConfig.token = this.tokens.userToken;
        }
      }

      // Make request
      const startTime = Date.now();
      const response = await this.makeRequest(requestConfig);
      const responseTime = Date.now() - startTime;

      // Record success
      this.results.push({
        method: route.method,
        path: route.path,
        status: 'SUCCESS',
        statusCode: response.statusCode || 200,
        responseTime: responseTime,
        response: config.showSuccessDetails ? response : { success: response.success, message: response.message },
        timestamp: new Date()
      });

      if (config.verbose) {
        console.log(`✅ ${route.method.padEnd(7)} ${route.path.padEnd(50)} ${responseTime}ms`);
      }

      // Store dynamic IDs from successful responses
      if (response.data) {
        if (response.data.userId && !this.dynamicIds.userId) {
          this.dynamicIds.userId = response.data.userId;
        }
        if (response.data.productId && !this.dynamicIds.productId) {
          this.dynamicIds.productId = response.data.productId;
        }
        if (response.data.orderId && !this.dynamicIds.orderId) {
          this.dynamicIds.orderId = response.data.orderId;
        }
        if (response.data._id) {
          // Store various ID types based on the endpoint path
          if (route.path.includes('/orders') && !this.dynamicIds.orderId) {
            this.dynamicIds.orderId = response.data._id;
          }
          if (route.path.includes('/plans') && !this.dynamicIds.planId) {
            this.dynamicIds.planId = response.data._id;
          }
          if (route.path.includes('/banners') && !this.dynamicIds.bannerId) {
            this.dynamicIds.bannerId = response.data._id;
          }
          if (route.path.includes('/success-stories') && !this.dynamicIds.storyId) {
            this.dynamicIds.storyId = response.data._id;
          }
          if (route.path.includes('/images') && !this.dynamicIds.imageId) {
            this.dynamicIds.imageId = response.data._id;
          }
        }
      }

    } catch (error) {
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.message || error.message;

      // Record failure
      this.results.push({
        method: route.method,
        path: route.path,
        status: 'FAILED',
        statusCode: statusCode,
        error: {
          message: errorMessage,
          response: error.response?.data,
          code: error.response?.data?.code || error.code
        },
        timestamp: new Date()
      });

      if (config.verbose) {
        console.log(`❌ ${route.method.padEnd(7)} ${route.path.padEnd(50)} ${statusCode} - ${errorMessage}`);
      }
    }
  }

  /**
   * Make HTTP request
   */
  async makeRequest({ method, path, data, query, token }) {
    const url = `${this.baseURL}${path}`;

    const requestConfig = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: config.timeout,
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Don't throw on 4xx errors
      }
    };

    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }

    if (query) {
      requestConfig.params = query;
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestConfig.data = data;
    }

    const response = await axios(requestConfig);

    // If status is 4xx or 5xx, throw error
    if (response.status >= 400) {
      const error = new Error(response.data.message || 'Request failed');
      error.response = response;
      throw error;
    }

    return response.data;
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    const total = this.results.length;
    const success = this.results.filter(r => r.status === 'SUCCESS').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 API HEALTH CHECK SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Endpoints:    ${total}`);
    console.log(`✅ Success:         ${success} (${successRate}%)`);
    console.log(`❌ Failed:          ${failed}`);
    console.log(`⏭️  Skipped:         ${skipped}`);
    console.log('='.repeat(80));

    if (failed > 0 && config.showErrorDetails) {
      console.log('\n❌ FAILED ENDPOINTS:\n');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(`  ${r.method} ${r.path}`);
          console.log(`  Status: ${r.statusCode}`);
          console.log(`  Error: ${r.error.message}`);
          if (r.error.code) {
            console.log(`  Code: ${r.error.code}`);
          }
          console.log('');
        });
    }

    console.log('');
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get results
   */
  getResults() {
    return this.results;
  }

  /**
   * Get summary stats
   */
  getStats() {
    const total = this.results.length;
    const success = this.results.filter(r => r.status === 'SUCCESS').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;

    return {
      total,
      success,
      failed,
      skipped,
      successRate
    };
  }
}

module.exports = APITester;
