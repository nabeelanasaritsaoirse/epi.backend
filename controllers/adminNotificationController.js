/**
 * Admin Notification Controller
 * Handles admin notification management endpoints
 */

const { validationResult } = require('express-validator');
const multer = require('multer');
const Notification = require('../models/Notification');
const NotificationComment = require('../models/NotificationComment');
const notificationService = require('../services/notificationSystemService');
const { uploadSingleFileToS3, deleteImageFromS3 } = require('../services/awsUploadService');
const { validateNotificationImage, calculateEngagementRate } = require('../utils/notificationHelpers');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
}).single('image');

/**
 * @route   POST /api/admin/notifications/create
 * @desc    Create new notification (draft mode)
 * @access  Admin
 */
async function createNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const adminId = req.user._id;
    const postData = req.body;

    const notification = await notificationService.createAdminPost(adminId, postData);

    res.status(201).json({
      success: true,
      message: 'Notification created as draft',
      data: {
        notificationId: notification.notificationId,
        _id: notification._id,
        status: notification.status,
        nextStep: 'Upload image (if needed) then publish or schedule'
      }
    });

  } catch (error) {
    console.error('Error in createNotification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create notification',
      error: error.message
    });
  }
}

/**
 * @route   PUT /api/admin/notifications/:id/upload-image
 * @desc    Upload image for notification
 * @access  Admin
 */
async function uploadImage(req, res) {
  upload(req, res, async function(err) {
    try {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else if (err) {
        return res.status(500).json({
          success: false,
          message: 'File upload error',
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided'
        });
      }

      // Validate image
      const validation = validateNotificationImage(req.file);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      const { id } = req.params;

      // Find notification
      const notification = await Notification.findById(id);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Check ownership
      if (notification.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to edit this notification'
        });
      }

      // Delete old image if exists
      if (notification.imageUrl) {
        try {
          await deleteImageFromS3(notification.imageUrl);
        } catch (deleteErr) {
          console.error('Error deleting old image:', deleteErr);
        }
      }

      // Upload to S3
      const uploadResult = await uploadSingleFileToS3(
        req.file,
        'notifications/',
        1920 // resize width
      );

      // Update notification
      notification.imageUrl = uploadResult.url;
      await notification.save();

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          imageUrl: uploadResult.url
        }
      });

    } catch (error) {
      console.error('Error in uploadImage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload image',
        error: error.message
      });
    }
  });
}

/**
 * @route   POST /api/admin/notifications/:id/publish
 * @desc    Publish notification immediately
 * @access  Admin
 */
async function publishNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const result = await notificationService.publishAdminPost(id);

    res.status(200).json({
      success: true,
      message: 'Notification published successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in publishNotification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish notification',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/admin/notifications/:id/schedule
 * @desc    Schedule notification for future publishing
 * @access  Admin
 */
async function scheduleNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { scheduledAt } = req.body;

    const notification = await notificationService.scheduleAdminPost(id, scheduledAt);

    // Calculate time until publish
    const now = new Date();
    const scheduleDate = new Date(scheduledAt);
    const diffMs = scheduleDate - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeUntilPublish = '';
    if (diffDays > 0) timeUntilPublish += `${diffDays} days `;
    if (diffHours > 0) timeUntilPublish += `${diffHours} hours `;
    timeUntilPublish += `${diffMinutes} minutes`;

    res.status(200).json({
      success: true,
      message: 'Notification scheduled successfully',
      data: {
        notificationId: notification.notificationId,
        status: notification.status,
        scheduledAt: notification.scheduledAt,
        willPublishIn: timeUntilPublish.trim()
      }
    });

  } catch (error) {
    console.error('Error in scheduleNotification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to schedule notification',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/admin/notifications/:id
 * @desc    Update notification
 * @access  Admin
 */
async function updateNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const notification = await notificationService.updateAdminPost(id, updates);

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data: {
        notificationId: notification.notificationId,
        updatedFields: Object.keys(updates)
      }
    });

  } catch (error) {
    console.error('Error in updateNotification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notification',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/admin/notifications/:id
 * @desc    Delete notification (soft delete)
 * @access  Admin
 */
async function deleteNotification(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const adminId = req.user._id;

    await notificationService.deleteNotification(id, adminId);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteNotification:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notification',
      error: error.message
    });
  }
}

/**
 * @route   PATCH /api/admin/notifications/:id/settings
 * @desc    Toggle comments/likes settings
 * @access  Admin
 */
