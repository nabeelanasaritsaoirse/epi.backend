/**
 * Route Extractor Utility
 * Extracts all registered routes from Express app
 */

/**
 * Extracts all routes from Express app
 * @param {Express.Application} app - Express application instance
 * @returns {Array} Array of route objects with method, path, and middleware info
 */
function extractRoutes(app) {
  const routes = [];

  // Helper to check if middleware is an auth middleware
  function isAuthMiddleware(layer) {
    const authNames = ['verifyToken', 'verifyFirebaseToken', 'isAdmin', 'authenticate', 'verifyChatAccess'];
    return authNames.some(name => layer.name === name || (layer.handle && layer.handle.name === name));
  }

  // Helper to process a route layer
  function processLayer(layer, basePath = '') {
    if (layer.route) {
      // This is a route layer
      const path = basePath + layer.route.path;

      // Get all HTTP methods for this route
      Object.keys(layer.route.methods).forEach(method => {
        if (method === '_all') return;

        const middlewares = layer.route.stack.map(l => l.name || l.handle.name).filter(Boolean);
        const isProtected = middlewares.some(m =>
          m.includes('verify') ||
          m.includes('auth') ||
          m.includes('Auth') ||
          m.includes('isAdmin')
        );
        const requiresAdmin = middlewares.some(m => m.includes('isAdmin') || m.includes('Admin'));

        routes.push({
          method: method.toUpperCase(),
          path: path,
          protected: isProtected,
          requiresAdmin: requiresAdmin,
          middlewares: middlewares
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      // This is a router layer
      const routerPath = basePath + (layer.regexp.source
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\$/g, '')
        .replace(/\.\*/g, '')
        .replace(/\\/g, '')
        .replace(/\?/g, '') || '');

      // Recursively process router's stack
      layer.handle.stack.forEach(subLayer => {
        processLayer(subLayer, routerPath);
      });
    }
  }

  // Process all layers in the app
  if (app._router && app._router.stack) {
    app._router.stack.forEach(layer => {
      processLayer(layer);
    });
  }

  // Filter out empty paths and sort
  return routes
    .filter(route => route.path && route.path !== '')
    .filter(route => !route.path.includes('*')) // Remove catch-all routes
    .sort((a, b) => {
      // Sort by path first, then by method
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      return a.method.localeCompare(b.method);
    });
}

/**
 * Groups routes by their base path
 * @param {Array} routes - Array of route objects
 * @returns {Object} Routes grouped by module
 */
function groupRoutesByModule(routes) {
  const groups = {};

  routes.forEach(route => {
    const parts = route.path.split('/').filter(Boolean);
    const module = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : route.path;

    if (!groups[module]) {
      groups[module] = [];
    }
    groups[module].push(route);
  });

  return groups;
}

/**
 * Prints routes in a formatted table
 * @param {Array} routes - Array of route objects
 */
function printRoutes(routes) {
  console.log('\n='.repeat(100));
  console.log('DISCOVERED API ROUTES');
  console.log('='.repeat(100));

  const grouped = groupRoutesByModule(routes);

  Object.keys(grouped).sort().forEach(module => {
    console.log(`\n${module.toUpperCase()}`);
    console.log('-'.repeat(100));

    grouped[module].forEach(route => {
      const method = route.method.padEnd(7);
      const path = route.path.padEnd(50);
      const auth = route.protected ? '🔒' : '🔓';
      const admin = route.requiresAdmin ? '👑' : '  ';

      console.log(`${auth} ${admin} ${method} ${path}`);
    });
  });

  console.log('\n' + '='.repeat(100));
  console.log(`Total Routes: ${routes.length}`);
  console.log(`Protected Routes: ${routes.filter(r => r.protected).length}`);
  console.log(`Admin Routes: ${routes.filter(r => r.requiresAdmin).length}`);
  console.log('='.repeat(100) + '\n');
}

module.exports = {
  extractRoutes,
  groupRoutesByModule,
  printRoutes
};
