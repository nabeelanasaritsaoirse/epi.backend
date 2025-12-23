const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const {
  calculateEquivalentValues,
  generateInstallmentOptions,
} = require("../utils/productUtils");
const {
  uploadSingleFileToS3,
  uploadMultipleFilesToS3,
  deleteImageFromS3,
} = require("../services/awsUploadService");
const {
  exportProductsToExcel,
  exportProductsToCSV,
} = require("../services/exportService");

/**
 * Helper function to recursively get all subcategory IDs
 * @param {String} categoryId - The category ID to get subcategories for
 * @returns {Array} - Array of all category IDs (including the parent)
 */
async function getAllSubcategoryIds(categoryId) {
  try {
    // Validate if it's a valid ObjectId
    if (!mongoose.isValidObjectId(categoryId)) {
      return [categoryId];
    }

    const category = await Category.findById(categoryId).select(
      "subCategories"
    );

    if (
      !category ||
      !category.subCategories ||
      category.subCategories.length === 0
    ) {
      return [categoryId]; // Return only the category itself if no subcategories
    }

    let allIds = [categoryId];

    // Recursively get subcategories for each child
    for (const subCategoryId of category.subCategories) {
      const childIds = await getAllSubcategoryIds(subCategoryId);
      allIds = allIds.concat(
        childIds.filter((id) => id.toString() !== categoryId.toString())
      );
    }

    // Remove duplicates
    return [...new Set(allIds.map((id) => id.toString()))];
  } catch (error) {
    console.error("Error in getAllSubcategoryIds:", error);
    return [categoryId]; // Fallback to just the category ID
  }
}

