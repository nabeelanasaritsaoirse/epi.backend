/**
 * Request Validation Middleware for Installment Order System
 *
 * Validates incoming requests for order creation and payment processing.
 * Returns standardized error responses for validation failures.
 */

const mongoose = require('mongoose');
const { ValidationError } = require('../utils/customErrors');

/**
 * Validate ObjectId format
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validate create order request
 *
 * Required fields:
 * - productId: Valid ObjectId
 * - totalDays: Number, min 5
 * - paymentMethod: 'RAZORPAY' or 'WALLET'
 * - deliveryAddress: Object with required fields
 *
 * Optional fields:
 * - dailyAmount: Number, min 50
 */
function validateCreateOrder(req, res, next) {
  const errors = [];
  const { productId, totalDays, dailyAmount, paymentMethod, deliveryAddress, couponCode, variantId } = req.body;

  // Validate productId
  if (!productId) {
    errors.push({ field: 'productId', message: 'Product ID is required' });
  } else if (!isValidObjectId(productId)) {
    errors.push({ field: 'productId', message: 'Invalid product ID format' });
  }

  // Validate totalDays
  if (!totalDays) {
    errors.push({ field: 'totalDays', message: 'Total days is required' });
  } else if (typeof totalDays !== 'number' || totalDays < 5) {
    errors.push({ field: 'totalDays', message: 'Total days must be a number and at least 5' });
  }

  // Validate dailyAmount (optional)
  if (dailyAmount !== undefined) {
    if (typeof dailyAmount !== 'number' || dailyAmount < 50) {
      errors.push({ field: 'dailyAmount', message: 'Daily amount must be a number and at least ₹50' });
    }
  }

  // Validate couponCode (optional)
  if (couponCode !== undefined) {
    if (typeof couponCode !== 'string' || couponCode.trim().length === 0) {
      errors.push({ field: 'couponCode', message: 'Coupon code must be a non-empty string' });
    } else if (couponCode.length > 50) {
      errors.push({ field: 'couponCode', message: 'Coupon code must be at most 50 characters' });
    }
  }

  // Validate variantId (optional)
  if (variantId !== undefined) {
    if (typeof variantId !== 'string' || variantId.trim().length === 0) {
      errors.push({ field: 'variantId', message: 'Variant ID must be a non-empty string' });
    }
  }

  // Validate paymentMethod
  const validPaymentMethods = ['RAZORPAY', 'WALLET'];
  if (!paymentMethod) {
    errors.push({ field: 'paymentMethod', message: 'Payment method is required' });
  } else if (!validPaymentMethods.includes(paymentMethod)) {
    errors.push({
      field: 'paymentMethod',
      message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
    });
  }

  // Validate deliveryAddress
  if (!deliveryAddress) {
    errors.push({ field: 'deliveryAddress', message: 'Delivery address is required' });
  } else {
    const requiredAddressFields = [
      'name',
      'phoneNumber',
      'addressLine1',
      'city',
      'state',
      'pincode'
    ];

    requiredAddressFields.forEach(field => {
      if (!deliveryAddress[field]) {
        errors.push({
          field: `deliveryAddress.${field}`,
          message: `Delivery address ${field} is required`
        });
      }
    });

    // Validate phone number format
    if (deliveryAddress.phoneNumber) {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(deliveryAddress.phoneNumber)) {
        errors.push({
          field: 'deliveryAddress.phoneNumber',
          message: 'Invalid phone number format (must be 10 digits starting with 6-9)'
        });
      }
    }

    // Validate pincode
    if (deliveryAddress.pincode) {
      const pincodeRegex = /^\d{6}$/;
      if (!pincodeRegex.test(deliveryAddress.pincode)) {
        errors.push({
          field: 'deliveryAddress.pincode',
          message: 'Invalid pincode format (must be 6 digits)'
        });
      }
    }
  }

  // If validation errors, return 400 response
  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate process payment request
 *
 * Required fields:
 * - orderId: Valid ObjectId or custom order ID
 * - paymentMethod: 'RAZORPAY' or 'WALLET'
 *
 * Conditional fields:
 * - If RAZORPAY: razorpayOrderId, razorpayPaymentId, razorpaySignature
 */
