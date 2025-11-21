# 🚀 API Health Check - Quick Start

## ⚡ 3-Step Setup

### 1️⃣ Start Your Server
```bash
npm run dev
```

### 2️⃣ Open Browser
```
http://localhost:5000/api/health-check
```

### 3️⃣ Done!
View your beautiful API dashboard 🎉

---

## 📍 All Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/api/health-check` | 🎨 **Beautiful HTML Dashboard** |
| **POST** | `/api/health-check/run` | 🔄 Force run new tests |
| **GET** | `/api/health-check/json` | 📊 Get results as JSON |
| **GET** | `/api/health-check/routes` | 🗺️ List all discovered routes |
| **GET** | `/api/health-check/status` | ⚡ Quick status check |
| **DELETE** | `/api/health-check/cache` | 🗑️ Clear cache |

---

## 📝 Example Commands

### View Dashboard
```bash
# Just open in browser:
http://localhost:5000/api/health-check
```

### Force Run Tests
```bash
curl -X POST http://localhost:5000/api/health-check/run
```

### Get JSON Results
```bash
curl http://localhost:5000/api/health-check/json
```

### List All Routes
```bash
curl http://localhost:5000/api/health-check/routes
```

### Quick Status
```bash
curl http://localhost:5000/api/health-check/status
```

---

## 🎯 What You Get

✅ **Auto-Discovery**: Finds all your API routes automatically
✅ **Beautiful UI**: Interactive dashboard with filters and search
✅ **Detailed Reports**: See exactly what passed/failed
✅ **Response Times**: Monitor API performance
✅ **Error Details**: Full error messages and stack traces
✅ **Authentication**: Supports Firebase & JWT tokens
✅ **Smart Caching**: Tests cached for 5 minutes
✅ **Zero Config**: Works out of the box!

---

## 🎨 Dashboard Features

- 📊 **Stats Cards**: Total, Success, Failed, Skipped counts
- 🎯 **Filters**: Show All, Success Only, Failed Only, Skipped
- 🔍 **Search**: Find endpoints by path or method
- 🖱️ **Click to Expand**: See full response/error details
- ⚡ **Performance**: Response time for each endpoint
- 🔄 **Auto-Refresh**: Updates every 5 minutes

---

## ⚙️ Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| **testConfig.js** | Settings & credentials | `tests/testConfig.js` |
| **testData.js** | Test data for endpoints | `tests/testData.js` |
| **apiTester.js** | Testing logic | `tests/apiTester.js` |
| **reportGenerator.js** | HTML generation | `tests/reportGenerator.js` |
| **routeExtractor.js** | Route discovery | `utils/routeExtractor.js` |

---

## 🔧 Customization

### Update Firebase Token
Edit `tests/testConfig.js`:
```javascript
testUser: {
  firebaseToken: 'YOUR_TOKEN_HERE'
}
```

### Add Test Data for New Endpoint
Edit `tests/testData.js`:
```javascript
'POST /api/your-endpoint': {
  body: { /* your data */ },
  requiresAuth: true
}
```

### Change Cache Duration
Edit `routes/healthCheckRoutes.js`:
```javascript
// Change 5 minutes to your preference
const shouldRunTests = !lastTestResults ||
  (Date.now() - lastTestTime > 5 * 60 * 1000);
```

---

## 🐛 Troubleshooting

### Dashboard shows "No tests run yet"
```bash
# Force run tests
curl -X POST http://localhost:5000/api/health-check/run
```

### Many 401 errors
1. Check Firebase token in `tests/testConfig.js`
2. Verify token hasn't expired
3. Check admin credentials

### Tests timing out
Edit `tests/testConfig.js`:
```javascript
timeout: 30000  // Increase to 30 seconds
```

---

## 📚 Full Documentation

For complete documentation, see:
- `API_HEALTH_CHECK_GUIDE.md` - Full guide
- `tests/README.md` - Testing files overview

---

## 🎉 That's It!

Your API health check system is ready to use!

**Quick Links:**
- Dashboard: http://localhost:5000/api/health-check
- JSON Results: http://localhost:5000/api/health-check/json
- All Routes: http://localhost:5000/api/health-check/routes

**Happy Testing! 🚀**