// Create product and a number of product CRUD helpers with enhanced regional features
exports.createProduct = async (req, res) => {
  try {
    // Generate auto product ID if not provided
    if (!req.body.productId) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      req.body.productId = `PROD${timestamp}${random}`;
    }

    // Generate variant ID for the main product if not provided
    if (!req.body.variantId) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      req.body.variantId = `VAR${timestamp}${random}00`;
    }

    // Auto-calculate final prices if not provided
    if (req.body.regionalPricing) {
      req.body.regionalPricing = req.body.regionalPricing.map((pricing) => ({
        ...pricing,
        finalPrice:
          pricing.finalPrice || pricing.salePrice || pricing.regularPrice,
      }));
    }

    // Auto-calculate stock status if not provided
    if (req.body.regionalAvailability) {
      req.body.regionalAvailability = req.body.regionalAvailability.map(
        (availability) => ({
          ...availability,
          stockStatus:
            availability.stockStatus ||
            (availability.stockQuantity <= 0
              ? "out_of_stock"
              : availability.stockQuantity <= (availability.lowStockLevel || 10)
              ? "low_stock"
              : "in_stock"),
        })
      );
    }

    // Set default values for nested objects
    const productData = {
      ...req.body,

      availability: {
        isAvailable: true,
        stockQuantity: 0,
        lowStockLevel: 10,
        stockStatus: "in_stock",
        ...req.body.availability,
      },

      pricing: {
        currency: "USD",
        finalPrice:
          req.body.pricing?.salePrice || req.body.pricing?.regularPrice || 0,
        ...req.body.pricing,
      },

      // 🔥 FIX: Global products must NOT create fake "global" region rows
      regionalPricing: req.body.isGlobalProduct
        ? []
        : req.body.regionalPricing || [],

      regionalSeo: req.body.isGlobalProduct ? [] : req.body.regionalSeo || [],

      regionalAvailability: req.body.isGlobalProduct
        ? []
        : req.body.regionalAvailability || [],

      relatedProducts: req.body.relatedProducts || [],
      plans: req.body.plans || [],

      status: req.body.status || "draft",
      createdByEmail: req.user.email,
      updatedByEmail: req.user.email,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle variants if provided
    productData.hasVariants = !!req.body.hasVariants;
    if (productData.hasVariants) {
      if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "variants array is required when hasVariants is true",
        });
      }

      // Normalize variants: ensure variantId and sku exist, validate price
      const normalizedVariants = req.body.variants.map((v, idx) => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        // Add index to ensure uniqueness even if timestamp and random collide
        const variantId =
          v.variantId ||
          `VAR${timestamp}${random}${idx.toString().padStart(2, "0")}`;

        const skuBase =
          req.body.sku || req.body.productId || `PROD${timestamp}`;
        const sku = v.sku || `${skuBase}-V${idx + 1}-${variantId.slice(-4)}`;

        if (v.price === undefined || v.price === null) {
          throw new Error(
            `Each variant must include a price. Missing for variant at index ${idx}`
          );
        }

        return {
          variantId,
          sku,

          attributes: v.attributes !== undefined ? v.attributes : {},

          description: v.description !== undefined ? v.description : {},

          price: v.price,

          salePrice: v.salePrice !== undefined ? v.salePrice : undefined,

          paymentPlan: v.paymentPlan !== undefined ? v.paymentPlan : {},

          stock: v.stock !== undefined ? v.stock : 0, // ✅ allows 0 intentionally

          images: v.images !== undefined ? v.images : [], // ✅ explicit, safe

          isActive: v.isActive !== undefined ? v.isActive : true,
        };
      });

      productData.variants = normalizedVariants;
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        productId: product.productId,
        variantId: product.variantId,
        name: product.name,
        sku: product.sku,
      },
    });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product ID, Variant ID, or SKU already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status,
      region = "global",
      hasVariants,
      simpleOnly,
    } = req.query;

    const filter = {};

    // ===============================
    // ADMIN OVERRIDE (OPTION D FIX)
    // ===============================
    const isAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "super_admin");

    if (!isAdmin) {
      // Apply soft delete filter for normal users
      filter.isDeleted = false;
    }

    // ===============================
    // Variant filtering
    // ===============================
    if (simpleOnly === "true") {
      filter.hasVariants = false;
    } else if (hasVariants === "true") {
      filter.hasVariants = true;
    } else if (hasVariants === "false") {
      filter.hasVariants = false;
    }

    // ===============================
    // Search
    // ===============================
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "regionalSeo.metaTitle": { $regex: search, $options: "i" } },
      ];
    }

    // ===============================
    // Basic filters
    // ===============================
    // Support hierarchical category filtering (includes all subcategories)
    if (category) {
      // Get all subcategory IDs recursively
      const allCategoryIds = await getAllSubcategoryIds(category);

      const categoryFilter = {
        $or: [
          { "category.mainCategoryId": { $in: allCategoryIds } },
          { "category.subCategoryId": { $in: allCategoryIds } },
        ],
      };

      if (filter.$or) {
        // If search filter exists, use $and to combine
        filter.$and = [
          { $or: filter.$or }, // Search filter
          categoryFilter, // Category filter
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, categoryFilter);
      }
    }
    if (brand) filter.brand = brand;
    if (status) filter.status = status;

    // ===============================
    // REGION FILTER — DISABLED FOR ADMINS (IMPORTANT)
    // ===============================
    if (!isAdmin) {
      const userRegion =
        region && region !== "global" && region !== "all"
          ? region
          : req.userCountry;

      if (userRegion && userRegion !== "all" && userRegion !== "global") {
        // Show products available in user's region OR globally available products
        // Need to handle $or properly if it already exists (from search)
        const regionFilter = {
          $or: [
            {
              // Products specifically available in user's region
              "regionalAvailability.region": userRegion,
              "regionalAvailability.isAvailable": true,
            },
            {
              // Products marked as "global" region
              "regionalAvailability.region": "global",
              "regionalAvailability.isAvailable": true,
            },
            {
              // Products with no regional restrictions (empty array)
              regionalAvailability: { $exists: true, $size: 0 },
            },
          ],
        };

        // Merge with existing $or filter from search if present
        if (filter.$or) {
          filter.$and = [
            { $or: filter.$or }, // Search filter
            regionFilter, // Region filter
          ];
          delete filter.$or;
        } else {
          Object.assign(filter, regionFilter);
        }
      }
    }

    // ===============================
    // Price filter
    // ===============================
    if (minPrice || maxPrice) {
      filter["pricing.finalPrice"] = {};
      if (minPrice) filter["pricing.finalPrice"].$gte = parseFloat(minPrice);
      if (maxPrice) filter["pricing.finalPrice"].$lte = parseFloat(maxPrice);
    }

    // ===============================
    // DB Query
    // ===============================
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add this new endpoint for stats
exports.getProductStats = async (req, res) => {
  try {
    const { region = "global" } = req.query;

    const filter = {};
    if (region && region !== "global" && region !== "all") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    const totalProducts = await Product.countDocuments(filter);

    const inStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        { "availability.stockQuantity": { $gt: 0 } },
        { "regionalAvailability.stockQuantity": { $gt: 0 } },
      ],
    });

    const lowStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        {
          "availability.stockQuantity": { $gt: 0, $lte: 10 },
          "availability.stockStatus": "low_stock",
        },
        {
          "regionalAvailability.stockQuantity": { $gt: 0, $lte: 10 },
          "regionalAvailability.stockStatus": "low_stock",
        },
      ],
    });

    const outOfStockProducts = await Product.countDocuments({
      ...filter,
      $or: [
        { "availability.stockQuantity": 0 },
        { "regionalAvailability.stockQuantity": 0 },
      ],
    });

    res.json({
      success: true,
      data: {
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
      },
    });
  } catch (error) {
    console.error("Error getting product stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const id = req.params.productId;
    let product = await Product.findOne({ productId: id });

    // Fallback to Mongo _id if not found by productId
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findById(id);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.productId;

    let product = await Product.findOne({ productId: id });
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findById(id);
    }

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Ensure variants array always exists
    if (!Array.isArray(product.variants)) {
      product.variants = [];
    }

    // Update hasVariants
    if (req.body.hasVariants !== undefined) {
      product.hasVariants = !!req.body.hasVariants;
    }

    /* ============================================================
       VARIANTS — SAFE MERGE (IMAGE SAFE)
    ============================================================ */
    if (Array.isArray(req.body.variants)) {
      const updatedVariants = [];

      for (let idx = 0; idx < req.body.variants.length; idx++) {
        const v = req.body.variants[idx];

        const existingVariant = product.variants.find(
          (ev) => ev.variantId === v.variantId
        );

        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");

        const variantId =
          v.variantId ||
          existingVariant?.variantId ||
          `VAR${timestamp}${random}${idx.toString().padStart(2, "0")}`;

        const skuBase =
          req.body.sku ||
          product.sku ||
          product.productId ||
          `PROD${timestamp}`;

        const sku =
          v.sku ||
          existingVariant?.sku ||
          `${skuBase}-V${idx + 1}-${variantId.slice(-4)}`;

        if (v.price === undefined || v.price === null) {
          throw new Error(
            `Each variant must include a price. Missing for variant at index ${idx}`
          );
        }

        updatedVariants.push({
          variantId,
          sku,

          attributes:
            v.attributes !== undefined
              ? v.attributes
              : existingVariant?.attributes || {},

          description:
            v.description !== undefined
              ? v.description
              : existingVariant?.description || {},

          price: v.price,

          salePrice:
            v.salePrice !== undefined
              ? v.salePrice
              : existingVariant?.salePrice,

          paymentPlan:
            v.paymentPlan !== undefined
              ? v.paymentPlan
              : existingVariant?.paymentPlan || {},

          stock: v.stock !== undefined ? v.stock : existingVariant?.stock ?? 0,

          // 🔥 IMAGE PRESERVATION (CRITICAL)
          images:
            v.images !== undefined ? v.images : existingVariant?.images || [],

          isActive:
            v.isActive !== undefined
              ? v.isActive
              : existingVariant?.isActive ?? true,
        });
      }

      product.variants = updatedVariants;
    }

    /* ============================================================
       SAFE SHALLOW MERGE — NON VARIANT FIELDS
    ============================================================ */
    const updatableFields = [
      "name",
      "description",
      "brand",
      "pricing",
      "availability",
      "regionalPricing",
      "regionalSeo",
      "regionalAvailability",
      "relatedProducts",
      "paymentPlan",
      "plans",
      "origin",
      "referralBonus",
      "project",
      "dimensions",
      "warranty",
      "seo",
      "status",
      "isGlobalProduct",
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    /* ============================================================
       STOCK HANDLING — UNCHANGED
    ============================================================ */
    let stockUpdateRequested = false;
    let newStock = null;

    if (
      req.body.availability &&
      req.body.availability.stockQuantity !== undefined
    ) {
      newStock = Number(req.body.availability.stockQuantity);
      stockUpdateRequested = true;
    } else if (req.body.stock !== undefined) {
      newStock = Number(req.body.stock);
      stockUpdateRequested = true;
    } else if (req.body.pricing && req.body.pricing.stock !== undefined) {
      newStock = Number(req.body.pricing.stock);
      stockUpdateRequested = true;
    }

    if (stockUpdateRequested && !isNaN(newStock)) {
      product.availability.stockQuantity = newStock;

      if (newStock <= 0) {
        product.availability.stockStatus = "out_of_stock";
      } else if (newStock <= (product.availability.lowStockLevel || 10)) {
        product.availability.stockStatus = "low_stock";
      } else {
        product.availability.stockStatus = "in_stock";
      }

      if (Array.isArray(product.regionalAvailability)) {
        const globalRegion = product.regionalAvailability.find(
          (r) => r.region === "global"
        );
        if (globalRegion) {
          globalRegion.stockQuantity = newStock;
          globalRegion.stockStatus = product.availability.stockStatus;
        }
      }
    }

    product.updatedAt = new Date();
    product.updatedByEmail = req.user.email;
    await product.save();

    res.json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product ID, Variant ID, or SKU already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.productId;

    const query = mongoose.isValidObjectId(id)
      ? { _id: id }
      : { productId: id };

    const updated = await Product.findOneAndUpdate(
      query,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedByEmail: req.user.email,
          updatedByEmail: req.user.email,
        },
      },
      {
        new: true,
        runValidators: false, // 🔥 THIS is the key
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.restoreProduct = async (req, res) => {
  try {
    const id = req.params.productId;

    let product = await Product.findOne({ productId: id });
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findById(id);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Product is not deleted",
      });
    }

    product.isDeleted = false;
    product.deletedAt = null;
    product.deletedByEmail = null;

    product.restoredAt = new Date();
    product.restoredByEmail = req.user.email;
    product.updatedByEmail = req.user.email;
    await product.save();

    res.json({
      success: true,
      message: "Product restored successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10, region = "global" } = req.query;

    // Get all subcategory IDs recursively (includes parent + all children)
    const allCategoryIds = await getAllSubcategoryIds(category);

    // Support hierarchical category filtering
    const filter = {
      $or: [
        { "category.mainCategoryId": { $in: allCategoryIds } },
        { "category.subCategoryId": { $in: allCategoryIds } },
      ],
    };

    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const { region = "global" } = req.query;

    const filter = {
      "availability.stockStatus": "low_stock",
      "availability.isAvailable": true,
    };

    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
      filter["regionalAvailability.stockStatus"] = "low_stock";
    }

    const lowStockProducts = await Product.find(filter).sort({
      "availability.stockQuantity": 1,
    });

    res.json({
      success: true,
      data: lowStockProducts,
      count: lowStockProducts.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status,
    } = req.query;

    // Build filter object
    const filter = {
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "description.short": { $regex: search, $options: "i" } },
        { "description.long": { $regex: search, $options: "i" } },
        { "regionalSeo.metaTitle": { $regex: search, $options: "i" } },
      ];
    }

    // Support hierarchical category filtering
    if (category) {
      const allCategoryIds = await getAllSubcategoryIds(category);

      const categoryFilter = {
        $or: [
          { "category.mainCategoryId": { $in: allCategoryIds } },
          { "category.subCategoryId": { $in: allCategoryIds } },
        ],
      };

      if (filter.$or) {
        // If search filter exists, use $and to combine
        filter.$and = [
          { $or: filter.$or }, // Search filter
          categoryFilter, // Category filter
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, categoryFilter);
      }
    }
    if (brand) filter.brand = brand;
    if (status) filter.status = status;

    // Price range filter for specific region
    if (minPrice || maxPrice) {
      filter["regionalPricing"] = {
        $elemMatch: {
          region: region,
          finalPrice: {},
        },
      };
      if (minPrice)
        filter["regionalPricing"].$elemMatch.finalPrice.$gte =
          parseFloat(minPrice);
      if (maxPrice)
        filter["regionalPricing"].$elemMatch.finalPrice.$lte =
          parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addRegionalPricing = async (req, res) => {
  try {
    const { productId } = req.params;
    const { region, currency, regularPrice, salePrice, costPrice } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Remove existing pricing for this region
    product.regionalPricing = product.regionalPricing.filter(
      (p) => p.region !== region
    );

    // Add new pricing
    product.regionalPricing.push({
      region,
      currency,
      regularPrice,
      salePrice,
      costPrice,
      finalPrice: salePrice || regularPrice,
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional pricing added successfully",
      data: product.regionalPricing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addRegionalAvailability = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      region,
      stockQuantity,
      lowStockLevel,
      isAvailable = true,
    } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Calculate stock status
    let stockStatus = "in_stock";
    if (stockQuantity <= 0) {
      stockStatus = "out_of_stock";
    } else if (stockQuantity <= (lowStockLevel || 10)) {
      stockStatus = "low_stock";
    }

    // Remove existing availability for this region
    product.regionalAvailability = product.regionalAvailability.filter(
      (a) => a.region !== region
    );

    // Add new availability
    product.regionalAvailability.push({
      region,
      stockQuantity,
      lowStockLevel: lowStockLevel || 10,
      isAvailable,
      stockStatus,
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional availability added successfully",
      data: product.regionalAvailability,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addRegionalSeo = async (req, res) => {
  try {
    const { productId } = req.params;
    const { region, metaTitle, metaDescription, keywords, slug } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Remove existing SEO for this region
    product.regionalSeo = product.regionalSeo.filter(
      (s) => s.region !== region
    );

    // Add new SEO
    product.regionalSeo.push({
      region,
      metaTitle,
      metaDescription,
      keywords: Array.isArray(keywords)
        ? keywords
        : keywords
        ? keywords.split(",").map((k) => k.trim())
        : [],
      slug,
    });

    await product.save();

    res.json({
      success: true,
      message: "Regional SEO added successfully",
      data: product.regionalSeo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.addRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { relatedProducts } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate related products exist
    for (const relatedProduct of relatedProducts) {
      const exists = await Product.findOne({
        productId: relatedProduct.productId,
      });
      if (!exists) {
        return res.status(400).json({
          success: false,
          message: `Related product ${relatedProduct.productId} not found`,
        });
      }
    }

    product.relatedProducts = relatedProducts;
    await product.save();

    res.json({
      success: true,
      message: "Related products added successfully",
      data: product.relatedProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductByRegion = async (req, res) => {
  try {
    const { productId, region } = req.params;

    let product = await Product.findOne({
      productId,
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
    });

    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findOne({
        _id: productId,
        "regionalAvailability.region": region,
        "regionalAvailability.isAvailable": true,
      });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found in specified region",
      });
    }

    // Filter data for specific region
    const regionalPricing = product.regionalPricing.find(
      (p) => p.region === region
    );
    const regionalSeo = product.regionalSeo.find((s) => s.region === region);
    const regionalAvailability = product.regionalAvailability.find(
      (a) => a.region === region
    );

    const regionalData = {
      productId: product.productId,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      pricing: regionalPricing,
      seo: regionalSeo,
      availability: regionalAvailability,
      images: product.images,
      variants: product.variants,
      hasVariants: product.hasVariants,
      project: product.project,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    res.json({
      success: true,
      data: regionalData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.bulkUpdateRegionalPricing = async (req, res) => {
  try {
    const { updates } = req.body;

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const {
          productId,
          region,
          currency,
          regularPrice,
          salePrice,
          costPrice,
        } = update;

        let product = await Product.findOne({ productId });
        if (!product && mongoose.isValidObjectId(productId)) {
          product = await Product.findById(productId);
        }

        if (!product) {
          errors.push(`Product ${productId} not found`);
          continue;
        }

        // Remove existing pricing for this region
        product.regionalPricing = product.regionalPricing.filter(
          (p) => p.region !== region
        );

        // Add new pricing
        product.regionalPricing.push({
          region,
          currency,
          regularPrice,
          salePrice,
          costPrice,
          finalPrice: salePrice || regularPrice,
        });

        await product.save();
        results.push({ productId, region, status: "success" });
      } catch (error) {
        errors.push(`Failed to update ${update.productId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Bulk update completed. ${results.length} successful, ${errors.length} failed.`,
      data: {
        results,
        errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getRegionalStats = async (req, res) => {
  try {
    const { region } = req.params;

    const totalProducts = await Product.countDocuments({
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
    });

    const inStockProducts = await Product.countDocuments({
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
      "regionalAvailability.stockStatus": "in_stock",
    });

    const lowStockProducts = await Product.countDocuments({
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
      "regionalAvailability.stockStatus": "low_stock",
    });

    const outOfStockProducts = await Product.countDocuments({
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
      "regionalAvailability.stockStatus": "out_of_stock",
    });

    // Get average price for the region
    const products = await Product.find({
      "regionalAvailability.region": region,
      "regionalAvailability.isAvailable": true,
    });

    let totalPrice = 0;
    let priceCount = 0;

    products.forEach((product) => {
      const regionalPricing = product.regionalPricing.find(
        (p) => p.region === region
      );
      if (regionalPricing && regionalPricing.finalPrice) {
        totalPrice += regionalPricing.finalPrice;
        priceCount++;
      }
    });

    const averagePrice = priceCount > 0 ? totalPrice / priceCount : 0;

    res.json({
      success: true,
      data: {
        region,
        totalProducts,
        inStockProducts,
        lowStockProducts,
        outOfStockProducts,
        averagePrice: Math.round(averagePrice * 100) / 100,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.syncRegionalData = async (req, res) => {
  try {
    const { productId } = req.params;
    const { sourceRegion, targetRegions } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const sourcePricing = product.regionalPricing.find(
      (p) => p.region === sourceRegion
    );
    const sourceSeo = product.regionalSeo.find(
      (s) => s.region === sourceRegion
    );
    const sourceAvailability = product.regionalAvailability.find(
      (a) => a.region === sourceRegion
    );

    if (!sourcePricing) {
      return res.status(400).json({
        success: false,
        message: `No pricing data found for source region ${sourceRegion}`,
      });
    }

    const results = [];

    for (const targetRegion of targetRegions) {
      // Sync pricing
      product.regionalPricing = product.regionalPricing.filter(
        (p) => p.region !== targetRegion
      );
      product.regionalPricing.push({
        ...(sourcePricing.toObject ? sourcePricing.toObject() : sourcePricing),
        region: targetRegion,
      });

      // Sync SEO if exists
      if (sourceSeo) {
        product.regionalSeo = product.regionalSeo.filter(
          (s) => s.region !== targetRegion
        );
        product.regionalSeo.push({
          ...(sourceSeo.toObject ? sourceSeo.toObject() : sourceSeo),
          region: targetRegion,
        });
      }

      // Sync availability if exists
      if (sourceAvailability) {
        product.regionalAvailability = product.regionalAvailability.filter(
          (a) => a.region !== targetRegion
        );
        product.regionalAvailability.push({
          ...(sourceAvailability.toObject
            ? sourceAvailability.toObject()
            : sourceAvailability),
          region: targetRegion,
        });
      }

      results.push(targetRegion);
    }

    await product.save();

    res.json({
      success: true,
      message: `Regional data synced from ${sourceRegion} to ${results.length} regions`,
      data: {
        syncedRegions: results,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10, region = "global" } = req.query;

    const filter = { "project.projectId": projectId };

    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    const projectProducts = await Product.find({
      "project.projectId": projectId,
    });
    const regions = [
      ...new Set(
        projectProducts.flatMap((p) =>
          p.regionalAvailability.map((a) => a.region)
        )
      ),
    ];

    res.json({
      success: true,
      data: products,
      projectSummary: {
        totalProducts: total,
        regions,
        projectId,
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.searchProductsAdvanced = async (req, res) => {
  try {
    const {
      q,
      query,
      region = "global",
      category,
      brand,
      minPrice,
      maxPrice,
      inStock = false,
      hasVariants = false,
      projectId,
      page = 1,
      limit = 10,
    } = req.query;

    // Support both 'q' and 'query' parameters
    const searchQuery = q || query;

    const filter = {
      isDeleted: false,
      status: { $in: ["active", "published"] }
    };

    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { "description.short": { $regex: searchQuery, $options: "i" } },
        { "description.long": { $regex: searchQuery, $options: "i" } },
        { "regionalSeo.metaTitle": { $regex: searchQuery, $options: "i" } },
        { "regionalSeo.metaDescription": { $regex: searchQuery, $options: "i" } },
        { "regionalSeo.keywords": { $in: [new RegExp(searchQuery, "i")] } },
      ];
    }

    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    // Support hierarchical category filtering
    if (category) {
      const allCategoryIds = await getAllSubcategoryIds(category);

      const categoryFilter = {
        $or: [
          { "category.mainCategoryId": { $in: allCategoryIds } },
          { "category.subCategoryId": { $in: allCategoryIds } },
        ],
      };

      if (filter.$or) {
        // If search filter exists, use $and to combine
        filter.$and = [
          { $or: filter.$or }, // Search filter
          categoryFilter, // Category filter
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, categoryFilter);
      }
    }
    if (brand) filter.brand = brand;
    if (projectId) filter["project.projectId"] = projectId;
    if (hasVariants) filter.hasVariants = true;

    if (inStock) {
      filter["regionalAvailability.stockQuantity"] = { $gt: 0 };
    }

    if (
      (minPrice || maxPrice) &&
      region &&
      region !== "all" &&
      region !== "global"
    ) {
      filter["regionalPricing"] = {
        $elemMatch: {
          region: region,
          finalPrice: {},
        },
      };
      if (minPrice)
        filter["regionalPricing"].$elemMatch.finalPrice.$gte =
          parseFloat(minPrice);
      if (maxPrice)
        filter["regionalPricing"].$elemMatch.finalPrice.$lte =
          parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * @desc    Update product images (after S3 upload)
 * @route   PUT /api/products/:productId/images
 * @access  Admin
 */
exports.updateProductImages = async (req, res) => {
  try {
    const { productId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image file is required",
      });
    }

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Upload all files to S3
    const uploadResults = await uploadMultipleFilesToS3(
      files,
      "products/",
      800
    );

    // Format images with S3 URLs
    const formattedImages = uploadResults.map((result, index) => ({
      url: result.url,
      isPrimary: index === 0, // First image is primary
      altText: req.body.altText || product.name,
    }));

    product.images = formattedImages;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product images uploaded and updated successfully",
      data: {
        productId: product.productId,
        images: product.images,
        uploadedCount: uploadResults.length,
      },
    });
  } catch (error) {
    console.error("Error updating product images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update product variant images (after S3 upload)
 * @route   PUT /api/products/:productId/variants/:variantId/images
 * @access  Admin
 */
exports.updateVariantImages = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image file is required",
      });
    }

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find variant
    const variant = product.variants.find((v) => v.variantId === variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    // Upload all files to S3
    const uploadResults = await uploadMultipleFilesToS3(
      files,
      `products/variants/${variantId}/`,
      800
    );

    // Format images
    const formattedImages = uploadResults.map((result, index) => ({
      url: result.url,
      isPrimary: index === 0,
      altText: req.body.altText || `${product.name} - ${variant.variantId}`,
    }));

    variant.images = formattedImages;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Variant images uploaded and updated successfully",
      data: {
        productId: product.productId,
        variantId: variant.variantId,
        images: variant.images,
        uploadedCount: uploadResults.length,
      },
    });
  } catch (error) {
    console.error("Error updating variant images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update product SEO meta (after creation)
 * @route   PUT /api/products/:productId/seo
 * @access  Admin
 */
exports.updateProductSEO = async (req, res) => {
  try {
    const { productId } = req.params;
    const { metaTitle, metaDescription, keywords } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.seo = {
      metaTitle: metaTitle || product.seo?.metaTitle || product.name,
      metaDescription:
        metaDescription ||
        product.seo?.metaDescription ||
        product.description?.short ||
        "",
      keywords: keywords || product.seo?.keywords || [],
    };

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product SEO updated successfully",
      data: {
        productId: product.productId,
        seo: product.seo,
      },
    });
  } catch (error) {
    console.error("Error updating product SEO:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Update product plans (after creation)
 * @route   PUT /api/products/:productId/plans
 * @access  Admin
 */
exports.updateProductPlans = async (req, res) => {
  try {
    const { productId } = req.params;
    const { plans } = req.body;

    if (!Array.isArray(plans)) {
      return res.status(400).json({
        success: false,
        message: "Plans must be an array",
      });
    }

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate plans structure
    for (const plan of plans) {
      if (!plan.name || !plan.days || !plan.perDayAmount) {
        return res.status(400).json({
          success: false,
          message: "Each plan must have name, days, and perDayAmount",
        });
      }
    }

    product.plans = plans;
    await product.save();

    res.status(200).json({
      success: true,
      message: "Product plans updated successfully",
      data: {
        productId: product.productId,
        plans: product.plans,
      },
    });
  } catch (error) {
    console.error("Error updating product plans:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/**
 * @desc    Get product investment plans
 * @route   GET /api/products/:productId/plans
 * @access  Public
 */
exports.getProductPlans = async (req, res) => {
  try {
    const { productId } = req.params;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: {
        productId: product.productId,
        plans: product.plans || [],
      },
    });
  } catch (error) {
    console.error("Error fetching product plans:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Get all products for admin (includes deleted with indicator)
 * @route   GET /api/products/admin/all
 * @access  Admin
 */
exports.getAllProductsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status,
      region, // No default - admin sees all regions by default
      hasVariants,
      simpleOnly,
      showDeleted,
    } = req.query;

    const filter = {};

    // Show deleted products only if explicitly requested
    if (showDeleted !== "true") {
      filter.isDeleted = false;
    }

    // Variant filtering
    if (simpleOnly === "true") {
      filter.hasVariants = false;
    } else if (hasVariants === "true") {
      filter.hasVariants = true;
    } else if (hasVariants === "false") {
      filter.hasVariants = false;
    }

    // Search
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "regionalSeo.metaTitle": { $regex: search, $options: "i" } },
      ];
    }

    // Basic filters - Support hierarchical category filtering
    if (category) {
      const allCategoryIds = await getAllSubcategoryIds(category);

      const categoryFilter = {
        $or: [
          { "category.mainCategoryId": { $in: allCategoryIds } },
          { "category.subCategoryId": { $in: allCategoryIds } },
        ],
      };

      if (filter.$or) {
        // If search filter exists, use $and to combine
        filter.$and = [
          { $or: filter.$or }, // Search filter
          categoryFilter, // Category filter
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, categoryFilter);
      }
    }
    if (brand) filter.brand = brand;
    if (status) filter.status = status;

    // Region filter - ONLY apply if specific region requested
    // Admin by default sees ALL regions
    // Use ?region=india or ?region=usa to filter by specific region
    // Use ?region=all or ?region=global to explicitly see all (same as no param)
    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    // Price filter
    if (minPrice || maxPrice) {
      filter["pricing.finalPrice"] = {};
      if (minPrice) filter["pricing.finalPrice"].$gte = parseFloat(minPrice);
      if (maxPrice) filter["pricing.finalPrice"].$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
      },
      // Include applied filters for debugging
      appliedFilters: {
        region: region || "all",
        status: status || "all",
        category: category || "all",
        hasVariants: hasVariants || "all",
        showDeleted: showDeleted === "true",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Delete individual image from product
 * @route   DELETE /api/products/:productId/images/:imageIndex
 * @access  Admin
 */
exports.deleteProductImage = async (req, res) => {
  try {
    const { productId, imageIndex } = req.params;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
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

    if (!product.images || arrayIndex >= product.images.length) {
      return res.status(400).json({
        success: false,
        message: "Image index out of range",
      });
    }

    // Get the image to delete
    const imageToDelete = product.images[arrayIndex];

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
    product.images.splice(arrayIndex, 1);

    // Re-index remaining images (1-based)
    product.images.forEach((img, idx) => {
      img.order = idx + 1;
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error deleting product image:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Delete individual image from variant
 * @route   DELETE /api/products/:productId/variants/:variantId/images/:imageIndex
 * @access  Admin
 */
exports.deleteVariantImage = async (req, res) => {
  try {
    const { productId, variantId, imageIndex } = req.params;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find the variant
    const variant = product.variants.find((v) => v.variantId === variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
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

    if (!variant.images || arrayIndex >= variant.images.length) {
      return res.status(400).json({
        success: false,
        message: "Image index out of range",
      });
    }

    // Get the image to delete
    const imageToDelete = variant.images[arrayIndex];

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
    variant.images.splice(arrayIndex, 1);

    // Re-index remaining images (1-based)
    variant.images.forEach((img, idx) => {
      img.order = idx + 1;
    });

    await product.save();

    res.status(200).json({
      success: true,
      message: "Variant image deleted successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error deleting variant image:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Reorder product images
 * @route   PUT /api/products/:productId/images/reorder
 * @access  Admin
 */
exports.reorderProductImages = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageOrders } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
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
      if (arrayIndex < 0 || arrayIndex >= product.images.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid index ${item.index}. Must be between 1 and ${product.images.length}`,
        });
      }
    }

    // Update order for each image
    imageOrders.forEach((item) => {
      const arrayIndex = item.index - 1;
      product.images[arrayIndex].order = item.order;
    });

    // Sort images by order
    product.images.sort((a, b) => a.order - b.order);

    await product.save();

    res.status(200).json({
      success: true,
      message: "Images reordered successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error reordering product images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getProductsByCategoryId = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // 🔥 THIS IS THE CRITICAL FIX
    const filter = {
      "category.mainCategoryIdCategoryId": categoryId, // ← CHANGED FROM 'category.mainCategoryId'
    };

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Reorder variant images
 * @route   PUT /api/products/:productId/variants/:variantId/images/reorder
 * @access  Admin
 */
exports.reorderVariantImages = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { imageOrders } = req.body;

    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find the variant
    const variant = product.variants.find((v) => v.variantId === variantId);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
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
      if (arrayIndex < 0 || arrayIndex >= variant.images.length) {
        return res.status(400).json({
          success: false,
          message: `Invalid index ${item.index}. Must be between 1 and ${variant.images.length}`,
        });
      }
    }

    // Update order for each image
    imageOrders.forEach((item) => {
      const arrayIndex = item.index - 1;
      variant.images[arrayIndex].order = item.order;
    });

    // Sort images by order
    variant.images.sort((a, b) => a.order - b.order);

    await product.save();

    res.status(200).json({
      success: true,
      message: "Variant images reordered successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error reordering variant images:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * @desc    Export products to CSV or Excel
 * @route   GET /api/products/export?format=excel&status=published
 * @access  Admin
 */
exports.exportProducts = async (req, res) => {
  try {
    const {
      format = "excel",
      status,
      category,
      region,
      brand,
      hasVariants,
      search,
    } = req.query;

    // Build filter (same as existing response format)
    const filter = { isDeleted: false };

    if (status) filter.status = status;
    if (category) filter["category.mainCategoryId"] = category;
    if (brand) filter.brand = brand;

    if (hasVariants === "true") {
      filter.hasVariants = true;
    } else if (hasVariants === "false") {
      filter.hasVariants = false;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (region && region !== "all" && region !== "global") {
      filter["regionalAvailability.region"] = region;
      filter["regionalAvailability.isAvailable"] = true;
    }

    if (format === "csv") {
      // Export as CSV
      const csvData = await exportProductsToCSV(filter);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="products-${Date.now()}.csv"`
      );
      res.send(csvData);
    } else {
      // Export as Excel (default)
      const workbook = await exportProductsToExcel(filter);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="products-${Date.now()}.xlsx"`
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
 * @desc    Hard delete product (permanently removes from database)
 * @route   DELETE /api/products/:productId/hard
 * @access  Admin
 */
exports.hardDeleteProduct = async (req, res) => {
  try {
    const id = req.params.productId;
    const { confirmDelete } = req.query;

    // Safety check - require explicit confirmation
    if (confirmDelete !== "true") {
      return res.status(400).json({
        success: false,
        message:
          "Hard delete requires confirmDelete=true query parameter for safety",
      });
    }

    let product = await Product.findOne({ productId: id });
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findById(id);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete all images from S3 if they exist
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        if (image.url) {
          try {
            await deleteImageFromS3(image.url);
          } catch (error) {
            console.error("Error deleting product image from S3:", error);
            // Continue deletion even if S3 delete fails
          }
        }
      }
    }

    // Delete variant images from S3 if they exist
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.images && variant.images.length > 0) {
          for (const image of variant.images) {
            if (image.url) {
              try {
                await deleteImageFromS3(image.url);
              } catch (error) {
                console.error("Error deleting variant image from S3:", error);
                // Continue deletion even if S3 delete fails
              }
            }
          }
        }
      }
    }

    const deletedProduct = {
      id: product._id,
      productId: product.productId,
      name: product.name,
      sku: product.sku,
    };

    // Permanently delete the product
    if (product.productId === id) {
      await Product.deleteOne({ productId: id });
    } else {
      await Product.findByIdAndDelete(id);
    }

    res.json({
      success: true,
      message: "Product permanently deleted from database",
      deletedProduct,
    });
  } catch (error) {
    console.error("Error hard deleting product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
