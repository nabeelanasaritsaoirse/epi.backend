# 🔍 API Health Check System - Complete Guide

## Overview

This is a comprehensive API testing and health check system that automatically discovers, tests, and reports on all your API endpoints. It provides a beautiful dashboard accessible in your browser with detailed error information and success metrics.

---

## 🚀 Quick Start

### 1. Start Your Server

```bash
npm run dev
# or
npm start
```

### 2. Access the Dashboard

Open your browser and visit:

```
http://localhost:5000/api/health-check
```

**That's it!** The system will automatically:
- Discover all your API routes
- Test each endpoint with sample data
- Generate a beautiful HTML report
- Show success/failure status for each API

---

## 📁 File Structure

```
epi-backend-new/
├── tests/
│   ├── apiTester.js           # Main testing logic
│   ├── testData.js            # Sample data for each endpoint
│   ├── testConfig.js          # Configuration settings
│   └── reportGenerator.js     # HTML report generation
├── utils/
│   └── routeExtractor.js      # Extract routes from Express app
├── routes/
│   └── healthCheckRoutes.js   # Health check dashboard endpoints
└── app.js                     # Updated with health check route
```

---

## 🎯 Available Endpoints

### 1. **Dashboard (Browser)**
```
GET /api/health-check
```
- Beautiful HTML dashboard
- Interactive UI with filters
- Click to expand endpoint details
- Auto-refresh every 5 minutes
- Search functionality

### 2. **Force Run Tests**
```
POST /api/health-check/run
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/health-check/run
```

**Response:**
```json
{
  "success": true,
  "message": "Tests completed successfully",
  "timestamp": "2024-01-21T10:30:00.000Z",
  "results": {
    "total": 45,
    "success": 38,
    "failed": 5,
    "skipped": 2,
    "successRate": "84.4%"
  },
  "dashboardUrl": "/api/health-check"
}
```

### 3. **Get JSON Results**
```
GET /api/health-check/json
```

**Example:**
```bash
curl http://localhost:5000/api/health-check/json
```

Returns full test results in JSON format.

### 4. **Get All Routes**
```
GET /api/health-check/routes
```

Lists all discovered API routes grouped by module.

**Example:**
```bash
curl http://localhost:5000/api/health-check/routes
```

### 5. **Quick Status**
```
GET /api/health-check/status
```

Lightweight health check without running full tests.

### 6. **Clear Cache**
```
DELETE /api/health-check/cache
```

Forces fresh tests on next request.

---

## ⚙️ Configuration

Edit `tests/testConfig.js` to customize:

```javascript
module.exports = {
  // Base URL for testing
  baseURL: 'http://localhost:5000',

  // Test user Firebase token
  testUser: {
    firebaseToken: 'your_firebase_token_here',
    email: 'test@example.com'
  },

  // Admin credentials
  adminUser: {
    email: 'admin@epi.com',
    password: 'Admin@123456'
  },

  // Request timeout
  timeout: 10000,

  // Routes to skip
  skipRoutes: [
    '/ping',
    '/api/ping',
    '/api/health-check'
  ],

  // Console output
  verbose: true,
  showSuccessDetails: false,
  showErrorDetails: true
};
```

---

## 📝 Adding Test Data for Your Endpoints

Edit `tests/testData.js` to add test data for your endpoints:

```javascript
const testData = {
  // Your endpoint
  'POST /api/your-endpoint': {
    body: {
      field1: 'value1',
      field2: 'value2'
    },
    requiresAuth: true,        // Needs authentication
    requiresAdmin: false,      // Needs admin role
    requiresFirebase: true     // Use Firebase token
  },

  'GET /api/your-endpoint/:id': {
    params: { id: 'DYNAMIC_ID' },  // Will be replaced
    query: { page: 1, limit: 10 },
    requiresAuth: true
  }
};
```

### Dynamic ID Replacement

The system automatically replaces these placeholders:
- `:userId` → Logged-in user's ID
- `:id` → Notification/Category/Product ID
- `:conversationId` → Chat conversation ID
- `DYNAMIC_PRODUCT_ID` → Sample product ID

