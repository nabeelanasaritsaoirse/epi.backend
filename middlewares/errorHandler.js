/**
 * Global Error Handling Middleware
 *
 * Catches and formats errors into standardized API responses.
 * Handles both operational errors (expected) and programming errors (unexpected).
 */

const { AppError } = require('../utils/customErrors');

/**
 * Format error response
 * @param {Error} err - Error object
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(err) {
  // If it's our custom AppError, use its toJSON method
  if (err instanceof AppError) {
    return {
      ...err.toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: err.requestId || null
      }
    };
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));

    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return {
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${err.path}: ${err.value}`,
        details: {}
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return {
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: `Duplicate value for ${field}`,
        details: { field }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        details: {}
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  if (err.name === 'TokenExpiredError') {
    return {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        details: {}
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Default unknown error
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      details: process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Error handler middleware
 * Must be used after all routes
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Error caught by error handler:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    isOperational: err.isOperational,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Format error response
  const errorResponse = formatErrorResponse(err);

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 *
 * Usage:
 * router.get('/endpoint', asyncHandler(async (req, res) => {
 *   // Your async code here
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be used before the error handler middleware
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.url}`);
  error.statusCode = 404;
  error.errorCode = 'ROUTE_NOT_FOUND';
  next(error);
}

/**
 * Success response formatter
 * Standardizes success responses
 */
function successResponse(res, data, message = 'Success', statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  successResponse,
  formatErrorResponse
};
