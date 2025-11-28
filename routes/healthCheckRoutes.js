/**
 * Health Check Routes
 * Provides API testing dashboard and endpoints
 */

const express = require('express');
const router = express.Router();
const APITester = require('../tests/apiTester');
const { generateHTMLReport } = require('../tests/reportGenerator');
const { extractRoutes, printRoutes } = require('../utils/routeExtractor');

// Store last test results in memory
let lastTestResults = null;
let lastTestTime = null;
let isTestRunning = false;

/**
 * GET /api/health-check
 * Display health check dashboard with beautiful UI
 */
router.get('/', async (req, res) => {
  try {
    // If tests are currently running, show loading page
    if (isTestRunning) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>API Health Check - Running</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
            }
            .loading {
              text-align: center;
              color: white;
            }
            .spinner {
              border: 8px solid rgba(255,255,255,0.3);
              border-top: 8px solid white;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              animation: spin 1s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 { font-size: 32px; margin-bottom: 10px; }
            p { font-size: 16px; opacity: 0.9; }
          </style>
          <script>
            setTimeout(() => location.reload(), 3000);
          </script>
        </head>
        <body>
          <div class="loading">
            <div class="spinner"></div>
            <h1>🔍 Running API Health Check</h1>
            <p>Please wait while we test all your endpoints...</p>
            <p style="font-size: 14px; margin-top: 20px;">Page will auto-refresh in 3 seconds</p>
          </div>
        </body>
        </html>
      `);
    }

    // If no tests run yet or older than 5 minutes, run new test
    const shouldRunTests = !lastTestResults || (Date.now() - lastTestTime > 5 * 60 * 1000);

    if (shouldRunTests) {
      // Run tests in background
      isTestRunning = true;

      try {
        // Get all routes from the app
        const app = req.app;
        const routes = extractRoutes(app);

        console.log('\n🔍 Running API Health Check...');
        console.log(`Found ${routes.length} routes`);

        // Run tests
        const tester = new APITester();
        lastTestResults = await tester.testAllEndpoints(routes);
        lastTestTime = Date.now();

        console.log('✅ Health check completed');
      } catch (error) {
        console.error('❌ Health check failed:', error);
        lastTestResults = [{
          method: 'ERROR',
          path: '/health-check',
          status: 'FAILED',
          error: {
            message: error.message,
            stack: error.stack
          },
          timestamp: new Date()
        }];
        lastTestTime = Date.now();
      } finally {
        isTestRunning = false;
      }
    }

    // Generate and send HTML report
    const html = generateHTMLReport(lastTestResults);
    res.send(html);

  } catch (error) {
    console.error('Error in health check route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/health-check/run
 * Force run new tests immediately
 */
router.post('/run', async (req, res) => {
  try {
    if (isTestRunning) {
      return res.status(409).json({
        success: false,
        message: 'Tests are already running. Please wait.'
      });
    }

    // Run tests
    isTestRunning = true;

    try {
      const app = req.app;
      const routes = extractRoutes(app);

      console.log('\n🔍 Running API Health Check (Manual Trigger)...');

      const tester = new APITester();
      lastTestResults = await tester.testAllEndpoints(routes);
      lastTestTime = Date.now();

      const stats = tester.getStats();

      res.json({
        success: true,
        message: 'Tests completed successfully',
        timestamp: new Date(lastTestTime).toISOString(),
        results: stats,
        dashboardUrl: '/api/health-check'
      });

    } finally {
      isTestRunning = false;
    }

  } catch (error) {
    isTestRunning = false;
    console.error('Error running tests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health-check/json
 * Get test results as JSON
 */
router.get('/json', (req, res) => {
  if (!lastTestResults) {
    return res.json({
      success: false,
      message: 'No tests run yet. Visit /api/health-check to run tests or POST to /api/health-check/run',
      instructions: {
        dashboard: 'GET /api/health-check',
        runTests: 'POST /api/health-check/run',
        jsonResults: 'GET /api/health-check/json',
        routes: 'GET /api/health-check/routes'
      }
    });
  }

  const total = lastTestResults.length;
  const success = lastTestResults.filter(r => r.status === 'SUCCESS').length;
  const failed = lastTestResults.filter(r => r.status === 'FAILED').length;
  const skipped = lastTestResults.filter(r => r.status === 'SKIPPED').length;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;

  res.json({
    success: true,
    lastTestTime: new Date(lastTestTime).toISOString(),
    summary: {
      total,
      success,
      failed,
      skipped,
      successRate: `${successRate}%`
    },
    results: lastTestResults,
    _links: {
      dashboard: '/api/health-check',
      runTests: '/api/health-check/run',
      routes: '/api/health-check/routes'
    }
  });
});

/**
 * GET /api/health-check/routes
 * Get list of all discovered routes
 */
router.get('/routes', (req, res) => {
  try {
    const app = req.app;
    const routes = extractRoutes(app);

    const grouped = {};
    routes.forEach(route => {
      const parts = route.path.split('/').filter(Boolean);
      const module = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : route.path;

      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push({
        method: route.method,
        path: route.path,
        protected: route.protected,
        requiresAdmin: route.requiresAdmin
      });
    });

    const stats = {
      total: routes.length,
      protected: routes.filter(r => r.protected).length,
      admin: routes.filter(r => r.requiresAdmin).length,
      public: routes.filter(r => !r.protected).length
    };

    res.json({
      success: true,
      stats,
      modules: grouped,
      routes: routes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health-check/status
 * Quick status check (lightweight)
 */
router.get('/status', (req, res) => {
  const status = {
    server: 'running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    lastTestTime: lastTestTime ? new Date(lastTestTime).toISOString() : null,
    isTestRunning: isTestRunning
  };

  if (lastTestResults) {
    const total = lastTestResults.length;
    const success = lastTestResults.filter(r => r.status === 'SUCCESS').length;
    const failed = lastTestResults.filter(r => r.status === 'FAILED').length;

    status.lastTestResults = {
      total,
      success,
      failed,
      successRate: `${((success / total) * 100).toFixed(1)}%`
    };
  }

  res.json(status);
});

/**
 * DELETE /api/health-check/cache
 * Clear cached test results
 */
router.delete('/cache', (req, res) => {
  lastTestResults = null;
  lastTestTime = null;

  res.json({
    success: true,
    message: 'Cache cleared. Next request will run fresh tests.'
  });
});

module.exports = router;
