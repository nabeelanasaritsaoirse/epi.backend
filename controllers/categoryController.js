const Category = require("../models/Category");
const {
  uploadSingleFileToS3,
  uploadMultipleFilesToS3,
  deleteImageFromS3,
} = require("../services/awsUploadService");
const {
  exportCategoriesToExcel,
  exportCategoriesToCSV,
} = require("../services/exportService");

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Admin
 */
exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      parentCategoryId,
      image,
      images,
      meta,
      displayOrder,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    // Validate parent category
    if (parentCategoryId) {
      const parent = await Category.findById(parentCategoryId);
      if (!parent)
        return res
          .status(404)
          .json({ success: false, message: "Parent category not found" });
    }

    // Category ID
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const categoryId = `CAT${timestamp}${random}`;

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // FINAL IMAGE HANDLING (URL MODE)
    let finalImages = Array.isArray(images) ? images : [];
    let finalSingleImage = image || finalImages[0] || {};

    const newCategory = new Category({
      categoryId,
      name,
      description,
      slug,
      image: image || {},
      parentCategoryId: parentCategoryId || null,
      subCategories: [],
      displayOrder: displayOrder || 0,
      meta: meta || {},
      isActive: true,
      isFeatured:
        req.body.isFeatured === true || req.body.isFeatured === "true", // ✅ FIX
    });
    // 🌍 REGIONAL SUPPORT
    newCategory.availableInRegions = req.body.availableInRegions || [];

    // Regional meta FIX
    newCategory.regionalMeta = Array.isArray(req.body.regionalMeta)
      ? req.body.regionalMeta.map((rm) => ({
          region: rm.region,
          metaTitle: rm.metaTitle || "",
          metaDescription: rm.metaDescription || "",
          keywords: Array.isArray(rm.keywords)
            ? rm.keywords
            : typeof rm.keywords === "string"
            ? rm.keywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
            : [],
        }))
      : [];

    await newCategory.save();

    if (parentCategoryId) {
      await Category.findByIdAndUpdate(parentCategoryId, {
        $push: { subCategories: newCategory._id },
      });
    }
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all categories with optional filtering
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAllCategories = async (req, res) => {
  try {
    const { parentCategoryId, isActive } = req.query;

    let filter = {};

    // Filter out soft deleted categories for non-admin users
    // Admin can see deleted categories only when explicitly requested
    const isAdmin = req.user && req.user.role === "admin";
    if (!isAdmin) {
      filter.isDeleted = false;
    }

    // Parent filter
    if (parentCategoryId) {
      filter.parentCategoryId =
        parentCategoryId === "null" ? null : parentCategoryId;
    }

    // Status filter ONLY if provided
    if (isActive !== undefined && isActive !== "all") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const categories = await Category.find(filter)
      .populate("subCategories", "categoryId name slug image displayOrder")
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get all categories for admin (includes deleted with indicator)
 * @route   GET /api/categories/admin/all
 * @access  Admin
 */
exports.getAllCategoriesForAdmin = async (req, res) => {
  try {
    const { parentCategoryId, isActive, showDeleted, region } = req.query;

    let filter = {};

    // Show deleted categories only if explicitly requested
    if (showDeleted !== "true") {
      filter.isDeleted = false;
    }

    // Parent filter
    if (parentCategoryId) {
      filter.parentCategoryId =
        parentCategoryId === "null" ? null : parentCategoryId;
    }

    // Status filter ONLY if provided
    if (isActive !== undefined && isActive !== "all") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    // Region filter - OPTIONAL for admin
    // Admin by default sees ALL regions
    // Use ?region=india to filter by specific region
    // Categories with empty availableInRegions array are global (visible everywhere)
    if (region && region !== "all" && region !== "global") {
      filter.$or = [
        { availableInRegions: region },
        { availableInRegions: { $size: 0 } }, // Global categories
        { availableInRegions: { $exists: false } }, // Legacy categories without region field
      ];
    }

    const categories = await Category.find(filter)
      .populate(
        "subCategories",
        "categoryId name slug image displayOrder isDeleted"
      )
      .populate("deletedBy", "name email")
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
      // Include applied filters for debugging
      appliedFilters: {
        parentCategoryId: parentCategoryId || "all",
        isActive: isActive || "all",
        region: region || "all",
        showDeleted: showDeleted === "true",
      },
    });
  } catch (error) {
    console.error("Error fetching categories for admin:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get category by ID
 * @route   GET /api/categories/:categoryId
 * @access  Public
 */
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId)
      .populate("parentCategoryId", "categoryId name slug")
      .populate("subCategories", "categoryId name slug image displayOrder")
      .exec();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category is deleted and user is not admin
    const isAdmin = req.user && req.user.role === "admin";
    if (category.isDeleted && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get category with its subcategories
 * @route   GET /api/categories/:categoryId/with-subcategories
 * @access  Public
 */
exports.getCategoryWithSubcategories = async (req, res) => {
  try {
    const category = await Category.findById(req.params.categoryId)
      .populate("subCategories")
      .exec();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error("Error fetching category with subcategories:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get all main categories with subcategories (for dropdown)
 * @route   GET /api/categories/dropdown/all
 * @access  Public
 */
exports.getCategoriesForDropdown = async (req, res) => {
  try {
    const categories = await Category.find({
      parentCategoryId: null,
      isActive: true,
    })
      .populate({
        path: "subCategories",
        match: { isActive: true },
        select: "categoryId name slug",
      })
      .select("categoryId name slug image")
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories for dropdown:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update category
 * @route   PUT /api/categories/:categoryId
 * @access  Admin
 */
exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      name,
      description,
      image,
      images,
      meta,
      displayOrder,
      isActive,
      isFeatured,
      parentCategoryId,
    } = req.body;

    const category = await Category.findById(categoryId);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    // Name update + slug regen
    if (name && name !== category.name) {
      const exists = await Category.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        _id: { $ne: categoryId },
      });

      if (exists)
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });

      category.name = name;
      category.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    // Description
    if (description !== undefined) category.description = description;

    // IMAGE HANDLING (URL MODE)
    if (images !== undefined && Array.isArray(images)) {
      category.images = images;
      category.image = images[0] || {};
    } else if (image !== undefined) {
      category.image = image;
    }

    // Meta
    if (meta !== undefined) category.meta = meta;
    // 🌍 Regional Availability
    if (req.body.availableInRegions !== undefined) {
      category.availableInRegions = req.body.availableInRegions;
    }

    // 🌍 Per-Region SEO Meta (SAFE & FIXED)
    if (req.body.regionalMeta !== undefined) {
      category.regionalMeta = Array.isArray(req.body.regionalMeta)
        ? req.body.regionalMeta.map((rm) => ({
            region: rm.region,
            metaTitle: rm.metaTitle || "",
            metaDescription: rm.metaDescription || "",
            keywords: Array.isArray(rm.keywords)
              ? rm.keywords
              : typeof rm.keywords === "string"
              ? rm.keywords
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean)
              : [],
          }))
        : []; // ensures no crash when input is invalid
    }
    // Flags
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    // FEATURED (Fixing your bug #2)
    if (isFeatured !== undefined) category.isFeatured = isFeatured;

    // Parent handling
    if (parentCategoryId !== undefined) {
      if (parentCategoryId === categoryId) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be its own parent",
        });
      }

      const oldParent = category.parentCategoryId;
      if (oldParent) {
        await Category.findByIdAndUpdate(oldParent, {
          $pull: { subCategories: categoryId },
        });
      }

      if (parentCategoryId && parentCategoryId !== "null") {
        category.parentCategoryId = parentCategoryId;
        await Category.findByIdAndUpdate(parentCategoryId, {
          $push: { subCategories: categoryId },
        });
      } else {
        category.parentCategoryId = null;
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/categories/:categoryId
 * @access  Admin
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { force = false } = req.query;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if already deleted
    if (category.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Category is already deleted",
      });
    }

    // Check if category has subcategories
    if (category.subCategories && category.subCategories.length > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Category has ${category.subCategories.length} subcategories. Delete subcategories first or use force=true`,
        subcategoriesCount: category.subCategories.length,
      });
    }

    // If force delete with subcategories, soft delete all subcategories first
    if (force && category.subCategories && category.subCategories.length > 0) {
      await Category.updateMany(
        { _id: { $in: category.subCategories } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user?._id || null,
          },
        }
      );
    }

    // Soft delete the category
    category.isDeleted = true;
    category.deletedAt = new Date();
    category.deletedBy = req.user?._id || null;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Restore deleted category
 * @route   PUT /api/categories/:categoryId/restore
 * @access  Admin
 */
exports.restoreCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (!category.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Category is not deleted",
      });
    }

    category.isDeleted = false;
    category.deletedAt = null;
    category.deletedBy = null;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category restored successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error restoring category:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Search categories
 * @route   GET /api/categories/search/:query
 * @access  Public
 */
exports.searchCategories = async (req, res) => {
  try {
    const { query } = req.params;

    const categories = await Category.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { slug: { $regex: query, $options: "i" } },
      ],
      isActive: true,
    })
      .populate("subCategories", "categoryId name slug")
      .limit(20)
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Error searching categories:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Bulk update category display order
 * @route   PUT /api/categories/bulk/reorder
 * @access  Admin
 */
exports.reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, displayOrder }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid categories array",
      });
    }

    for (const cat of categories) {
      await Category.findByIdAndUpdate(
        cat.id,
        { displayOrder: cat.displayOrder },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get category statistics
 * @route   GET /api/categories/stats
 * @access  Public
 */
exports.getCategoryStats = async (req, res) => {
  try {
    const totalCategories = await Category.countDocuments({});
    const activeCategories = await Category.countDocuments({ isActive: true });
    const inactiveCategories = await Category.countDocuments({
      isActive: false,
    });
    const featuredCategories = await Category.countDocuments({
      isFeatured: true,
    });
    const mainCategories = await Category.countDocuments({
      parentCategoryId: null,
    });
    const subCategories = await Category.countDocuments({
      parentCategoryId: { $ne: null },
    });

    // Get categories by level
    const categoriesByLevel = await Category.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalCategories,
        active: activeCategories,
        inactive: inactiveCategories,
        featured: featuredCategories,
        main: mainCategories,
        sub: subCategories,
        byLevel: categoriesByLevel,
      },
    });
  } catch (error) {
    console.error("Error fetching category stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update category image (with file upload to S3)
 * @route   PUT /api/categories/:categoryId/image
 * @access  Admin
 */
exports.updateCategoryImage = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Upload to S3
    const uploadResult = await uploadSingleFileToS3(file, "categories/", 800);

    category.image = {
      url: uploadResult.url,
      altText: req.body.altText || category.name,
    };

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category image uploaded and updated successfully",
      data: {
        categoryId: category._id,
        image: category.image,
      },
    });
  } catch (error) {
    console.error("Error updating category image:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update category banner (with file upload to S3)
 * @route   PUT /api/categories/:categoryId/banner
 * @access  Admin
 */
exports.updateCategoryBanner = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Banner image file is required",
      });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Upload to S3 (larger size for banner)
    const uploadResult = await uploadSingleFileToS3(
      file,
      "categories/banners/",
      1200
    );

    category.banner = {
      url: uploadResult.url,
      altText: req.body.altText || category.name,
      link: req.body.link || "",
    };

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category banner uploaded and updated successfully",
      data: {
        categoryId: category._id,
        banner: category.banner,
      },
    });
  } catch (error) {
    console.error("Error updating category banner:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update category meta/SEO (after creation)
 * @route   PUT /api/categories/:categoryId/meta
 * @access  Admin
 */
exports.updateCategoryMeta = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { title, description, keywords } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.meta = {
      title: title || category.meta?.title || category.name,
      description: description || category.meta?.description || "",
      keywords: keywords || category.meta?.keywords || [],
    };

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category meta updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category meta:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Toggle category featured status
 * @route   PUT /api/categories/:categoryId/toggle-featured
 * @access  Admin
 */
exports.toggleFeatured = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.isFeatured = !category.isFeatured;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${
        category.isFeatured ? "featured" : "unfeatured"
      } successfully`,
      data: category,
    });
  } catch (error) {
    console.error("Error toggling featured status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get featured categories
 * @route   GET /api/categories/featured
 * @access  Public
 */
exports.getFeaturedCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isFeatured: true,
      isActive: true,
    })
      .populate("subCategories", "categoryId name slug image")
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching featured categories:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Delete individual image from category
 * @route   DELETE /api/categories/:categoryId/images/:imageIndex
 * @access  Admin
 */
