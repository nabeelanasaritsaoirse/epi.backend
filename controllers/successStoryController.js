const SuccessStory = require('../models/SuccessStory');
const { deleteImageFromS3 } = require('../services/awsUploadService');

/**
 * Create a new success story with image upload
 */ 
exports.createSuccessStory = async (req, res) => {
  try {
    const { title, description, altText, displayOrder, platform } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Story title is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Story image is required'
      });
    }

    // Get image data from multer middleware
    const { s3Url, s3Key, width, height } = req.file;

    // Create success story document
    const successStory = new SuccessStory({
      title,
      description: description || '',
      imageUrl: s3Url,
      imageKey: s3Key,
      altText: altText || title,
      imageWidth: width,
      imageHeight: height,
      imageSize: req.file.size,
      displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      platform: platform || 'both',
      createdBy: userId
    });

    await successStory.save();

    res.status(201).json({
      success: true,
      message: 'Success story created successfully',
      data: successStory
    });
  } catch (error) {
    console.error('Error creating success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating success story',
      error: error.message
    });
  }
};

/**
 * Get all active success stories (for frontend)
 */
exports.getActiveSuccessStories = async (req, res) => {
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

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const stories = await SuccessStory.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('_id title description imageUrl altText imageWidth imageHeight displayOrder platform views -__v');

    const total = await SuccessStory.countDocuments(query);

    res.json({
      success: true,
      data: stories,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching active success stories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching success stories',
      error: error.message
    });
  }
};

/**
 * Get all success stories (admin view)
 */
exports.getAllSuccessStories = async (req, res) => {
  try {
    const {
      isActive,
      platform,
      search,
      page = 1,
      limit = 20,
      sortBy = 'displayOrder',
      sortOrder = 'asc'
    } = req.query;

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

    const stories = await SuccessStory.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .select('-__v');

    const total = await SuccessStory.countDocuments(query);

    res.json({
      success: true,
      data: stories,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching success stories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching success stories',
      error: error.message
    });
  }
};

/**
 * Get single success story by ID
 */
exports.getSuccessStoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const story = await SuccessStory.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    // Increment views
    story.views = (story.views || 0) + 1;
    await story.save();

    res.json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('Error fetching success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching success story',
      error: error.message
    });
  }
};

/**
 * Update success story (without image replacement)
 */
exports.updateSuccessStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, altText, displayOrder, platform, isActive } = req.body;
    const userId = req.user._id;

    const story = await SuccessStory.findById(id);

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    // Update fields
    if (title) story.title = title;
    if (description !== undefined) story.description = description;
    if (altText) story.altText = altText;
    if (displayOrder !== undefined) story.displayOrder = parseInt(displayOrder);
    if (platform) story.platform = platform;
    if (isActive !== undefined) story.isActive = isActive === 'true' || isActive === true;

    story.updatedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: 'Success story updated successfully',
      data: story
    });
  } catch (error) {
    console.error('Error updating success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating success story',
      error: error.message
    });
  }
};

/**
 * Replace success story image
 */
exports.replaceSuccessStoryImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'New image is required'
      });
    }

    const story = await SuccessStory.findById(id);

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    // Delete old image from S3
    try {
      await deleteImageFromS3(story.imageUrl);
    } catch (error) {
      console.error('Error deleting old image:', error);
      // Continue anyway
    }

    // Update with new image
    const { s3Url, s3Key, width, height } = req.file;

    story.imageUrl = s3Url;
    story.imageKey = s3Key;
    story.imageWidth = width;
    story.imageHeight = height;
    story.imageSize = req.file.size;
    story.updatedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: 'Success story image replaced successfully',
      data: story
    });
  } catch (error) {
    console.error('Error replacing success story image:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing success story image',
      error: error.message
    });
  }
};

/**
 * Toggle success story status
 */
exports.toggleSuccessStoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const story = await SuccessStory.findById(id);

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    story.isActive = !story.isActive;
    story.updatedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: `Success story ${story.isActive ? 'activated' : 'deactivated'} successfully`,
      data: story
    });
  } catch (error) {
    console.error('Error toggling success story status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling success story status',
      error: error.message
    });
  }
};

/**
 * Soft delete success story
 */
exports.deleteSuccessStory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const story = await SuccessStory.findById(id);

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    story.isDeleted = true;
    story.deletedAt = new Date();
    story.deletedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: 'Success story soft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting success story',
      error: error.message
    });
  }
};

/**
 * Permanently delete success story
 */
exports.permanentlyDeleteSuccessStory = async (req, res) => {
  try {
    const { id } = req.params;

    const story = await SuccessStory.findById(id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    // Delete image from S3
    try {
      await deleteImageFromS3(story.imageUrl);
    } catch (error) {
      console.error('Error deleting image from S3:', error);
      // Continue with database deletion
    }

    // Delete from database
    await SuccessStory.findByIdAndRemove(id);

    res.json({
      success: true,
      message: 'Success story permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error permanently deleting success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting success story',
      error: error.message
    });
  }
};

/**
 * Restore soft-deleted success story
 */
exports.restoreSuccessStory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const story = await SuccessStory.findById(id);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    if (!story.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Success story is not deleted'
      });
    }

    story.isDeleted = false;
    story.deletedAt = null;
    story.deletedBy = null;
    story.updatedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: 'Success story restored successfully',
      data: story
    });
  } catch (error) {
    console.error('Error restoring success story:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring success story',
      error: error.message
    });
  }
};

/**
 * Reorder success stories
 */
exports.reorderSuccessStories = async (req, res) => {
  try {
    const { storyOrders } = req.body; // [{id, displayOrder}, ...]
    const userId = req.user._id;

    if (!Array.isArray(storyOrders) || storyOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Story orders array is required'
      });
    }

    const updatePromises = storyOrders.map(item =>
      SuccessStory.findByIdAndUpdate(
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
      message: 'Success stories reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering success stories:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering success stories',
      error: error.message
    });
  }
};

/**
 * Get success story statistics
 */
exports.getSuccessStoryStats = async (req, res) => {
  try {
    const stats = {
      total: await SuccessStory.countDocuments({ isDeleted: false }),
      active: await SuccessStory.countDocuments({ isActive: true, isDeleted: false }),
      inactive: await SuccessStory.countDocuments({ isActive: false, isDeleted: false }),
      deleted: await SuccessStory.countDocuments({ isDeleted: true })
    };

    // Get view metrics
    const viewData = await SuccessStory.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' }
        }
      }
    ]);

    stats.totalViews = viewData[0]?.totalViews || 0;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching success story stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching success story stats',
      error: error.message
    });
  }
};

/**
 * Replace success story image
 */
exports.replaceSuccessStoryImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'New image is required'
      });
    }

    const story = await SuccessStory.findById(id);

    if (!story || story.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Success story not found'
      });
    }

    // Delete old image from S3
    try {
      await deleteImageFromS3(story.imageUrl);
    } catch (error) {
      console.error('Error deleting old image:', error);
      // Continue anyway - main image is replaced
    }

    // Update with new image
    const { s3Url, s3Key, width, height } = req.file;

    story.imageUrl = s3Url;
    story.imageKey = s3Key;
    story.imageWidth = width;
    story.imageHeight = height;
    story.imageSize = req.file.size;
    story.updatedBy = userId;

    await story.save();

    res.json({
      success: true,
      message: 'Success story image replaced successfully',
      data: story
    });
  } catch (error) {
    console.error('Error replacing success story image:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing success story image',
      error: error.message
    });
  }
};
