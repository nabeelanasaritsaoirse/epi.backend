/**
 * User Notification Controller
 * Handles user-facing notification endpoints
 */

const { validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const NotificationComment = require('../models/NotificationComment');
const NotificationLike = require('../models/NotificationLike');
const User = require('../models/User');
const notificationService = require('../services/notificationSystemService');
const { registerFCMToken, removeFCMToken } = require('../services/fcmService');
const {
  generateCommentId,
  sanitizeCommentText,
  formatNotificationForFeed,
  checkUserLiked
} = require('../utils/notificationHelpers');

/**
 * @route   GET /api/notifications
 * @desc    Get notification feed for user
 * @access  Private
 */
async function getNotificationFeed(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;

    const result = await notificationService.getUserNotificationFeed(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type
    });

    // Format notifications for display
    const formattedNotifications = await Promise.all(
      result.notifications.map(notif => formatNotificationForFeed(notif, userId))
    );

    res.status(200).json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('Error in getNotificationFeed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/notifications/:id
 * @desc    Get single notification with comments
 * @access  Private
 */
async function getNotificationById(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const notification = await Notification.findOne({
      _id: id,
      isDeleted: false,
      status: 'PUBLISHED'
    }).populate('createdBy', 'name profilePicture');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Get comments
    const skip = (page - 1) * limit;
    const [comments, commentsCount] = await Promise.all([
      NotificationComment.find({
        notificationId: id,
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
      NotificationComment.countDocuments({
        notificationId: id,
        isDeleted: false
      })
    ]);

    // Format comments
    const formattedComments = comments.map(comment => ({
      ...comment,
      isMyComment: comment.userId.toString() === userId.toString()
    }));

    // Format notification
    const formattedNotification = await formatNotificationForFeed(notification, userId);

    res.status(200).json({
      success: true,
      data: {
        notification: formattedNotification,
        comments: formattedComments,
        commentsCount,
        hasMoreComments: skip + comments.length < commentsCount
      }
    });

  } catch (error) {
    console.error('Error in getNotificationById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/:id/like
 * @desc    Like or unlike a notification
 * @access  Private
 */
async function likeNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { id } = req.params;

    // Check if notification exists and likes are enabled
    const notification = await Notification.findOne({
      _id: id,
      isDeleted: false,
      status: 'PUBLISHED',
      type: 'ADMIN_POST'
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (!notification.likesEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Likes are disabled for this post'
      });
    }

    // Check if already liked
    const existingLike = await NotificationLike.findOne({
      notificationId: id,
      userId
    });

    let isLiked;
    let newLikeCount;

    if (existingLike) {
      // Unlike
      await NotificationLike.deleteOne({ _id: existingLike._id });
      notification.likeCount = Math.max(0, notification.likeCount - 1);
      await notification.save();

      isLiked = false;
      newLikeCount = notification.likeCount;

    } else {
      // Like
      await NotificationLike.create({
        notificationId: id,
        userId
      });

      notification.likeCount += 1;
      await notification.save();

      isLiked = true;
      newLikeCount = notification.likeCount;
    }

    res.status(200).json({
      success: true,
      message: isLiked ? 'Post liked successfully' : 'Post unliked successfully',
      data: {
        isLiked,
        newLikeCount
      }
    });

  } catch (error) {
    console.error('Error in likeNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process like',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/:id/comments
 * @desc    Add comment to notification
 * @access  Private
 */
async function addComment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { text } = req.body;

    // Check if notification exists and comments are enabled
    const notification = await Notification.findOne({
      _id: id,
      isDeleted: false,
      status: 'PUBLISHED',
      type: 'ADMIN_POST'
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (!notification.commentsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Comments are disabled for this post'
      });
    }

    // Get user details
    const user = await User.findById(userId).select('name profilePicture');

    // Sanitize comment text
    const sanitizedText = sanitizeCommentText(text);

    if (!sanitizedText || sanitizedText.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is invalid after sanitization'
      });
    }

    // Create comment
    const commentId = generateCommentId();
    const comment = await NotificationComment.create({
      commentId,
      notificationId: id,
      userId,
      userName: user.name,
      userAvatar: user.profilePicture || '',
      text: sanitizedText
    });

    // Increment comment count
    notification.commentCount += 1;
    await notification.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: {
          _id: comment._id,
          commentId: comment.commentId,
          text: comment.text,
          userName: comment.userName,
          userAvatar: comment.userAvatar,
          createdAt: comment.createdAt,
          isMyComment: true
        },
        newCommentCount: notification.commentCount
      }
    });

  } catch (error) {
    console.error('Error in addComment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/notifications/:id/comments
 * @desc    Get comments for notification (paginated)
 * @access  Private
 */
async function getComments(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      NotificationComment.find({
        notificationId: id,
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
      NotificationComment.countDocuments({
        notificationId: id,
        isDeleted: false
      })
    ]);

    // Format comments
    const formattedComments = comments.map(comment => ({
      ...comment,
      isMyComment: comment.userId.toString() === userId.toString()
    }));

    res.status(200).json({
      success: true,
      data: {
        comments: formattedComments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          hasMore: skip + comments.length < total
        }
      }
    });

  } catch (error) {
    console.error('Error in getComments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/notifications/:notificationId/comments/:commentId
 * @desc    Delete own comment
 * @access  Private
 */
async function deleteComment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { notificationId, commentId } = req.params;

    // Find comment
    const comment = await NotificationComment.findOne({
      _id: commentId,
      notificationId,
      userId,
      isDeleted: false
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found or you do not have permission to delete it'
      });
    }

    // Soft delete
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedBy = userId;
    await comment.save();

    // Decrement comment count
    await Notification.findByIdAndUpdate(
      notificationId,
      { $inc: { commentCount: -1 } }
    );

    const notification = await Notification.findById(notificationId);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      data: {
        newCommentCount: notification.commentCount
      }
    });

  } catch (error) {
    console.error('Error in deleteComment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/:id/mark-read
 * @desc    Mark notification as read (increment view count)
 * @access  Private
 */
async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }

    // First, check if notification exists at all
    const notificationRaw = await Notification.findById(id);

    if (!notificationRaw) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        details: 'This notification does not exist in the database'
      });
    }

    // Check if notification is deleted
    if (notificationRaw.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        details: 'This notification has been deleted'
      });
    }

    // Check if notification is published
    if (notificationRaw.status !== 'PUBLISHED') {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        details: `This notification is not published yet (current status: ${notificationRaw.status})`
      });
    }

    // Increment view count
    notificationRaw.viewCount += 1;
    await notificationRaw.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        viewCount: notificationRaw.viewCount
      }
    });

  } catch (error) {
    console.error('Error in markAsRead:', error);

    // Handle CastError for invalid ObjectId format (fallback)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
async function getUnreadCount(req, res) {
  try {
    const userId = req.user._id;

    // Count all notifications published after user's last check
    // For simplicity, we'll count all notifications from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [systemNotifications, adminPosts] = await Promise.all([
      Notification.countDocuments({
        type: 'SYSTEM_NOTIFICATION',
        targetUserId: userId,
        status: 'PUBLISHED',
        isDeleted: false,
        publishedAt: { $gte: sevenDaysAgo }
      }),
      Notification.countDocuments({
        type: 'ADMIN_POST',
        status: 'PUBLISHED',
        isDeleted: false,
        publishedAt: { $gte: sevenDaysAgo }
      })
    ]);

    const unreadCount = systemNotifications + adminPosts;

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
        systemNotifications,
        adminPosts
      }
    });

  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/register-token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
