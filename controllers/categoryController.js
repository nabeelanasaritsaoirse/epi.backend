const Category = require("../models/Category");
const {
  uploadSingleFileToS3,
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
    const { name, description, parentCategoryId, meta, displayOrder } =
      req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      isDeleted: false, // ← CRITICAL FIX
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

    const newCategory = new Category({
      categoryId,
      name,
      description,
      slug,
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
    const isAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "super_admin");
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
      .populate(
        "subCategories",
        "categoryId name slug displayOrder mainImage iconImage"
      )
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
      .populate(
        "subCategories",
        "categoryId name slug displayOrder mainImage iconImage"
      )
      .exec();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category is deleted and user is not admin
    const isAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "super_admin");
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
      .select("categoryId name slug mainImage iconImage")
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
    const { name, description, parentCategoryId, meta, displayOrder } =
      req.body;

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

    // Meta
    if (meta !== undefined) category.meta = meta;

    // 🌍 Regional Availability
    if (req.body.availableInRegions !== undefined) {
      category.availableInRegions = req.body.availableInRegions;
    }

    // 🌍 Per-Region SEO Meta
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
        : [];
    }

    // Display order
    if (displayOrder !== undefined) category.displayOrder = displayOrder;

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
      .populate(
        "subCategories",
        "categoryId name slug displayOrder mainImage iconImage"
      )
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
      .populate(
        "subCategories",
        "categoryId name slug displayOrder mainImage iconImage"
      )

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
    const { format = "excel", isActive, parentCategoryId } = req.query;

    // Build filter (same as existing response format)
    const filter = { isDeleted: false };

    if (isActive !== undefined && isActive !== "all") {
      filter.isActive = isActive === "true" || isActive === true;
    }

    if (parentCategoryId) {
      filter.parentCategoryId =
        parentCategoryId === "null" ? null : parentCategoryId;
    }

    if (format === "csv") {
      // Export as CSV
      const csvData = await exportCategoriesToCSV(filter);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="categories-${Date.now()}.csv"`
      );
      res.send(csvData);
    } else {
      // Export as Excel (default)
      const workbook = await exportCategoriesToExcel(filter);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="categories-${Date.now()}.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Hard delete category (permanently removes from database)
 * @route   DELETE /api/categories/:categoryId/hard
 * @access  Admin
 */
exports.hardDeleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { confirmDelete } = req.query;

    // Safety check - require explicit confirmation
    if (confirmDelete !== "true") {
      return res.status(400).json({
        success: false,
        message:
          "Hard delete requires confirmDelete=true query parameter for safety",
      });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has subcategories
    if (category.subCategories && category.subCategories.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot hard delete category with ${category.subCategories.length} subcategories. Delete subcategories first.`,
        subcategoriesCount: category.subCategories.length,
      });
    }

    // Remove from parent category's subCategories array if it has a parent
    if (category.parentCategoryId) {
      await Category.findByIdAndUpdate(category.parentCategoryId, {
        $pull: { subCategories: categoryId },
      });
    }

    // Permanently delete the category
    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({
      success: true,
      message: "Category permanently deleted from database",
      deletedCategory: {
        id: category._id,
        name: category.name,
        categoryId: category.categoryId,
      },
    });
  } catch (error) {
    console.error("Error hard deleting category:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateCategoryImages = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No category images uploaded",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const fieldMap = {
      mainImage: "main",
      illustrationImage: "illustration",
      subcategoryImage: "subcategory",
      mobileImage: "mobile",
      iconImage: "icon",
    };

    for (const field in fieldMap) {
      const fileArr = req.files[field];
      if (!fileArr || !fileArr[0]) continue;

      // 🔥 DELETE OLD IMAGE FROM S3 (CRITICAL FIX)
      if (category[field]?.url) {
        await deleteImageFromS3(category[field].url);
      }

      const file = fileArr[0];
      const uploadResult = await uploadSingleFileToS3(file, "categories/", 800);

      category[field] = {
        type: fieldMap[field],
        url: uploadResult.url,
        altText: req.body?.[`${field}Alt`] || category.name,
        order: 1,
        isActive: true,
      };
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category images updated successfully",
      data: {
        mainImage: category.mainImage,
        illustrationImage: category.illustrationImage,
        subcategoryImage: category.subcategoryImage,
        mobileImage: category.mobileImage,
        iconImage: category.iconImage,
      },
    });
  } catch (error) {
    console.error("Error updating category images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.uploadCategoryBanners = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No banner images uploaded",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (!Array.isArray(category.bannerImages)) {
      category.bannerImages = [];
    }

    let orderStart = category.bannerImages.length + 1;

    for (const file of req.files) {
      const uploadResult = await uploadSingleFileToS3(
        file,
        "categories/banners/",
        1200
      );

      category.bannerImages.push({
        type: "banner",
        url: uploadResult.url,
        altText: req.body.altText || category.name,
        order: orderStart++,
        isActive: true,
      });
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Banner images uploaded successfully",
      data: category.bannerImages,
    });
  } catch (error) {
    console.error("Banner upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.reorderCategoryBanners = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { orders } = req.body;
    // orders = [{ id, order }]

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: "orders must be an array",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    orders.forEach(({ id, order }) => {
      const banner = category.bannerImages.id(id);
      if (banner) banner.order = order;
    });

    category.bannerImages.sort((a, b) => a.order - b.order);

    await category.save();

    res.status(200).json({
      success: true,
      message: "Banner images reordered successfully",
      data: category.bannerImages,
    });
  } catch (error) {
    console.error("Banner reorder error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCategoryBannerImage = async (req, res) => {
  try {
    const { categoryId, bannerImageId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const banner = category.bannerImages.id(bannerImageId);
    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner image not found" });
    }

    // delete from S3
    if (banner.url) {
      await deleteImageFromS3(banner.url);
    }

    banner.remove();
    category.bannerImages.forEach((b, i) => (b.order = i + 1));

    await category.save();

    res.status(200).json({
      success: true,
      message: "Banner image deleted successfully",
      data: category.bannerImages,
    });
  } catch (error) {
    console.error("Banner delete error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