async function updateSettings(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { commentsEnabled, likesEnabled } = req.body;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (commentsEnabled !== undefined) {
      notification.commentsEnabled = commentsEnabled;
    }

    if (likesEnabled !== undefined) {
      notification.likesEnabled = likesEnabled;
    }

    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        commentsEnabled: notification.commentsEnabled,
        likesEnabled: notification.likesEnabled
      }
    });

  } catch (error) {
    console.error('Error in updateSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
}

/**
 * @route   DELETE /api/admin/notifications/:notificationId/comments/:commentId
 * @desc    Delete comment (admin moderation)
 * @access  Admin
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

    const adminId = req.user._id;
    const { notificationId, commentId } = req.params;
    const { reason } = req.body;

    const comment = await NotificationComment.findOne({
      _id: commentId,
      notificationId,
      isDeleted: false
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Soft delete with admin flag
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.deletedBy = adminId;
    comment.deletedByAdmin = true;
    if (reason) comment.deletionReason = reason;

    await comment.save();

    // Decrement comment count
    await Notification.findByIdAndUpdate(
      notificationId,
      { $inc: { commentCount: -1 } }
    );

    res.status(200).json({
      success: true,
      message: 'Comment deleted by admin'
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
 * @route   GET /api/admin/notifications
 * @desc    Get all notifications (admin view with filters)
 * @access  Admin
 */
async function getAllNotifications(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      type,
      search
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ];
    }

    const [notifications, total, stats] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .lean(),
      Notification.countDocuments(query),
      Notification.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Format stats
    const statusStats = {};
    stats.forEach(stat => {
      statusStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          totalPublished: statusStats.PUBLISHED || 0,
          totalDrafts: statusStats.DRAFT || 0,
          totalScheduled: statusStats.SCHEDULED || 0,
          totalDeleted: statusStats.DELETED || 0
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
}

/**
 * @route   GET /api/admin/notifications/analytics
 * @desc    Get notification analytics
 * @access  Admin
 */
async function getAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = {
      type: 'ADMIN_POST',
      status: 'PUBLISHED',
      isDeleted: false
    };

    if (Object.keys(dateFilter).length > 0) {
      query.publishedAt = dateFilter;
    }

    const [
      notifications,
      totalStats,
      postsByType
    ] = await Promise.all([
      Notification.find(query)
        .sort({ likeCount: -1, commentCount: -1 })
        .limit(10)
        .lean(),
      Notification.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            totalLikes: { $sum: '$likeCount' },
            totalComments: { $sum: '$commentCount' },
            totalViews: { $sum: '$viewCount' }
          }
        }
      ]),
      Notification.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$postType',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const stats = totalStats[0] || {
      totalNotifications: 0,
      totalLikes: 0,
      totalComments: 0,
      totalViews: 0
    };

    // Calculate average engagement
    const avgEngagement = stats.totalViews > 0
      ? (((stats.totalLikes + stats.totalComments) / stats.totalViews) * 100).toFixed(2)
      : 0;

    // Format posts by type
    const postTypeStats = {};
    postsByType.forEach(item => {
      postTypeStats[item._id] = item.count;
    });

    // Top performing post
    const topPost = notifications[0] || null;

    res.status(200).json({
      success: true,
      data: {
        totalNotifications: stats.totalNotifications,
        totalLikes: stats.totalLikes,
        totalComments: stats.totalComments,
        totalViews: stats.totalViews,
        averageEngagement: parseFloat(avgEngagement),
        topPerformingPost: topPost ? {
          notificationId: topPost.notificationId,
          title: topPost.title,
          likeCount: topPost.likeCount,
          commentCount: topPost.commentCount,
          viewCount: topPost.viewCount,
          engagementRate: calculateEngagementRate(topPost)
        } : null,
        postsByType: postTypeStats
      }
    });

  } catch (error) {
    console.error('Error in getAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
}

/**
 * @route   POST /api/admin/notifications/send-to-user
 * @desc    Send push notification to specific user (admin only)
 * @access  Admin
 */
async function sendToUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId, title, message, sendPush = true, sendInApp = true, data = {} } = req.body;

    console.log(`[Admin] Sending notification to user: ${userId}`);

    // Use the notification service to send notification to specific user
    const result = await notificationService.triggerNotification({
      type: 'GENERAL',
      userId: userId,
      title: title,
      body: message,
      sendPush: sendPush,
      sendInApp: sendInApp,
      data: data,
      metadata: {
        source: 'admin_send_to_user',
        sentBy: req.user._id.toString(),
        sentAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        userId: userId,
        sentPush: sendPush,
        sentInApp: sendInApp,
        pushResult: result.pushResult || null,
        inAppNotificationId: result.notificationId || null
      }
    });

  } catch (error) {
    console.error('Error in sendToUser:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
}

module.exports = {
  createNotification,
  uploadImage,
  publishNotification,
  scheduleNotification,
  updateNotification,
  deleteNotification,
  updateSettings,
  deleteComment,
  getAllNotifications,
  getAnalytics,
  sendToUser
};
