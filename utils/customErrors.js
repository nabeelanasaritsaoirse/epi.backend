/**
 * Custom Error Classes for Order & Payment System
 * Provides standardized error handling with proper HTTP status codes
 */

/**
 * Base Application Error
 * All custom errors extend from this class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Indicates this is a known error
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.details
      }
    };
  }
}

/**
 * Order Not Found - 404
 * Thrown when requested order doesn't exist
 */
class OrderNotFoundError extends AppError {
  constructor(orderId = null) {
    super(
      'Order not found',
      404,
      'ORDER_NOT_FOUND',
      orderId ? { orderId } : {}
    );
  }
}

/**
 * Product Not Found - 404
 * Thrown when requested product doesn't exist
 */
class ProductNotFoundError extends AppError {
  constructor(productId = null) {
    super(
      'Product not found',
      404,
      'PRODUCT_NOT_FOUND',
      productId ? { productId } : {}
    );
  }
}

/**
 * Insufficient Wallet Balance - 400
 * Thrown when user doesn't have enough balance for operation
 */
class InsufficientWalletBalanceError extends AppError {
  constructor(required, available) {
    super(
      'Insufficient wallet balance',
      400,
      'INSUFFICIENT_BALANCE',
      {
        required: parseFloat(required),
        available: parseFloat(available),
        shortfall: parseFloat(required - available)
      }
    );
  }
}

/**
 * Payment Already Processed - 409
 * Thrown when attempting to process duplicate payment (idempotency check)
 */
class PaymentAlreadyProcessedError extends AppError {
  constructor(paymentId = null) {
    super(
      'Payment has already been processed',
      409,
      'PAYMENT_ALREADY_PROCESSED',
      paymentId ? { paymentId } : {}
    );
  }
}

/**
 * Invalid Payment Method - 400
 * Thrown when payment method is not supported or invalid
 */
class InvalidPaymentMethodError extends AppError {
  constructor(providedMethod, allowedMethods = ['RAZORPAY', 'WALLET']) {
    super(
      'Invalid payment method',
      400,
      'INVALID_PAYMENT_METHOD',
      {
        provided: providedMethod,
        allowed: allowedMethods
      }
    );
  }
}

/**
 * Order Already Completed - 400
 * Thrown when trying to process payment for fully paid order
 */
class OrderAlreadyCompletedError extends AppError {
  constructor(orderId = null) {
    super(
      'Order has already been completed. All payments received.',
      400,
      'ORDER_ALREADY_COMPLETED',
      orderId ? { orderId } : {}
    );
  }
}

/**
 * Unauthorized Order Access - 403
 * Thrown when user tries to access/modify order they don't own
 */
class UnauthorizedOrderAccessError extends AppError {
  constructor(orderId = null) {
    super(
      'You are not authorized to access this order',
      403,
      'UNAUTHORIZED_ORDER_ACCESS',
      orderId ? { orderId } : {}
    );
  }
}

/**
 * Invalid Payment Amount - 400
 * Thrown when payment amount doesn't match expected amount
 */
class InvalidPaymentAmountError extends AppError {
  constructor(expected, received) {
    super(
      'Payment amount does not match daily installment amount',
      400,
      'INVALID_PAYMENT_AMOUNT',
      {
        expected: parseFloat(expected),
        received: parseFloat(received)
      }
    );
  }
}

/**
 * Invalid Order Status - 400
 * Thrown when order is not in correct status for operation
 */
class InvalidOrderStatusError extends AppError {
  constructor(currentStatus, requiredStatus) {
    super(
      'Order is not in valid status for this operation',
      400,
      'INVALID_ORDER_STATUS',
      {
        current: currentStatus,
        required: requiredStatus
      }
    );
  }
}

/**
 * Razorpay Signature Verification Failed - 400
 * Thrown when Razorpay payment signature verification fails
 */
