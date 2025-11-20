const Category = require('../models/Category');

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Admin
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentCategoryId, image, meta, displayOrder } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ 
      name: { $regex: `^${name}$`, $options: 'i' } 
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists"
      });
    }

    // Validate parent category if provided
    if (parentCategoryId) {
      const parentCategory = await Category.findById(parentCategoryId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found"
        });
      }
    }

    // Generate category ID
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const categoryId = `CAT${timestamp}${random}`;

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

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
      isActive: true
    });

    await newCategory.save();

    // If it's a subcategory, add it to parent's subCategories array
    if (parentCategoryId) {
      await Category.findByIdAndUpdate(
        parentCategoryId,
        { $push: { subCategories: newCategory._id } },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get all categories with optional filtering
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAllCategories = async (req, res) => {
  try {
    const { parentCategoryId, isActive = true } = req.query;

    let filter = {};

    // Filter by parent category
    if (parentCategoryId) {
      filter.parentCategoryId = parentCategoryId === 'null' ? null : parentCategoryId;
    }

    // Filter by active status
    if (isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    // Get only main categories (no parent)
    if (!parentCategoryId) {
      filter.parentCategoryId = null;
    }

    const categories = await Category.find(filter)
      .populate('subCategories', 'categoryId name slug image displayOrder')
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
      .populate('parentCategoryId', 'categoryId name slug')
      .populate('subCategories', 'categoryId name slug image displayOrder')
      .exec();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
      .populate('subCategories')
      .exec();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category with subcategories:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
      isActive: true 
    })
      .populate({
        path: 'subCategories',
        match: { isActive: true },
        select: 'categoryId name slug'
      })
      .select('categoryId name slug image')
      .sort({ displayOrder: 1, name: 1 })
      .exec();

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories for dropdown:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
    const { name, description, image, meta, displayOrder, isActive, parentCategoryId } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check if new name already exists (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: { $regex: `^${name}$`, $options: 'i' },
        _id: { $ne: categoryId }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists"
        });
      }
    }

    // Validate parent category if provided
    if (parentCategoryId && parentCategoryId !== 'null') {
      // Cannot set a category as its own parent
      if (parentCategoryId === categoryId) {
        return res.status(400).json({
          success: false,
          message: "A category cannot be its own parent"
        });
      }

      const parentCategory = await Category.findById(parentCategoryId);
      if (!parentCategory) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found"
        });
      }
    }

    // Update fields
    if (name) {
      category.name = name;
      category.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (meta !== undefined) category.meta = meta;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    // Handle parent category change
    if (parentCategoryId !== undefined) {
      const oldParentId = category.parentCategoryId;
      
      // Remove from old parent's subCategories
      if (oldParentId) {
        await Category.findByIdAndUpdate(
          oldParentId,
          { $pull: { subCategories: categoryId } }
        );
      }

      // Add to new parent's subCategories
      if (parentCategoryId && parentCategoryId !== 'null') {
        category.parentCategoryId = parentCategoryId;
        await Category.findByIdAndUpdate(
          parentCategoryId,
          { $push: { subCategories: categoryId } },
          { new: true }
        );
      } else {
        category.parentCategoryId = null;
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
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
        message: "Category not found"
      });
    }

    // Check if category has subcategories
    if (category.subCategories && category.subCategories.length > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Category has ${category.subCategories.length} subcategories. Delete subcategories first or use force=true`,
        subcategoriesCount: category.subCategories.length
      });
    }

    // If force delete with subcategories, delete all subcategories first
    if (force && category.subCategories && category.subCategories.length > 0) {
      await Category.deleteMany({ _id: { $in: category.subCategories } });
    }

    // Remove from parent's subCategories if it's a subcategory
    if (category.parentCategoryId) {
      await Category.findByIdAndUpdate(
        category.parentCategoryId,
        { $pull: { subCategories: categoryId } }
      );
    }

    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } }
      ],
      isActive: true
    })
      .populate('subCategories', 'categoryId name slug')
      .limit(20)
      .exec();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    console.error('Error searching categories:', error);
    res.status(500).json({
      success: false,
      message: error.message
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
        message: "Invalid categories array"
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
      message: "Categories reordered successfully"
    });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
