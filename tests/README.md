# API Testing System

## Files in this directory

### `apiTester.js`
Main testing logic that:
- Sets up test environment
- Logs in with Firebase token
- Logs in as admin
- Tests each endpoint sequentially
- Captures results and errors
- Generates console summary

### `testData.js`
Sample data for each API endpoint:
- Request bodies
- Query parameters
- Authentication requirements
- Admin requirements

**Add your endpoints here!**

### `testConfig.js`
Configuration settings:
- Base URL
- Test user credentials
- Admin credentials
- Timeout settings
- Routes to skip
- Verbose mode

### `reportGenerator.js`
HTML report generation:
- Beautiful dashboard UI
- Interactive filters
- Expandable endpoint details
- Search functionality
- Auto-refresh

## Quick Start

1. **Update your Firebase token** in `testConfig.js`
2. **Add test data** for your endpoints in `testData.js`
3. **Start your server**: `npm run dev`
4. **Visit**: http://localhost:5000/api/health-check

## Adding New Endpoints

When you create a new API endpoint, add it to `testData.js`:

```javascript
'POST /api/your-endpoint': {
  body: {
    field1: 'value1',
    field2: 'value2'
  },
  requiresAuth: true,
  requiresFirebase: true
}
```

The system will automatically discover and test it!