---

## 🎨 Dashboard Features

### Visual Elements

1. **Stats Cards**
   - Total endpoints
   - Success count and percentage
   - Failed count
   - Skipped count
   - Average response time

2. **Filters**
   - Show All
   - Show Success Only
   - Show Failed Only
   - Show Skipped Only
   - Search by endpoint path/method

3. **Endpoint Cards**
   - Color-coded HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Status badges (Success, Failed, Skipped)
   - Response time
   - Click to expand for details

4. **Expanded Details**
   - Full response for successful requests
   - Error messages for failed requests
   - Status codes
   - Error codes
   - Timestamps

### Auto-Refresh

The dashboard automatically refreshes every 5 minutes. Tests are cached for 5 minutes to avoid excessive testing.

---

## 🔧 How It Works

### 1. Route Discovery
```javascript
// utils/routeExtractor.js
const { extractRoutes } = require('./utils/routeExtractor');
const routes = extractRoutes(app);
```

Automatically discovers all routes from your Express app.

### 2. Authentication
```javascript
// Logs in with Firebase token
// Gets user JWT token
// Logs in as admin
// Stores tokens for protected routes
```

### 3. Testing
```javascript
// For each route:
// - Get test data from testData.js
// - Replace dynamic IDs
// - Add authentication if needed
// - Make HTTP request
// - Record result (success/failure)
// - Capture response time
```

### 4. Reporting
```javascript
// Generate beautiful HTML with:
// - Summary statistics
// - Interactive filters
// - Detailed results
// - Error information
```

---

## 📊 Example Output

### Console Output
```
🚀 STARTING API HEALTH CHECK
================================================================================
Base URL: http://localhost:5000
Total Routes: 45
Time: 11/21/2024, 10:30:00 AM
================================================================================

📋 SETTING UP TEST ENVIRONMENT

  🔐 Logging in with Firebase token...
  ✅ User logged in successfully
  📝 User ID: 673e9f5d6a8b2c1234567890

  🔐 Logging in as admin...
  ✅ Admin logged in successfully

  📦 Fetching sample category...
  ✅ Sample category fetched

================================================================================
✅ TEST ENVIRONMENT READY
================================================================================

✅ POST    /api/auth/login                                  245ms
✅ POST    /api/auth/signup                                 156ms
✅ GET     /api/categories                                   89ms
✅ GET     /api/notifications                               134ms
❌ POST    /api/orders/create                               401 - Insufficient wallet balance
✅ GET     /api/chat/conversations                          167ms

================================================================================
📊 API HEALTH CHECK SUMMARY
================================================================================
Total Endpoints:    45
✅ Success:         38 (84.4%)
❌ Failed:          5
⏭️  Skipped:        2
================================================================================

❌ FAILED ENDPOINTS:

  POST /api/orders/create
  Status: 400
  Error: Insufficient wallet balance
  Code: INSUFFICIENT_BALANCE

  ...
```

### Browser Dashboard

The HTML dashboard shows:
- 📊 **Stats** (Total: 45, Success: 38, Failed: 5, Skipped: 2)
- 🎯 **Filters** (All, Success, Failed, Skipped, Search)
- 📋 **Endpoint List** with expandable details
- 🎨 **Color-coded** status badges and HTTP methods
- ⚡ **Response times** for each endpoint

---

## 🛠️ Customization

### Change Firebase Token

Edit `tests/testConfig.js`:
```javascript
testUser: {
  firebaseToken: 'YOUR_NEW_TOKEN_HERE',
  email: 'your-email@example.com'
}
```

### Add More Endpoints

Edit `tests/testData.js` and add your endpoint:
```javascript
'POST /api/my-new-endpoint': {
  body: { /* your test data */ },
  requiresAuth: true
}
```

### Adjust Caching

Edit `routes/healthCheckRoutes.js`:
```javascript
// Change from 5 minutes to 10 minutes
const shouldRunTests = !lastTestResults || (Date.now() - lastTestTime > 10 * 60 * 1000);
```

### Change Report Styling

