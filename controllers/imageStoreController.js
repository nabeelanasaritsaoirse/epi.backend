const ImageStore = require('../models/ImageStore');
const { deleteImageFromS3 } = require('../services/awsUploadService');

exports.createImage = async (req, res) => {
  try {
    const {
      title,
      type,
      platform,
      orderBy,
      isActive,
      altText,
      description,
      linkUrl,
      metadata
    } = req.body;

    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    if (!title || !type || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Title, type, and platform are required'
      });
    }

    const validTypes = ImageStore.getImageTypes();
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid image type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const validPlatforms = ImageStore.getPlatforms();
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
      });
    }

    const imageUrl = req.file.s3Url;
    const imagePath = req.file.s3Key;

    const imageStore = new ImageStore({
      imagePath,
      imageUrl,
      title,
      type,
      platform,
      orderBy: orderBy || 0,
      isActive: isActive !== undefined ? isActive : true,
      width: req.file.width,
      height: req.file.height,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      altText,
      description,
      linkUrl,
      metadata: metadata ? JSON.parse(metadata) : {},
      createdBy: userId
    });

    await imageStore.save();

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: imageStore
    });
  } catch (error) {
    console.error('Error creating image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllImagesAdmin = async (req, res) => {
  try {
    const {
      type,
      platform,
      isActive,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { isDeleted: false };

    if (type) {
      filter.type = type;
    }

    if (platform) {
      if (platform === 'web') {
        filter.$or = [{ platform: 'web' }, { platform: 'both' }];
      } else if (platform === 'app') {
        filter.$or = [{ platform: 'app' }, { platform: 'both' }];
      } else if (platform === 'both') {
        filter.platform = 'both';
      }
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { altText: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await ImageStore.countDocuments(filter);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const images = await ImageStore.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        images,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNextPage: skip + images.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllActiveImagesAdmin = async (req, res) => {
  try {
    const {
      type,
      platform,
      search,
      page = 1,
      limit = 20,
      sortBy = 'orderBy',
      sortOrder = 'asc'
    } = req.query;

    const filter = { 
      isDeleted: false,
      isActive: true
    };

    if (type) {
      filter.type = type;
    }

    if (platform) {
      if (platform === 'web') {
        filter.$or = [{ platform: 'web' }, { platform: 'both' }];
      } else if (platform === 'app') {
        filter.$or = [{ platform: 'app' }, { platform: 'both' }];
      } else if (platform === 'both') {
        filter.platform = 'both';
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { altText: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await ImageStore.countDocuments(filter);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const images = await ImageStore.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        images,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNextPage: skip + images.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching active images:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageStore.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.status(200).json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getImagesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { platform } = req.query;

    const validTypes = ImageStore.getImageTypes();
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid image type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const filter = {
      type,
      isDeleted: false,
      isActive: true
    };

    if (platform) {
      if (platform === 'web') {
        filter.$or = [{ platform: 'web' }, { platform: 'both' }];
      } else if (platform === 'app') {
        filter.$or = [{ platform: 'app' }, { platform: 'both' }];
      } else if (platform === 'both') {
        filter.platform = 'both';
      }
    }

    const images = await ImageStore.find(filter)
      .select('imageUrl title type platform orderBy altText description linkUrl width height clickCount')
      .sort({ orderBy: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: images.length,
      data: images
    });
  } catch (error) {
    console.error('Error fetching images by type:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      platform,
      orderBy,
      isActive,
      altText,
      description,
      linkUrl,
      metadata
    } = req.body;

    const userId = req.user._id;

    const image = await ImageStore.findOne({ _id: id, isDeleted: false });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    if (title) image.title = title;
    if (type) {
      const validTypes = ImageStore.getImageTypes();
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid image type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      image.type = type;
    }
    if (platform) {
      const validPlatforms = ImageStore.getPlatforms();
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          message: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
        });
      }
      image.platform = platform;
    }
    if (orderBy !== undefined) image.orderBy = orderBy;
    if (isActive !== undefined) image.isActive = isActive;
    if (altText !== undefined) image.altText = altText;
    if (description !== undefined) image.description = description;
    if (linkUrl !== undefined) image.linkUrl = linkUrl;
    if (metadata) image.metadata = JSON.parse(metadata);

    image.updatedBy = userId;
    image.updatedAt = Date.now();

    await image.save();

    res.status(200).json({
      success: true,
      message: 'Image updated successfully',
      data: image
    });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.replaceImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'New image file is required'
      });
    }

    const image = await ImageStore.findOne({ _id: id, isDeleted: false });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    try {
      await deleteImageFromS3(image.imageUrl);
    } catch (deleteError) {
      console.error('Error deleting old image from S3:', deleteError);
    }

    image.imagePath = req.file.s3Key;
    image.imageUrl = req.file.s3Url;
    image.width = req.file.width;
    image.height = req.file.height;
    image.fileSize = req.file.size;
    image.mimeType = req.file.mimetype;
    image.updatedBy = userId;
    image.updatedAt = Date.now();

    await image.save();

    res.status(200).json({
      success: true,
      message: 'Image replaced successfully',
      data: image
    });
  } catch (error) {
    console.error('Error replacing image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateImageOrder = async (req, res) => {
  try {
    const { orders } = req.body;
    const userId = req.user._id;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'Orders array is required with format: [{ id, orderBy }]'
      });
    }

    const updatePromises = orders.map(item => {
      return ImageStore.findByIdAndUpdate(
        item.id,
        { 
          orderBy: item.orderBy,
          updatedBy: userId,
          updatedAt: Date.now()
        },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Image orders updated successfully'
    });
  } catch (error) {
    console.error('Error updating image orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.toggleImageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const image = await ImageStore.findOne({ _id: id, isDeleted: false });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    image.isActive = !image.isActive;
    image.updatedBy = userId;
    image.updatedAt = Date.now();

    await image.save();

    res.status(200).json({
      success: true,
      message: `Image ${image.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: image._id,
        isActive: image.isActive
      }
    });
  } catch (error) {
    console.error('Error toggling image status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const image = await ImageStore.findOne({ _id: id, isDeleted: false });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    image.isDeleted = true;
    image.deletedBy = userId;
    image.deletedAt = Date.now();
    image.updatedAt = Date.now();

    await image.save();

    res.status(200).json({
      success: true,
      message: 'Image soft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.permanentDeleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageStore.findById(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    try {
      await deleteImageFromS3(image.imageUrl);
    } catch (deleteError) {
      console.error('Error deleting image from S3:', deleteError);
    }

    await ImageStore.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Image permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error permanently deleting image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.restoreImage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const image = await ImageStore.findOne({ _id: id, isDeleted: true });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Deleted image not found'
      });
    }

    image.isDeleted = false;
    image.deletedBy = null;
    image.deletedAt = null;
    image.updatedBy = userId;
    image.updatedAt = Date.now();

    await image.save();

    res.status(200).json({
      success: true,
      message: 'Image restored successfully',
      data: image
    });
  } catch (error) {
    console.error('Error restoring image:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.incrementClickCount = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageStore.findOneAndUpdate(
      { _id: id, isDeleted: false, isActive: true },
      { $inc: { clickCount: 1 } },
      { new: true }
    );

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Click count incremented',
      clickCount: image.clickCount
    });
  } catch (error) {
    console.error('Error incrementing click count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getImageStats = async (req, res) => {
  try {
    const stats = await ImageStore.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          inactiveCount: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
          },
          totalClicks: { $sum: '$clickCount' },
          avgFileSize: { $avg: '$fileSize' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const platformStats = await ImageStore.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    const totalImages = await ImageStore.countDocuments({ isDeleted: false });
    const activeImages = await ImageStore.countDocuments({ isDeleted: false, isActive: true });
    const deletedImages = await ImageStore.countDocuments({ isDeleted: true });

    const recentImages = await ImageStore.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title type imageUrl createdAt');

    const mostClickedImages = await ImageStore.find({ isDeleted: false })
      .sort({ clickCount: -1 })
      .limit(5)
      .select('title type imageUrl clickCount');

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalImages,
          activeImages,
          inactiveImages: totalImages - activeImages,
          deletedImages
        },
        typeStats: stats,
        platformStats,
        recentImages,
        mostClickedImages
      }
    });
  } catch (error) {
    console.error('Error fetching image stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, isActive } = req.body;
    const userId = req.user._id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Image IDs array is required'
      });
    }

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isActive status is required'
      });
    }

    const result = await ImageStore.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      {
        $set: {
          isActive,
          updatedBy: userId,
          updatedAt: Date.now()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} images updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk updating images:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user._id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Image IDs array is required'
      });
    }

    const result = await ImageStore.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedBy: userId,
          deletedAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} images deleted successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk deleting images:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getImageTypes = async (req, res) => {
  try {
    const types = ImageStore.getImageTypes();
    const platforms = ImageStore.getPlatforms();

    res.status(200).json({
      success: true,
      data: {
        types,
        platforms
      }
    });
  } catch (error) {
    console.error('Error fetching image types:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};