exports.deleteCategoryImage = async (req, res) => {
  try {
    const { categoryId, imageIndex } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Convert imageIndex to number (1-based)
    const index = parseInt(imageIndex);

    if (isNaN(index) || index < 1) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid image index. Index must be a positive number starting from 1",
      });
    }

    // Convert to 0-based index for array
    const arrayIndex = index - 1;

    if (!category.images || arrayIndex >= category.images.length) {
      return res.status(400).json({
        success: false,
        message: "Image index out of range",
      });
    }

    // Get the image to delete
    const imageToDelete = category.images[arrayIndex];

    // Delete image from S3
    if (imageToDelete.url) {
      try {
        await deleteImageFromS3(imageToDelete.url);
      } catch (error) {
        console.error("Error deleting image from S3:", error);
        // Continue with deletion even if S3 delete fails
      }
    }

    // Remove image from array
    category.images.splice(arrayIndex, 1);

    // Re-index remaining images (1-based)
    category.images.forEach((img, idx) => {
      img.order = idx + 1;
    });

    await category.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error deleting category image:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Reorder category images
 * @route   PUT /api/categories/:categoryId/images/reorder
 * @access  Admin
 */
exports.reorderCategoryImages = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { imageOrders } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (!imageOrders || !Array.isArray(imageOrders)) {
      return res.status(400).json({
        success: false,
        message:
          "imageOrders must be an array of {index: number, order: number}",
      });
    }

    // Validate all indices are within range
    for (const item of imageOrders) {
      const arrayIndex = item.index - 1; // Convert from 1-based to 0-based
      if (arrayIndex < 0 || arrayIndex >= category.images.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid index ${item.index}. Must be between 1 and ${category.images.length}`,
        });
      }
    }

    // Update order for each image
    imageOrders.forEach((item) => {
      const arrayIndex = item.index - 1;
      category.images[arrayIndex].order = item.order;
    });

    // Sort images by order
    category.images.sort((a, b) => a.order - b.order);

    await category.save();

    res.status(200).json({
      success: true,
      message: "Images reordered successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error reordering category images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Sync product counts for all categories
 * @route   POST /api/categories/sync-product-counts
 * @access  Admin
 */
exports.syncAllProductCounts = async (req, res) => {
  try {
    const Product = require("../models/Product");
    const categories = await Category.find({});
    let updated = 0;

    for (const category of categories) {
      // Count only active/published products that are not deleted
      const count = await Product.countDocuments({
        "category.mainCategoryId": category._id,
        isDeleted: false,
        status: { $in: ["published", "active"] },
      });

      category.productCount = count;
      await category.save();
      updated++;
    }

    res.json({
      success: true,
      message: `Product counts synced successfully for ${updated} categories`,
      data: {
        categoriesUpdated: updated,
      },
    });
  } catch (error) {
    console.error("Error syncing product counts:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Export categories to CSV or Excel
 * @route   GET /api/categories/export?format=excel
 * @access  Admin
 */
exports.exportCategories = async (req, res) => {
  try {
    const { format = 'excel', isActive, parentCategoryId } = req.query;

    // Build filter (same as existing response format)
    const filter = { isDeleted: false };

    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (parentCategoryId) {
      filter.parentCategoryId = parentCategoryId === 'null' ? null : parentCategoryId;
    }

    if (format === 'csv') {
      // Export as CSV
      const csvData = await exportCategoriesToCSV(filter);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="categories-${Date.now()}.csv"`);
      res.send(csvData);

    } else {
      // Export as Excel (default)
      const workbook = await exportCategoriesToExcel(filter);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="categories-${Date.now()}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
