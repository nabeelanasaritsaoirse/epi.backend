const Banner = require('../models/Banner');
const { deleteImageFromS3 } = require('../services/awsUploadService');

/**
 * Create a new banner with image upload
 */
exports.createBanner = async (req, res) => {
  try {
    const { title, description, altText, linkUrl, targetBlank, displayOrder, platform, startDate, endDate } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Banner title is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required'
      });
    }

    // Get image data from multer middleware
    const { s3Url, s3Key, width, height } = req.file;

    // Create banner document
    const banner = new Banner({
      title,
      description: description || '',
      imageUrl: s3Url,
      imageKey: s3Key,
      altText: altText || title,
      imageWidth: width,
      imageHeight: height,
      imageSize: req.file.size,
      linkUrl: linkUrl || null,
      targetBlank: targetBlank === 'true' || targetBlank === true,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      platform: platform || 'both',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: userId
    });

    await banner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating banner',
      error: error.message
    });
  }
};

/**
 * Get all active banners (for frontend)
 */
exports.getActiveBanners = async (req, res) => {
  try {
    const { platform = 'web', page = 1, limit = 10 } = req.query;

    const query = {
      isActive: true,
      isDeleted: false
    };

    // Filter by platform
    if (platform && platform !== 'all') {
      query.platform = { $in: [platform, 'both'] };
    }

    // Check if banner is currently within date range (if dates are set)
    const now = new Date();
    query.$or = [
      {
        startDate: { $exists: false },
        endDate: { $exists: false }
      },
      {
        startDate: { $lte: now },
        endDate: { $gte: now }
      },
      {
        startDate: { $lte: now },
        endDate: { $exists: false }
      },
      {
        startDate: { $exists: false },
        endDate: { $gte: now }
      }
    ];

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const banners = await Banner.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v');

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      data: banners,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching active banners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    });
  }
};

/**
 * Get all banners (admin view)
 */
exports.getAllBanners = async (req, res) => {
  try {
    const { isActive, platform, search, page = 1, limit = 20, sortBy = 'displayOrder', sortOrder = 'asc' } = req.query;

    const query = { isDeleted: false };

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (platform && platform !== 'all') {
      query.platform = platform;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const banners = await Banner.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .select('-__v');

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      data: banners,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    });
  }
};

/**
 * Get single banner by ID
 */
exports.getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!banner || banner.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error('Error fetching banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banner',
      error: error.message
    });
  }
};

/**
 * Update banner (without image replacement)
 */
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, altText, linkUrl, targetBlank, displayOrder, platform, startDate, endDate, isActive } = req.body;
    const userId = req.user._id;

    const banner = await Banner.findById(id);

    if (!banner || banner.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Update fields
    if (title) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (altText) banner.altText = altText;
    if (linkUrl !== undefined) banner.linkUrl = linkUrl;
    if (targetBlank !== undefined) banner.targetBlank = targetBlank === 'true' || targetBlank === true;
    if (displayOrder !== undefined) banner.displayOrder = parseInt(displayOrder);
    if (platform) banner.platform = platform;
    if (startDate !== undefined) banner.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) banner.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;

    banner.updatedBy = userId;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating banner',
      error: error.message
    });
  }
};

/**
 * Replace banner image
 */
exports.replaceBannerImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'New image is required'
      });
    }

    const banner = await Banner.findById(id);

    if (!banner || banner.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete old image from S3
    try {
      await deleteImageFromS3(banner.imageUrl);
    } catch (error) {
      console.error('Error deleting old image:', error);
      // Continue anyway - main image is replaced
    }

    // Update with new image
    const { s3Url, s3Key, width, height } = req.file;

    banner.imageUrl = s3Url;
    banner.imageKey = s3Key;
    banner.imageWidth = width;
    banner.imageHeight = height;
    banner.imageSize = req.file.size;
    banner.updatedBy = userId;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner image replaced successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error replacing banner image:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing banner image',
      error: error.message
    });
  }
};

/**
 * Toggle banner status (active/inactive)
 */
exports.toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const banner = await Banner.findById(id);

    if (!banner || banner.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    banner.isActive = !banner.isActive;
    banner.updatedBy = userId;

    await banner.save();

    res.json({
      success: true,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });
  } catch (error) {
    console.error('Error toggling banner status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling banner status',
      error: error.message
    });
  }
};

/**
 * Soft delete banner (mark as deleted)
 */
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const banner = await Banner.findById(id);

    if (!banner || banner.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    banner.isDeleted = true;
    banner.deletedAt = new Date();
    banner.deletedBy = userId;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner soft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting banner',
      error: error.message
    });
  }
};

/**
 * Permanently delete banner (from database and S3)
 */
exports.permanentlyDeleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete image from S3
    try {
      await deleteImageFromS3(banner.imageUrl);
    } catch (error) {
      console.error('Error deleting image from S3:', error);
      // Continue with database deletion
    }

    // Delete from database
    await Banner.findByIdAndRemove(id);

    res.json({
      success: true,
      message: 'Banner permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error permanently deleting banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting banner',
      error: error.message
    });
  }
};

/**
 * Restore soft-deleted banner
 */
exports.restoreBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const banner = await Banner.findById(id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    if (!banner.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Banner is not deleted'
      });
    }

    banner.isDeleted = false;
    banner.deletedAt = null;
    banner.deletedBy = null;
    banner.updatedBy = userId;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner restored successfully',
      data: banner
    });
  } catch (error) {
    console.error('Error restoring banner:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring banner',
      error: error.message
    });
  }
};

/**
 * Reorder banners
 */
exports.reorderBanners = async (req, res) => {
  try {
    const { bannerOrders } = req.body; // [{id, displayOrder}, ...]
    const userId = req.user._id;

    if (!Array.isArray(bannerOrders) || bannerOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Banner orders array is required'
      });
    }

    const updatePromises = bannerOrders.map(item =>
      Banner.findByIdAndUpdate(
        item.id,
        {
          displayOrder: item.displayOrder,
          updatedBy: userId,
          updatedAt: new Date()
        },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Banners reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering banners:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering banners',
      error: error.message
    });
  }
};

/**
 * Track banner click
 */
exports.trackBannerClick = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findByIdAndUpdate(
      id,
      { $inc: { clickCount: 1 } },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.json({
      success: true,
      message: 'Click tracked',
      data: { clickCount: banner.clickCount }
    });
  } catch (error) {
    console.error('Error tracking banner click:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking banner click',
      error: error.message
    });
  }
};

/**
 * Get banner statistics
 */
exports.getBannerStats = async (req, res) => {
  try {
    const stats = {
      total: await Banner.countDocuments({ isDeleted: false }),
      active: await Banner.countDocuments({ isActive: true, isDeleted: false }),
      inactive: await Banner.countDocuments({ isActive: false, isDeleted: false }),
      deleted: await Banner.countDocuments({ isDeleted: true })
    };

    // Get clicks and impressions
    const clickData = await Banner.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalClicks: { $sum: '$clickCount' }, totalImpressions: { $sum: '$impressions' } } }
    ]);

    stats.totalClicks = clickData[0]?.totalClicks || 0;
    stats.totalImpressions = clickData[0]?.totalImpressions || 0;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching banner stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banner stats',
      error: error.message
    });
  }
};