function validateProcessPayment(req, res, next) {
  const errors = [];
  const {
    orderId,
    paymentMethod,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  } = req.body;

  // Validate orderId
  if (!orderId) {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  // Validate paymentMethod
  const validPaymentMethods = ['RAZORPAY', 'WALLET'];
  if (!paymentMethod) {
    errors.push({ field: 'paymentMethod', message: 'Payment method is required' });
  } else if (!validPaymentMethods.includes(paymentMethod)) {
    errors.push({
      field: 'paymentMethod',
      message: `Payment method must be one of: ${validPaymentMethods.join(', ')}`
    });
  }

  // Validate Razorpay fields if payment method is RAZORPAY
  if (paymentMethod === 'RAZORPAY') {
    if (!razorpayOrderId) {
      errors.push({ field: 'razorpayOrderId', message: 'Razorpay order ID is required for Razorpay payments' });
    }
    if (!razorpayPaymentId) {
      errors.push({ field: 'razorpayPaymentId', message: 'Razorpay payment ID is required for Razorpay payments' });
    }
    if (!razorpaySignature) {
      errors.push({ field: 'razorpaySignature', message: 'Razorpay signature is required for Razorpay payments' });
    }
  }

  // If validation errors, return 400 response
  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate get order request (URL parameter)
 */
function validateGetOrder(req, res, next) {
  const errors = [];
  const { orderId } = req.params;

  if (!orderId) {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate approve delivery request
 */
function validateApproveDelivery(req, res, next) {
  const errors = [];
  const { orderId } = req.params;

  if (!orderId) {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate update delivery status request
 */
function validateUpdateDeliveryStatus(req, res, next) {
  const errors = [];
  const { orderId } = req.params;
  const { status } = req.body;

  if (!orderId) {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  const validStatuses = ['PENDING', 'APPROVED', 'SHIPPED', 'DELIVERED'];
  if (!status) {
    errors.push({ field: 'status', message: 'Status is required' });
  } else if (!validStatuses.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${validStatuses.join(', ')}`
    });
  }

  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate cancel order request
 */
function validateCancelOrder(req, res, next) {
  const errors = [];
  const { orderId } = req.params;
  const { reason } = req.body;

  if (!orderId) {
    errors.push({ field: 'orderId', message: 'Order ID is required' });
  }

  if (!reason || reason.trim().length === 0) {
    errors.push({ field: 'reason', message: 'Cancellation reason is required' });
  } else if (reason.length < 10) {
    errors.push({ field: 'reason', message: 'Cancellation reason must be at least 10 characters' });
  }

  if (errors.length > 0) {
    const validationError = new ValidationError(errors);
    return res.status(400).json(validationError.toJSON());
  }

  next();
}

/**
 * Validate query parameters (for listing endpoints)
 */
function validateQueryParams(req, res, next) {
  const { limit, skip, page } = req.query;

  // Validate and sanitize limit
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY_PARAM',
          message: 'Limit must be a number between 1 and 100'
        }
      });
    }
    req.query.limit = parsedLimit;
  }

  // Validate and sanitize skip
  if (skip !== undefined) {
    const parsedSkip = parseInt(skip);
    if (isNaN(parsedSkip) || parsedSkip < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY_PARAM',
          message: 'Skip must be a non-negative number'
        }
      });
    }
    req.query.skip = parsedSkip;
  }

  // Validate and sanitize page
  if (page !== undefined) {
    const parsedPage = parseInt(page);
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY_PARAM',
          message: 'Page must be a positive number'
        }
      });
    }
    req.query.page = parsedPage;
  }

  next();
}

/**
 * Sanitize user input to prevent XSS and injection
 */
function sanitizeInput(req, res, next) {
  // Basic XSS prevention - strip HTML tags from string fields
  const stripHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  };

  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = stripHtml(obj[key]);
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }

    return obj;
  };

  req.body = sanitizeObject(req.body);
  next();
}

module.exports = {
  validateCreateOrder,
  validateProcessPayment,
  validateGetOrder,
  validateApproveDelivery,
  validateUpdateDeliveryStatus,
  validateCancelOrder,
  validateQueryParams,
  sanitizeInput
};
