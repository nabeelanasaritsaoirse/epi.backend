const Category = require('../models/Category');
const Product = require('../models/Product');
const mongoose = require('mongoose');

/**
 * Category Service Layer
 * Contains all business logic for category operations
 */
class CategoryService {

  /**
   * Create a new category
   */
  async createCategory(categoryData) {
    try {
      // Validate parent category if provided
      if (categoryData.parentCategory) {
        const parentExists = await Category.findById(categoryData.parentCategory);
        if (!parentExists) {
          throw new Error('Parent category not found');
        }

        if (!parentExists.isActive) {
          throw new Error('Cannot create subcategory under inactive parent');
        }
      }

      // Create category
      const category = new Category(categoryData);
      await category.save();

      // Populate parent if exists
      if (category.parentCategory) {
        await category.populate('parentCategory', 'name slug');
      }

      return {
        success: true,
        message: 'Category created successfully',
        data: category
      };
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Category with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId, options = {}) {
    try {
      const query = Category.findById(categoryId);

      if (options.includeInactive !== true) {
        query.where('isActive').equals(true);
      }

      if (options.populateParent) {
        query.populate('parentCategory', 'name slug level');
      }

      if (options.populateSubcategories) {
        query.populate({
          path: 'subcategories',
          match: { isActive: true },
          select: 'name slug level images displayOrder productCount',
          options: { sort: { displayOrder: 1, name: 1 } }
        });
      }

      if (options.populatePath) {
        query.populate('path', 'name slug level');
      }

      const category = await query.exec();

      if (!category) {
        throw new Error('Category not found');
      }

      return {
        success: true,
        data: category
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all categories with filtering and pagination
   */
  async getAllCategories(filters = {}, pagination = {}) {
    try {
      const {
        search,
        parentCategory,
        level,
        isActive,
        isFeatured,
        showInMenu
      } = filters;

      const {
        page = 1,
        limit = 20,
        sort = 'displayOrder',
        order = 'asc'
      } = pagination;

      // Build query
      const query = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } }
        ];
      }

      if (parentCategory !== undefined) {
        query.parentCategory = parentCategory === 'null' || parentCategory === null
          ? null
          : parentCategory;
      }

      if (level !== undefined) {
        query.level = parseInt(level);
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true' || isActive === true;
      }

      if (isFeatured !== undefined) {
        query.isFeatured = isFeatured === 'true' || isFeatured === true;
      }

      if (showInMenu !== undefined) {
        query.showInMenu = showInMenu === 'true' || showInMenu === true;
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOrder = order === 'asc' ? 1 : -1;
      const sortObj = {};
      sortObj[sort] = sortOrder;

      // Execute query
      const [categories, total] = await Promise.all([
        Category.find(query)
          .populate('parentCategory', 'name slug level')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Category.countDocuments(query)
      ]);

      return {
        success: true,
        data: categories,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category tree structure
   */
  async getCategoryTree(options = {}) {
    try {
      const { includeInactive = false, maxLevel = 5 } = options;

      const query = { level: { $lte: maxLevel } };
      if (!includeInactive) {
        query.isActive = true;
      }

      const categories = await Category.find(query)
        .sort({ displayOrder: 1, name: 1 })
        .lean();

      // Build tree structure
      const categoryMap = {};
      const tree = [];

      // Create a map of all categories
      categories.forEach(cat => {
        categoryMap[cat._id] = { ...cat, children: [] };
      });

      // Build the tree
      categories.forEach(cat => {
        if (cat.parentCategory) {
          const parent = categoryMap[cat.parentCategory];
          if (parent) {
            parent.children.push(categoryMap[cat._id]);
          }
        } else {
          tree.push(categoryMap[cat._id]);
        }
      });

      return {
        success: true,
        data: tree
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, updateData) {
    try {
      const category = await Category.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      // Validate parent category change
      if (updateData.parentCategory !== undefined && updateData.parentCategory !== null) {
        // Prevent setting self as parent
        if (updateData.parentCategory.toString() === categoryId.toString()) {
          throw new Error('Category cannot be its own parent');
        }

        // Check if new parent exists
        const newParent = await Category.findById(updateData.parentCategory);
        if (!newParent) {
          throw new Error('Parent category not found');
        }

        // Prevent circular references - check if new parent is a descendant
        const descendants = await this.getAllDescendants(categoryId);
        const descendantIds = descendants.map(d => d._id.toString());

        if (descendantIds.includes(updateData.parentCategory.toString())) {
          throw new Error('Cannot set a descendant category as parent (circular reference)');
        }
      }

      // Apply updates
      Object.keys(updateData).forEach(key => {
        category[key] = updateData[key];
      });

      await category.save();

      // Update all descendant categories if hierarchy changed
      if (updateData.parentCategory !== undefined) {
        await this.updateDescendantPaths(categoryId);
      }

      return {
        success: true,
        message: 'Category updated successfully',
        data: category
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId, options = {}) {
    try {
      const { force = false, moveProductsTo = null } = options;

      const category = await Category.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      // Check for subcategories
      const subcategoryCount = await Category.countDocuments({ parentCategory: categoryId });

      if (subcategoryCount > 0 && !force) {
        throw new Error(`Cannot delete category with ${subcategoryCount} subcategories. Use force delete or remove subcategories first.`);
      }

      // Check for products
      const productCount = await Product.countDocuments({ category: categoryId });

      if (productCount > 0) {
        if (moveProductsTo) {
          // Move products to another category
          await Product.updateMany(
            { category: categoryId },
            { category: moveProductsTo }
          );
        } else if (!force) {
          throw new Error(`Cannot delete category with ${productCount} products. Move products first or use force delete.`);
        } else {
          // Force delete - remove category from products
          await Product.updateMany(
            { category: categoryId },
            { $unset: { category: "" } }
          );
        }
      }

      // Delete all subcategories if force delete
      if (force && subcategoryCount > 0) {
        const descendants = await this.getAllDescendants(categoryId);
        const descendantIds = descendants.map(d => d._id);
        await Category.deleteMany({ _id: { $in: descendantIds } });
      }

      // Delete the category
      await Category.findByIdAndDelete(categoryId);

      return {
        success: true,
        message: 'Category deleted successfully',
        data: {
          deletedCategoryId: categoryId,
          subcategoriesDeleted: force ? subcategoryCount : 0,
          productsAffected: productCount,
          productsMoved: moveProductsTo ? productCount : 0
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all descendants of a category (recursive)
   */
  async getAllDescendants(categoryId) {
    const descendants = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = await Category.find({ parentCategory: currentId }).lean();

      children.forEach(child => {
        descendants.push(child);
        queue.push(child._id);
      });
    }

    return descendants;
  }

  /**
   * Update paths for all descendants when parent changes
   */
  async updateDescendantPaths(categoryId) {
    const descendants = await this.getAllDescendants(categoryId);

    for (const descendant of descendants) {
      const cat = await Category.findById(descendant._id);
      await cat.save(); // This will trigger the pre-save hook to recalculate path
    }
  }

  /**
   * Update product count for a category
   */
  async updateProductCount(categoryId) {
    try {
      const count = await Product.countDocuments({
        category: categoryId,
        isActive: true
      });

      await Category.findByIdAndUpdate(categoryId, { productCount: count });

      return {
        success: true,
        data: { categoryId, productCount: count }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk update display order
   */
  async updateDisplayOrder(orderData) {
    try {
      const updates = orderData.map(item => ({
        updateOne: {
          filter: { _id: item.categoryId },
          update: { displayOrder: item.order }
        }
      }));

      const result = await Category.bulkWrite(updates);

      return {
        success: true,
        message: 'Display order updated successfully',
        data: {
          modified: result.modifiedCount
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle category active status
   */
  async toggleActiveStatus(categoryId) {
    try {
      const category = await Category.findById(categoryId);

      if (!category) {
        throw new Error('Category not found');
      }

      category.isActive = !category.isActive;
      await category.save();

      // If deactivating, also deactivate all subcategories
      if (!category.isActive) {
        const descendants = await this.getAllDescendants(categoryId);
        const descendantIds = descendants.map(d => d._id);

        await Category.updateMany(
          { _id: { $in: descendantIds } },
          { isActive: false }
        );
      }

      return {
        success: true,
        message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        data: category
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get breadcrumb trail for a category
   */
  async getBreadcrumb(categoryId) {
    try {
      const category = await Category.findById(categoryId)
        .populate('path', 'name slug')
        .lean();

      if (!category) {
        throw new Error('Category not found');
      }

      const breadcrumb = [
        ...category.path,
        { _id: category._id, name: category.name, slug: category.slug }
      ];

      return {
        success: true,
        data: breadcrumb
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CategoryService();