class RazorpayVerificationError extends AppError {
  constructor() {
    super(
      'Payment verification failed. Invalid signature.',
      400,
      'RAZORPAY_VERIFICATION_FAILED',
      {}
    );
  }
}

/**
 * Product Out of Stock - 400
 * Thrown when product is not available for purchase
 */
class ProductOutOfStockError extends AppError {
  constructor(productId = null) {
    super(
      'Product is currently out of stock',
      400,
      'PRODUCT_OUT_OF_STOCK',
      productId ? { productId } : {}
    );
  }
}

/**
 * Invalid Installment Duration - 400
 * Thrown when installment days are outside allowed range
 */
class InvalidInstallmentDurationError extends AppError {
  constructor(provided, min, max) {
    super(
      'Installment duration is outside allowed range',
      400,
      'INVALID_INSTALLMENT_DURATION',
      {
        provided: parseInt(provided),
        min: parseInt(min),
        max: parseInt(max)
      }
    );
  }
}

/**
 * Validation Error - 400
 * Thrown when request validation fails
 */
class ValidationError extends AppError {
  constructor(errors) {
    super(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors }
    );
  }
}

/**
 * User Not Found - 404
 * Thrown when user doesn't exist
 */
class UserNotFoundError extends AppError {
  constructor(userId = null) {
    super(
      'User not found',
      404,
      'USER_NOT_FOUND',
      userId ? { userId } : {}
    );
  }
}

/**
 * Transaction Failed - 500
 * Thrown when database transaction fails
 */
class TransactionFailedError extends AppError {
  constructor(reason = 'Database transaction failed') {
    super(
      reason,
      500,
      'TRANSACTION_FAILED',
      {}
    );
  }
}

/**
 * Bulk Order Error - 400
 * Thrown when bulk order creation fails for some items
 */
class BulkOrderError extends AppError {
  constructor(message, successfulOrders = [], failedItems = []) {
    super(
      message,
      400,
      'BULK_ORDER_ERROR',
      {
        successfulOrders,
        failedItems,
        successCount: successfulOrders.length,
        failedCount: failedItems.length
      }
    );
  }
}

/**
 * Bulk Order Not Found - 404
 * Thrown when bulk order doesn't exist
 */
class BulkOrderNotFoundError extends AppError {
  constructor(bulkOrderId = null) {
    super(
      'Bulk order not found',
      404,
      'BULK_ORDER_NOT_FOUND',
      bulkOrderId ? { bulkOrderId } : {}
    );
  }
}

/**
 * Address Not Found - 404
 * Thrown when requested address doesn't exist
 */
class AddressNotFoundError extends AppError {
  constructor(addressId = null) {
    super(
      'Address not found',
      404,
      'ADDRESS_NOT_FOUND',
      addressId ? { addressId } : {}
    );
  }
}

/**
 * Bank Account Not Found - 404
 * Thrown when requested bank account doesn't exist
 */
class BankAccountNotFoundError extends AppError {
  constructor(bankAccountId = null) {
    super(
      'Bank account not found',
      404,
      'BANK_ACCOUNT_NOT_FOUND',
      bankAccountId ? { bankAccountId } : {}
    );
  }
}

/**
 * KYC Not Verified - 403
 * Thrown when user attempts withdrawal without KYC verification
 */
class KYCNotVerifiedError extends AppError {
  constructor(details = {}) {
    super(
      'KYC verification required to perform this action',
      403,
      'KYC_NOT_VERIFIED',
      details
    );
  }
}

/**
 * KYC Document Not Found - 404
 * Thrown when requested KYC document doesn't exist
 */
class KYCDocumentNotFoundError extends AppError {
  constructor(documentId = null) {
    super(
      'KYC document not found',
      404,
      'KYC_DOCUMENT_NOT_FOUND',
      documentId ? { documentId } : {}
    );
  }
}

/**
 * Duplicate Bank Account - 409
 * Thrown when user attempts to add a duplicate bank account
 */
