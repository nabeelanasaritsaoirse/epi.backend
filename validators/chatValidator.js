/**
 * Chat Validation Middleware
 * Validates incoming requests for chat endpoints using express-validator
 */

const { body, query, param, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validate send message request
 */
const validateSendMessage = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .matches(/^CONV-\d{8}-\d{4}$/)
    .withMessage('Invalid conversation ID format'),

  body('messageType')
    .notEmpty()
    .withMessage('Message type is required')
    .isIn(['TEXT', 'PRODUCT_SHARE', 'ORDER_SHARE'])
    .withMessage('Invalid message type'),

  body('text')
    .optional()
    .isString()
    .withMessage('Text must be a string')
    .isLength({ max: 5000 })
    .withMessage('Text cannot exceed 5000 characters'),

  body('productId')
    .if(body('messageType').equals('PRODUCT_SHARE'))
    .notEmpty()
    .withMessage('Product ID is required for product sharing')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('orderId')
    .if(body('messageType').equals('ORDER_SHARE'))
    .notEmpty()
    .withMessage('Order ID is required for order sharing')
    .isMongoId()
    .withMessage('Invalid order ID'),

  body('replyToMessageId')
    .optional()
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid reply message ID format'),

  // Custom validation: TEXT messages must have text
  body('text')
    .if(body('messageType').equals('TEXT'))
    .notEmpty()
    .withMessage('Text is required for text messages'),

  handleValidationErrors
];

/**
 * Validate edit message request
 */
const validateEditMessage = [
  param('messageId')
    .notEmpty()
    .withMessage('Message ID is required')
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid message ID format'),

  body('text')
    .notEmpty()
    .withMessage('Text is required')
    .isString()
    .withMessage('Text must be a string')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Text must be between 1 and 5000 characters'),

  handleValidationErrors
];

/**
 * Validate delete message request
 */
const validateDeleteMessage = [
  param('messageId')
    .notEmpty()
    .withMessage('Message ID is required')
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid message ID format'),

  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters'),

  handleValidationErrors
];

/**
 * Validate mark as read request
 */
const validateMarkAsRead = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .matches(/^CONV-\d{8}-\d{4}$/)
    .withMessage('Invalid conversation ID format'),

  body('messageIds')
    .optional()
    .isArray()
    .withMessage('Message IDs must be an array'),

  body('messageIds.*')
    .optional()
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid message ID format in array'),

  handleValidationErrors
];

/**
 * Validate create individual conversation request
 */
const validateCreateIndividualConversation = [
  body('withUserId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),

  handleValidationErrors
];

/**
 * Validate create group broadcast request
 */
const validateCreateGroupBroadcast = [
  body('groupName')
    .optional()
    .isString()
    .withMessage('Group name must be a string')
    .isLength({ max: 100 })
    .withMessage('Group name cannot exceed 100 characters'),

  body('memberIds')
    .notEmpty()
    .withMessage('Member IDs are required')
    .isArray({ min: 1, max: 50 })
    .withMessage('Member IDs must be an array with 1-50 members'),

  body('memberIds.*')
    .isMongoId()
    .withMessage('Invalid member ID format in array'),

  handleValidationErrors
];

/**
 * Validate report message request
 */
const validateReportMessage = [
  param('messageId')
    .notEmpty()
    .withMessage('Message ID is required')
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid message ID format'),

  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['SPAM', 'ABUSE', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER'])
    .withMessage('Invalid report reason'),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .withMessage('Description must be a string')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),

  handleValidationErrors
];

/**
 * Validate get conversations request
 */
const validateGetConversations = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('type')
    .optional()
    .isIn(['INDIVIDUAL', 'GROUP_BROADCAST'])
    .withMessage('Invalid conversation type'),

  handleValidationErrors
];

/**
 * Validate get messages request
 */
const validateGetMessages = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .matches(/^CONV-\d{8}-\d{4}$/)
    .withMessage('Invalid conversation ID format'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('beforeMessageId')
    .optional()
    .matches(/^MSG-\d{8}-\d{4}$/)
    .withMessage('Invalid message ID format'),

  handleValidationErrors
];