Edit `tests/reportGenerator.js` to customize colors, fonts, layout, etc.

---

## 🎯 Use Cases

### 1. Development
- Test all endpoints during development
- Verify authentication is working
- Check response times
- Find broken endpoints quickly

### 2. Before Deployment
```bash
# Run health check before deploying
curl -X POST http://localhost:5000/api/health-check/run

# Check if all critical endpoints pass
curl http://localhost:5000/api/health-check/json | grep '"failed": 0'
```

### 3. Monitoring
- Set up periodic checks
- Monitor API health in production
- Get alerts on failures

### 4. Documentation
- Share the dashboard URL with your team
- Visual representation of all APIs
- Easy way to see what endpoints exist

---

## 🔐 Security Notes

1. **Don't expose in production** without authentication
2. **Protect the endpoint** with IP whitelisting or basic auth
3. **Use environment variables** for sensitive tokens
4. **Limit access** to internal networks only

### Example: Add Basic Auth Protection

```javascript
// In routes/healthCheckRoutes.js
const basicAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== 'Basic YOUR_TOKEN_HERE') {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).send('Authentication required');
  }
  next();
};

router.get('/', basicAuth, async (req, res) => {
  // ... rest of code
});
```

---

## 🐛 Troubleshooting

### Tests Not Running

**Problem:** Dashboard shows "No tests run yet"

**Solution:**
```bash
# Force run tests
curl -X POST http://localhost:5000/api/health-check/run

# Or clear cache
curl -X DELETE http://localhost:5000/api/health-check/cache
```

### Authentication Failures

**Problem:** Many endpoints failing with 401 Unauthorized

**Solution:**
1. Check your Firebase token in `tests/testConfig.js`
2. Verify token hasn't expired
3. Check admin credentials

### Dynamic IDs Not Working

**Problem:** Endpoints with `:id` failing

**Solution:**
1. Ensure setup creates sample data
2. Check `dynamicIds` in `tests/apiTester.js`
3. Add setup logic to fetch required IDs

### Timeout Errors

**Problem:** Tests timing out

**Solution:**
Edit `tests/testConfig.js`:
```javascript
timeout: 30000  // Increase to 30 seconds
```

---

## 📈 Advanced Usage

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: API Health Check

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start Server
        run: npm start &
      - name: Wait for Server
        run: sleep 10
      - name: Run Health Check
        run: |
          curl -X POST http://localhost:5000/api/health-check/run
          curl http://localhost:5000/api/health-check/json | jq '.summary.failed == 0'
```

### Scheduled Monitoring

```javascript
// Add to your server startup
const cron = require('node-cron');

// Run health check every hour
cron.schedule('0 * * * *', async () => {
  const response = await fetch('http://localhost:5000/api/health-check/run', {
    method: 'POST'
  });
  const data = await response.json();

  if (data.results.failed > 0) {
    // Send alert (email, Slack, etc.)
    console.error(`⚠️ ${data.results.failed} API endpoints are failing!`);
  }
});
```

---

## 🎉 Summary

You now have a complete API testing system that:

✅ **Automatically discovers** all your API routes
✅ **Tests each endpoint** with valid sample data
✅ **Catches and logs** errors with full details
✅ **Generates beautiful reports** with interactive UI
✅ **Provides multiple formats** (HTML, JSON, Console)
✅ **Caches results** for performance
✅ **Supports authentication** (Firebase, JWT, Admin)
✅ **Handles dynamic IDs** automatically
✅ **Shows response times** for performance monitoring
✅ **Filterable and searchable** results

---

## 📞 Next Steps

1. **Customize test data** in `tests/testData.js` for your endpoints
2. **Update Firebase token** if needed
3. **Add more endpoints** as you build new features
4. **Share the dashboard** with your team
5. **Set up monitoring** for production

---

## 🙌 Credits

Built with ❤️ for comprehensive API testing and health monitoring.

**Technologies Used:**
- Express.js
- Axios
- Custom route extraction
- Beautiful HTML/CSS/JS reporting

**Last Updated:** November 2024
