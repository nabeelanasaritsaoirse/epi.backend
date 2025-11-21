/**
 * Message Sanitizer Middleware
 * Sanitizes message text to prevent XSS attacks
 */

const { sanitizeMessageText } = require('../utils/chatHelpers');

/**
 * Sanitize message text in request body
 * Applies to all endpoints that accept text input
 */
function sanitizeMessage(req, res, next) {
  try {
    // Sanitize text field if present
    if (req.body.text) {
      req.body.text = sanitizeMessageText(req.body.text);
    }

    // Sanitize description field if present (for reports)
    if (req.body.description) {
      req.body.description = sanitizeMessageText(req.body.description);
    }

    // Sanitize reason field if present
    if (req.body.reason) {
      req.body.reason = sanitizeMessageText(req.body.reason);
    }

    // Sanitize admin notes if present
    if (req.body.adminNotes) {
      req.body.adminNotes = sanitizeMessageText(req.body.adminNotes);
    }

    // Sanitize group name if present
    if (req.body.groupName) {
      req.body.groupName = sanitizeMessageText(req.body.groupName);
    }

    next();
  } catch (error) {
    console.error('Error in sanitizeMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error sanitizing message content',
      error: error.message
    });
  }
}

/**
 * Validate message length
 * Ensures messages don't exceed maximum length
 */
function validateMessageLength(req, res, next) {
  try {
    const { text, messageType } = req.body;

    // Check text length for TEXT messages
    if (messageType === 'TEXT' && text) {
      if (text.length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Message text cannot exceed 5000 characters'
        });
      }

      if (text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message text cannot be empty'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error in validateMessageLength:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating message length',
      error: error.message
    });
  }
}

/**
 * Remove potentially dangerous content
 * Additional layer of security for message content
 */
function removeDangerousContent(req, res, next) {
  try {
    if (req.body.text) {
      // Remove common XSS patterns
      let text = req.body.text;

      // Remove script tags and their content
      text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove event handlers
      text = text.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

      // Remove javascript: protocol
      text = text.replace(/javascript:/gi, '');

      // Remove data: protocol (can be used for XSS)
      text = text.replace(/data:text\/html/gi, '');

      req.body.text = text;
    }

    next();
  } catch (error) {
    console.error('Error in removeDangerousContent:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing dangerous content',
      error: error.message
    });
  }
}

module.exports = {
  sanitizeMessage,
  validateMessageLength,
  removeDangerousContent
};