/**
 * Validate poll request
 */
const validatePoll = [
  query('lastPollTime')
    .notEmpty()
    .withMessage('Last poll time is required')
    .isISO8601()
    .withMessage('Invalid date format for last poll time'),

  query('conversationId')
    .optional()
    .matches(/^CONV-\d{8}-\d{4}$/)
    .withMessage('Invalid conversation ID format'),

  handleValidationErrors
];

/**
 * Validate search messages request
 */
const validateSearchMessages = [
  query('query')
    .notEmpty()
    .withMessage('Search query is required')
    .isString()
    .withMessage('Query must be a string')
    .isLength({ min: 2, max: 100 })
    .withMessage('Query must be between 2 and 100 characters'),

  query('conversationId')
    .optional()
    .matches(/^CONV-\d{8}-\d{4}$/)
    .withMessage('Invalid conversation ID format'),

  query('messageType')
    .optional()
    .isIn(['TEXT', 'PRODUCT_SHARE', 'ORDER_SHARE'])
    .withMessage('Invalid message type'),

  handleValidationErrors
];

/**
 * Validate admin take action on report request
 */
const validateAdminTakeAction = [
  param('reportId')
    .notEmpty()
    .withMessage('Report ID is required')
    .matches(/^REP-\d{8}-\d{4}$/)
    .withMessage('Invalid report ID format'),

  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['MESSAGE_DELETED', 'USER_WARNED', 'USER_BLOCKED', 'NO_ACTION'])
    .withMessage('Invalid action'),

  body('adminNotes')
    .notEmpty()
    .withMessage('Admin notes are required')
    .isString()
    .withMessage('Admin notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Admin notes cannot exceed 1000 characters'),

  body('deleteMessage')
    .optional()
    .isBoolean()
    .withMessage('Delete message must be a boolean'),

  handleValidationErrors
];

/**
 * Validate admin broadcast request
 */
const validateAdminBroadcast = [
  body('messageType')
    .notEmpty()
    .withMessage('Message type is required')
    .isIn(['TEXT', 'PRODUCT_SHARE'])
    .withMessage('Invalid message type for broadcast'),

  body('text')
    .notEmpty()
    .withMessage('Text is required')
    .isString()
    .withMessage('Text must be a string')
    .isLength({ max: 5000 })
    .withMessage('Text cannot exceed 5000 characters'),

  body('productId')
    .if(body('messageType').equals('PRODUCT_SHARE'))
    .notEmpty()
    .withMessage('Product ID is required for product sharing')
    .isMongoId()
    .withMessage('Invalid product ID'),

  body('targetUsers')
    .notEmpty()
    .withMessage('Target users is required')
    .isIn(['ALL', 'ACTIVE_ORDERS', 'SPECIFIC'])
    .withMessage('Invalid target users option'),

  body('specificUserIds')
    .if(body('targetUsers').equals('SPECIFIC'))
    .notEmpty()
    .withMessage('Specific user IDs are required')
    .isArray({ min: 1 })
    .withMessage('Specific user IDs must be an array with at least 1 user'),

  body('specificUserIds.*')
    .if(body('targetUsers').equals('SPECIFIC'))
    .isMongoId()
    .withMessage('Invalid user ID format in specific users array'),

  handleValidationErrors
];

/**
 * Validate get my referrals request
 */
const validateGetMyReferrals = [
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .isLength({ max: 100 })
    .withMessage('Search cannot exceed 100 characters'),

  handleValidationErrors
];

module.exports = {
  validateSendMessage,
  validateEditMessage,
  validateDeleteMessage,
  validateMarkAsRead,
  validateCreateIndividualConversation,
  validateCreateGroupBroadcast,
  validateReportMessage,
  validateGetConversations,
  validateGetMessages,
  validatePoll,
  validateSearchMessages,
  validateAdminTakeAction,
  validateAdminBroadcast,
  validateGetMyReferrals
};
