const FeaturedList = require("../models/FeaturedList");
const Product = require("../models/Product");
const { v4: uuidv4 } = require("uuid");

// ============================================
// ADMIN CONTROLLERS
// ============================================

// Create a new featured list
exports.createList = async (req, res) => {
  try {
    const { listName, slug, description, isActive, displayOrder } = req.body;

    if (!listName || !slug) {
      return res.status(400).json({
        success: false,
        message: "listName and slug are required",
      });
    }

    // Check if slug already exists
    const existing = await FeaturedList.findOne({ slug, isDeleted: false });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A list with this slug already exists",
      });
    }

    const listId = uuidv4();

    const featuredList = new FeaturedList({
      listId,
      listName,
      slug: slug.toLowerCase().trim(),
      description,
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder || 0,
      products: [],
      createdBy: req.user._id,
      createdByEmail: req.user.email,
    });

    await featuredList.save();

    res.status(201).json({
      success: true,
      message: "Featured list created successfully",
      data: featuredList,
    });
  } catch (error) {
    console.error("Error creating featured list:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all featured lists (admin view - includes inactive)
exports.getAllListsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query;

    const query = { isDeleted: false };

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (search) {
      query.$or = [
        { listName: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const lists = await FeaturedList.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await FeaturedList.countDocuments(query);

    res.json({
      success: true,
      data: lists,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching lists:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single list by ID or slug (admin view)
exports.getListByIdAdmin = async (req, res) => {
  try {
    const { listId } = req.params;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("Error fetching list:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update list details
exports.updateList = async (req, res) => {
  try {
    const { listId } = req.params;
    const { listName, slug, description, isActive, displayOrder } = req.body;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    // Check if new slug conflicts with another list
    if (slug && slug !== list.slug) {
      const existing = await FeaturedList.findOne({
        slug: slug.toLowerCase().trim(),
        isDeleted: false,
        _id: { $ne: list._id },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A list with this slug already exists",
        });
      }

      list.slug = slug.toLowerCase().trim();
    }

    if (listName) list.listName = listName;
    if (description !== undefined) list.description = description;
    if (isActive !== undefined) list.isActive = isActive;
    if (displayOrder !== undefined) list.displayOrder = displayOrder;

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save();

    res.json({
      success: true,
      message: "List updated successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error updating list:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete list (soft delete)
exports.deleteList = async (req, res) => {
  try {
    const { listId } = req.params;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    list.isDeleted = true;
    list.deletedAt = Date.now();
    list.deletedBy = req.user._id;
    list.deletedByEmail = req.user.email;

    await list.save();

    res.json({
      success: true,
      message: "List deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting list:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add product to list
exports.addProductToList = async (req, res) => {
  try {
    const { listId } = req.params;
    const { productId, order } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "productId is required",
      });
    }

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    // Check if product already in list
    const existingProduct = list.products.find(
      (p) => p.productId === productId
    );
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product already exists in this list",
      });
    }

    // Fetch product details
    const product = await Product.findOne({ productId, isDeleted: false });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Add product with cached data
    const newOrder = order || list.products.length + 1;

    list.products.push({
      productId: product.productId,
      productMongoId: product._id,
      order: newOrder,
      productName: product.name,
      brand: product.brand || null,
      productImage: product.images?.[0]?.url || product.images?.[0] || null,
      price: product.pricing?.regularPrice || 0,
      finalPrice: product.pricing?.finalPrice || 0,
      lastSynced: Date.now(),
    });

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save(); // This will auto-normalize orders

    res.json({
      success: true,
      message: "Product added to list successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove product from list
exports.removeProductFromList = async (req, res) => {
  try {
    const { listId, productId } = req.params;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    const productIndex = list.products.findIndex(
      (p) => p.productId === productId
    );

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in this list",
      });
    }

    list.products.splice(productIndex, 1);

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save(); // This will auto-normalize remaining orders

    res.json({
      success: true,
      message: "Product removed from list successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error removing product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reorder products in list
exports.reorderProducts = async (req, res) => {
  try {
    const { listId } = req.params;
    const { products } = req.body; // Array of { productId, order }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "products array is required",
      });
    }

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    // Update orders
    products.forEach((p) => {
      const product = list.products.find((lp) => lp.productId === p.productId);
      if (product) {
        product.order = p.order;
      }
    });

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save(); // This will auto-normalize orders

    res.json({
      success: true,
      message: "Products reordered successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error reordering products:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync cached product data for a specific product in a list
exports.syncProductInList = async (req, res) => {
  try {
    const { listId, productId } = req.params;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    const synced = await list.syncProduct(productId);

    if (!synced) {
      return res.status(404).json({
        success: false,
        message: "Product not found or removed from list",
      });
    }

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save();

    res.json({
      success: true,
      message: "Product synced successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error syncing product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Sync all products in a list
exports.syncAllProductsInList = async (req, res) => {
  try {
    const { listId } = req.params;

    const list = await FeaturedList.findOne({
      $or: [{ listId }, { slug: listId }],
      isDeleted: false,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    const productIds = list.products.map((p) => p.productId);

    for (const productId of productIds) {
      await list.syncProduct(productId);
    }

    list.updatedBy = req.user._id;
    list.updatedByEmail = req.user.email;

    await list.save();

    res.json({
      success: true,
      message: "All products synced successfully",
      data: list,
    });
  } catch (error) {
    console.error("Error syncing all products:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// PUBLIC CONTROLLERS
// ============================================

// Get all active lists (public view)
exports.getAllListsPublic = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const lists = await FeaturedList.find({
      isActive: true,
      isDeleted: false,
    })
      .select("listId listName slug description displayOrder products")
      .sort({ displayOrder: 1, createdAt: -1 });

    // Filter products by region availability if region is detected
    const userRegion = req.detectedRegion || req.query.region;

    const filteredLists = await Promise.all(
      lists.map(async (list) => {
        let filteredProducts = list.products;

        if (userRegion) {
          // Fetch full product details to check regional availability
          const productIds = list.products.map((p) => p.productId);
          const products = await Product.find({
            productId: { $in: productIds },
            isDeleted: false,
            status: "active",
          });

          // Filter products available in user's region
          filteredProducts = list.products.filter((lp) => {
            const product = products.find((p) => p.productId === lp.productId);
            if (!product) return false;

            // Check regional availability
            const regionalAvailability = product.regionalAvailability?.find(
              (ra) => ra.region.toLowerCase() === userRegion.toLowerCase()
            );

            return (
              regionalAvailability?.isAvailable &&
              regionalAvailability?.stockQuantity > 0
            );
          });
        }

        // Sort products by order
        filteredProducts.sort((a, b) => a.order - b.order);

        // Store total count before limiting
        const totalCount = filteredProducts.length;

        // Limit products per list for response
        const limitedProducts = filteredProducts.slice(0, parseInt(limit));

        return {
          listId: list.listId,
          listName: list.listName,
          slug: list.slug,
          description: list.description,
          displayOrder: list.displayOrder,
          products: limitedProducts,
          totalProducts: totalCount,
        };
      })
    );

    res.json({
      success: true,
      data: filteredLists,
      region: userRegion || "global",
    });
  } catch (error) {
    console.error("Error fetching public lists:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single list by slug (public view)
exports.getListBySlugPublic = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const list = await FeaturedList.findOne({
      slug,
      isActive: true,
      isDeleted: false,
    }).select("listId listName slug description displayOrder products");

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Featured list not found",
      });
    }

    let filteredProducts = list.products;

    // Filter by region if detected
    const userRegion = req.detectedRegion || req.query.region;

    if (userRegion) {
      const productIds = list.products.map((p) => p.productId);
      const products = await Product.find({
        productId: { $in: productIds },
        isDeleted: false,
        status: "active",
      });

      filteredProducts = list.products.filter((lp) => {
        const product = products.find((p) => p.productId === lp.productId);
        if (!product) return false;

        const regionalAvailability = product.regionalAvailability?.find(
          (ra) => ra.region.toLowerCase() === userRegion.toLowerCase()
        );

        return (
          regionalAvailability?.isAvailable &&
          regionalAvailability?.stockQuantity > 0
        );
      });
    }

    // Sort and paginate
    filteredProducts.sort((a, b) => a.order - b.order);

    const total = filteredProducts.length;
    const paginatedProducts = filteredProducts.slice(
      (parseInt(page) - 1) * parseInt(limit),
      parseInt(page) * parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        listId: list.listId,
        listName: list.listName,
        slug: list.slug,
        description: list.description,
        products: paginatedProducts,
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
      region: userRegion || "global",
    });
  } catch (error) {
    console.error("Error fetching list by slug:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