async function registerToken(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { fcmToken } = req.body;

    await registerFCMToken(userId, fcmToken);

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('Error in registerToken:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register token',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/remove-token
 * @desc    Remove FCM token (on logout)
 * @access  Private
 */
async function removeToken(req, res) {
  try {
    const userId = req.user._id;

    await removeFCMToken(userId);

    res.status(200).json({
      success: true,
      message: 'FCM token removed successfully'
    });

  } catch (error) {
    console.error('Error in removeToken:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove token',
      error: error.message
    });
  }
}

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
async function updatePreferences(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const preferences = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update preferences
    Object.keys(preferences).forEach(key => {
      if (user.notificationPreferences && preferences[key] !== undefined) {
        user.notificationPreferences[key] = preferences[key];
      }
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated',
      data: {
        preferences: user.notificationPreferences
      }
    });

  } catch (error) {
    console.error('Error in updatePreferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/notifications/trigger
 * @desc    Trigger custom notification (push and/or in-app)
 * @access  Private (user can send to themselves)
 */
async function triggerCustomNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const { title, message, sendPush = false, sendInApp = true } = req.body;

    // Use the notification service to trigger notification
    const result = await notificationService.triggerNotification({
      type: 'GENERAL',
      userId: userId,
      title: title,
      body: message,
      sendPush: sendPush,
      sendInApp: sendInApp,
      metadata: {
        source: 'frontend_trigger',
        triggeredAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Notification triggered successfully',
      data: {
        sentPush: sendPush,
        sentInApp: sendInApp,
        pushResult: result.pushResult || null
      }
    });

  } catch (error) {
    console.error('Error in triggerCustomNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger notification',
      error: error.message
    });
  }
}

module.exports = {
  getNotificationFeed,
  getNotificationById,
  likeNotification,
  addComment,
  getComments,
  deleteComment,
  markAsRead,
  getUnreadCount,
  registerToken,
  removeToken,
  updatePreferences,
  triggerCustomNotification
};
