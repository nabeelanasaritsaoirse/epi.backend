const Notification = require('../models/Notification');

/**
 * Create a new notification (without auth)
 * Only title and message are required
 */
exports.createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'both',
      priority = 'medium',
      link,
      metadata
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    if (!['inapp', 'system', 'both'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid notification type' });
    }

    const notification = new Notification({
      title,
      message,
      type,
      priority,
      link: link || null,
      metadata: metadata || {},
      createdBy: req.user?._id || null
    });

    await notification.save();

    res.status(201).json({ success: true, message: 'Notification created successfully', data: notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: 'Error creating notification', error: error.message });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isActive, search } = req.query;
    const skip = (page - 1) * limit;
    const query = { isDeleted: false };

    if (type && ['inapp', 'system', 'both'].includes(type)) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [{ title: { $regex: search, $options: 'i' } }, { message: { $regex: search, $options: 'i' } }];

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

exports.getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id).populate('createdBy', 'name email');

    if (!notification || notification.isDeleted) return res.status(404).json({ success: false, message: 'Notification not found' });

    res.status(200).json({ success: true, message: 'Notification retrieved successfully', data: notification });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ success: false, message: 'Error fetching notification', error: error.message });
  }
};

exports.getNotificationsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!['inapp', 'system', 'both'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid notification type' });
    }

    const query = { isDeleted: false, isActive: true, $or: [{ type }, { type: 'both' }] };
    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: `${type} notifications retrieved successfully`,
      data: notifications,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching notifications by type:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

exports.getInAppNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const query = { isDeleted: false, isActive: true, $or: [{ type: 'inapp' }, { type: 'both' }] };

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({ success: true, message: 'In-app notifications retrieved successfully', data: notifications, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching in-app notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

exports.getSystemNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const query = { isDeleted: false, isActive: true, $or: [{ type: 'system' }, { type: 'both' }] };

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({ success: true, message: 'System notifications retrieved successfully', data: notifications, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Error fetching system notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, priority, link, isActive, metadata } = req.body;

    const notification = await Notification.findById(id);
    if (!notification || notification.isDeleted) return res.status(404).json({ success: false, message: 'Notification not found' });

    if (title) notification.title = title;
    if (message) notification.message = message;
    if (type && ['inapp', 'system', 'both'].includes(type)) notification.type = type;
    if (priority) notification.priority = priority;
    if (link !== undefined) notification.link = link;
    if (isActive !== undefined) notification.isActive = isActive;
    if (metadata) notification.metadata = metadata;

    await notification.save();
    res.status(200).json({ success: true, message: 'Notification updated successfully', data: notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ success: false, message: 'Error updating notification', error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id?.toString() || req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const notification = await Notification.findById(id);
    if (!notification || notification.isDeleted) return res.status(404).json({ success: false, message: 'Notification not found' });

    const alreadyRead = notification.readBy.some(r => r.userId === userId);
    if (!alreadyRead) {
      notification.readBy.push({ userId: userId.toString(), readAt: new Date() });
      await notification.save();
    }

    res.status(200).json({ success: true, message: 'Notification marked as read', data: notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Error marking notification as read', error: error.message });
  }
};

exports.toggleNotificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification || notification.isDeleted) return res.status(404).json({ success: false, message: 'Notification not found' });

    notification.isActive = !notification.isActive;
    await notification.save();

    res.status(200).json({ success: true, message: `Notification ${notification.isActive ? 'activated' : 'deactivated'}`, data: notification });
  } catch (error) {
    console.error('Error toggling notification status:', error);
    res.status(500).json({ success: false, message: 'Error toggling notification status', error: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification || notification.isDeleted) return res.status(404).json({ success: false, message: 'Notification not found' });

    notification.isDeleted = true;
    await notification.save();

    res.status(200).json({ success: true, message: 'Notification deleted successfully', data: notification });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Error deleting notification', error: error.message });
  }
};

exports.permanentlyDeleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    // If you use S3 utils, ensure initS3Utils and deleteImageFromS3 are available
    if (notification.imageUrl) {
      try {
        // initS3Utils();
        // await deleteImageFromS3(notification.imageUrl);
      } catch (deleteError) {
        console.error('Error deleting image:', deleteError);
      }
    }

    await Notification.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Notification permanently deleted', data: {} });
  } catch (error) {
    console.error('Error permanently deleting notification:', error);
    res.status(500).json({ success: false, message: 'Error permanently deleting notification', error: error.message });
  }
};

exports.restoreNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    notification.isDeleted = false;
    await notification.save();
    res.status(200).json({ success: true, message: 'Notification restored successfully', data: notification });
  } catch (error) {
    console.error('Error restoring notification:', error);
    res.status(500).json({ success: false, message: 'Error restoring notification', error: error.message });
  }
};

exports.getNotificationStats = async (req, res) => {
  try {
    const stats = {
      total: await Notification.countDocuments({ isDeleted: false }),
      active: await Notification.countDocuments({ isActive: true, isDeleted: false }),
      inapp: await Notification.countDocuments({ isDeleted: false, $or: [{ type: 'inapp' }, { type: 'both' }] }),
      system: await Notification.countDocuments({ isDeleted: false, $or: [{ type: 'system' }, { type: 'both' }] }),
      byPriority: {
        low: await Notification.countDocuments({ priority: 'low', isDeleted: false }),
        medium: await Notification.countDocuments({ priority: 'medium', isDeleted: false }),
        high: await Notification.countDocuments({ priority: 'high', isDeleted: false }),
        urgent: await Notification.countDocuments({ priority: 'urgent', isDeleted: false })
      }
    };

    res.status(200).json({ success: true, message: 'Notification statistics retrieved', data: stats });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
};