class DuplicateBankAccountError extends AppError {
  constructor(accountNumber = null) {
    super(
      'Bank account already exists',
      409,
      'DUPLICATE_BANK_ACCOUNT',
      accountNumber ? { accountNumber: accountNumber.slice(-4) } : {}
    );
  }
}

// ============================================
// REVIEW SYSTEM ERRORS
// ============================================

/**
 * Review Not Found - 404
 * Thrown when requested review doesn't exist
 */
class ReviewNotFoundError extends AppError {
  constructor(reviewId = null) {
    super(
      'Review not found',
      404,
      'REVIEW_NOT_FOUND',
      reviewId ? { reviewId } : {}
    );
  }
}

/**
 * Duplicate Review - 409
 * Thrown when user already reviewed this product
 */
class DuplicateReviewError extends AppError {
  constructor(productId = null) {
    super(
      'You have already reviewed this product',
      409,
      'DUPLICATE_REVIEW',
      productId ? { productId } : {}
    );
  }
}

/**
 * Order Not Delivered - 400
 * Thrown when user tries to review without DELIVERED order
 */
class NotDeliveredError extends AppError {
  constructor(productId = null) {
    super(
      'You can only review products from delivered orders',
      400,
      'ORDER_NOT_DELIVERED',
      productId ? { productId } : {}
    );
  }
}

/**
 * Unauthorized Review Access - 403
 * Thrown when user tries to access/modify review they don't own
 */
class UnauthorizedReviewAccessError extends AppError {
  constructor(reviewId = null) {
    super(
      'You are not authorized to access this review',
      403,
      'UNAUTHORIZED_REVIEW_ACCESS',
      reviewId ? { reviewId } : {}
    );
  }
}

/**
 * Review Edit Limit Exceeded - 400
 * Thrown when user tries to edit review more than 3 times
 */
class ReviewEditLimitExceededError extends AppError {
  constructor(reviewId = null) {
    super(
      'Maximum edit limit (3) reached for this review',
      400,
      'REVIEW_EDIT_LIMIT_EXCEEDED',
      reviewId ? { reviewId, maxEdits: 3 } : { maxEdits: 3 }
    );
  }
}

/**
 * Already Voted - 409
 * Thrown when user tries to vote same way again
 */
class AlreadyVotedError extends AppError {
  constructor(reviewId = null, voteType = null) {
    super(
      'You have already voted on this review',
      409,
      'ALREADY_VOTED',
      { reviewId, voteType }
    );
  }
}

/**
 * Already Reported - 409
 * Thrown when user tries to report same review again
 */
class AlreadyReportedError extends AppError {
  constructor(reviewId = null) {
    super(
      'You have already reported this review',
      409,
      'ALREADY_REPORTED',
      reviewId ? { reviewId } : {}
    );
  }
}

module.exports = {
  AppError,
  OrderNotFoundError,
  ProductNotFoundError,
  InsufficientWalletBalanceError,
  PaymentAlreadyProcessedError,
  InvalidPaymentMethodError,
  OrderAlreadyCompletedError,
  UnauthorizedOrderAccessError,
  InvalidPaymentAmountError,
  InvalidOrderStatusError,
  RazorpayVerificationError,
  ProductOutOfStockError,
  InvalidInstallmentDurationError,
  ValidationError,
  UserNotFoundError,
  TransactionFailedError,
  BulkOrderError,
  BulkOrderNotFoundError,
  AddressNotFoundError,
  BankAccountNotFoundError,
  KYCNotVerifiedError,
  KYCDocumentNotFoundError,
  DuplicateBankAccountError,
  // Review System Errors
  ReviewNotFoundError,
  DuplicateReviewError,
  NotDeliveredError,
  UnauthorizedReviewAccessError,
  ReviewEditLimitExceededError,
  AlreadyVotedError,
  AlreadyReportedError
};