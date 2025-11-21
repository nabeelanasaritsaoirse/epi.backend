/**
 * Test Configuration
 * Contains all configuration settings for API testing
 */

module.exports = {
  // Base URL for API testing
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:5000',

  // Test user credentials
  testUser: {
    firebaseToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1NzMzYmJiZDgxOGFhNWRiMTk1MTk5Y2Q1NjhlNWQ2ODUxMzJkM2YiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI0ODY4Mjk1NjQwNzAtaW4wZDV1MWJyY2UzMzY0bDRkdjBlanRxMWdvZm9nbXMuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI0ODY4Mjk1NjQwNzAtbWtya200djl0amkyNDl0NnU3Z2RmaWVmdXBzMDlnczQuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTU1NTE1NTk3NTEzNTU5MjM4MjQiLCJlbWFpbCI6InJhdGhvZGRlZXByQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiRGVlcCBSYXRob2QiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS0pseXhIaVE1Rmhfc2kwODRpWU40d1B1TF82VTdnSG9qNEFfbm94UHFhV1c4bHl2ST1zOTYtYyIsImdpdmVuX25hbWUiOiJEZWVwIiwiZmFtaWx5X25hbWUiOiJSYXRob2QiLCJpYXQiOjE3NjM2NTExOTUsImV4cCI6MTc2MzY1NDc5NX0.ij8Ox4mCKU4AWHNVVYNXNPfa91OBVEex-jrZuaCL57HAzxYLtj3SHyBnNj8q0_GDL59H1R9CImWqbZEAiwhkCZdmVeQisHxiPJ5qn480Da9qFXYL1oFItm_g1xJBE-Nl4TsG2TPPbY7B9zo0d6sw0lP1mI6KaJ6ouXdpOkYlUIbq-YdkKiibaZEtJsJjY_4_vN5TV6pnxgSrCMOcgBapFWXDJEpxZ8UfBnrb5LxTA6u7s_OK0RLbHFfrp5QrjrDcFaVKMATt',
    email: 'rathoddeepre@gmail.com',
    name: 'Deep Rathod'
  },

  // Admin credentials
  adminUser: {
    email: process.env.ADMIN_EMAIL || 'admin@epi.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456'
  },

  // Request timeout (in milliseconds)
  timeout: 10000,

  // Retry configuration
  retry: {
    enabled: false,
    maxRetries: 2,
    retryDelay: 1000
  },

  // Routes to skip during testing
  skipRoutes: [
    '/ping',
    '/api/ping',
    '/api/health-check',
    '/api/health-check/run',
    '/api/health-check/json'
  ],

  // Test data limits
  limits: {
    maxTestUsers: 5,
    maxTestProducts: 10,
    maxTestOrders: 5
  },

  // Console output settings
  verbose: true,
  showSuccessDetails: false,
  showErrorDetails: true,

  // Report settings
  report: {
    generateHTML: true,
    generateJSON: true,
    saveToFile: true,
    outputDir: './test-results'
  }
};
