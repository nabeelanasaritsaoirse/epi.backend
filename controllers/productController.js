const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const {
  uploadMultipleFilesToS3,
  deleteImageFromS3,
  deleteMultipleImagesFromS3,
} = require("../services/awsUploadService");
const {
  exportProductsToExcel,
  exportProductsToCSV,
} = require("../services/exportService");
const { AppError } = require("../utils/customErrors");

/**
 * Centralized product controller error handler.
 * - Handles Mongoose ValidationError → 400 with per-field messages
 * - Handles Mongoose CastError (bad ObjectId) → 400
 * - Handles MongoDB duplicate key (11000) → 409 with the conflicting field name
 * - Handles explicit AppError (operational) → uses its statusCode
 * - Default → 500, never leaks internal details in production
 *
 * @param {Error} error
 * @param {import('express').Response} res
 * @param {string} [context] - caller name for server-side logs
 */
function handleProductError(error, res, context = "") {
  const tag = context ? `[${context}]` : "[productController]";
  console.error(`Product error ${tag}:`, {
    name: error.name,
    message: error.message,
    code: error.code || null,
  });

  // Mongoose schema validation failures (maxlength, minlength, required, enum, custom)
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Mongoose CastError — invalid ObjectId or wrong type for a field
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value provided for '${error.path}'`,
    });
  }

  // MongoDB duplicate key — identify the exact conflicting field
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    const fieldLabels = {
      productId: "Product ID",
      variantId: "Variant ID",
      sku: "SKU",
    };
    const label = fieldLabels[field] || field;
    return res.status(409).json({
      success: false,
      message: `A product with this ${label} already exists`,
      field,
    });
  }

  // Explicit operational errors thrown via AppError (e.g. variant validation)
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Unknown / unexpected errors — never expose internals in production
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred. Please try again later."
        : error.message,
  });
}

/**
 * Helper function to recursively get all subcategory IDs
 * @param {String} categoryId - The category ID to get subcategories for
 * @returns {Promise<string[]>} - Array of all category IDs (including the parent)
 */
async function getAllSubcategoryIds(categoryId) {
  try {
    // Validate if it's a valid ObjectId
    if (!mongoose.isValidObjectId(categoryId)) {
      return [categoryId];
    }

    const category =
      await Category.findById(categoryId).select("subCategories");

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
        childIds.filter((id) => id.toString() !== categoryId.toString()),
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
    // ── Strip fields that must never come from the client ─────────────────────
    // These are server-managed: audit trail, soft-delete, stats
    const BLOCKED_FIELDS = [
      "isDeleted", "deletedAt", "deletedByEmail",
      "restoredAt", "restoredByEmail",
      "createdByEmail", "updatedByEmail",
      "reviewStats",
      // Seller ownership — assigned server-side only
      "sellerId", "sellerInfo",
      // Listing lifecycle — managed via /listing-status endpoint
      "listingRejectionReason", "listingReviewedBy", "listingReviewedAt",
    ];
    BLOCKED_FIELDS.forEach((f) => { delete req.body[f]; });

    // ── Server-generated IDs (never trust client for these) ───────────────────
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");

    // Allow admin to pass an explicit productId; fall back to auto-gen
    if (!req.body.productId) {
      req.body.productId = `PROD${timestamp}${random}`;
    }
    if (!req.body.variantId) {
      req.body.variantId = `VAR${timestamp}${random}00`;
    }

    // ── Product-level pricing guard ───────────────────────────────────────────
    const rp = req.body.pricing?.regularPrice;
    const sp = req.body.pricing?.salePrice;
    if (sp != null && rp != null && Number(sp) >= Number(rp)) {
      return res.status(400).json({
        success: false,
        message: `Sale price (${sp}) must be less than regular price (${rp})`,
        field: "pricing.salePrice",
      });
    }

    // ── Auto-calculate finalPrice for regional pricing rows ───────────────────
    if (Array.isArray(req.body.regionalPricing)) {
      req.body.regionalPricing = req.body.regionalPricing.map((pricing) => ({
        ...pricing,
        finalPrice:
          pricing.salePrice != null && pricing.salePrice > 0
            ? pricing.salePrice
            : pricing.regularPrice,
      }));
    }

    // ── Auto-derive stockStatus for regional availability rows ────────────────
    if (Array.isArray(req.body.regionalAvailability)) {
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
        }),
      );
    }

    // ── Assemble productData with safe defaults ───────────────────────────────
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
        currency: "INR",
        finalPrice:
          req.body.pricing?.salePrice || req.body.pricing?.regularPrice || 0,
        ...req.body.pricing,
      },

      // Global products have no region-specific rows
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

      // Always set server-side
      createdByEmail: req.user.email,
      updatedByEmail: req.user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // ── Variant normalization ─────────────────────────────────────────────────
    productData.hasVariants = !!req.body.hasVariants;
    if (productData.hasVariants) {
      if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "variants array is required when hasVariants is true",
        });
      }

      const seenVariantKeys = new Set();

      const normalizedVariants = req.body.variants.map((v, idx) => {
        const vTimestamp = Date.now().toString().slice(-6);
        const vRandom = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        const variantId =
          v.variantId ||
          `VAR${vTimestamp}${vRandom}${idx.toString().padStart(2, "0")}`;

        const skuBase =
          req.body.sku || req.body.productId || `PROD${vTimestamp}`;
        const sku = v.sku || `${skuBase}-V${idx + 1}-${variantId.slice(-4)}`;

        // Price must be present and non-negative
        const price = Number(v.price);
        if (v.price === undefined || v.price === null || isNaN(price) || price < 0) {
          throw new AppError(
            `Variant at index ${idx} must have a valid price >= 0`,
            400,
            "VARIANT_PRICE_REQUIRED",
          );
        }

        // salePrice < price
        const salePrice = v.salePrice != null ? Number(v.salePrice) : undefined;
        if (salePrice != null && salePrice >= price) {
          throw new AppError(
            `Variant at index ${idx}: salePrice must be less than price`,
            400,
            "VARIANT_SALE_PRICE_INVALID",
          );
        }

        // Duplicate attribute-combination guard
        const attrs = Array.isArray(v.attributes) ? v.attributes : [];
        const attrKey = attrs.length
          ? attrs.slice().sort((a, b) => a.name.localeCompare(b.name))
              .map((a) => `${a.name}:${a.value}`).join("|")
          : "";
        if (attrKey && seenVariantKeys.has(attrKey)) {
          throw new AppError(
            `Duplicate variant combination '${attrKey}' at index ${idx}`,
            400,
            "DUPLICATE_VARIANT",
          );
        }
        if (attrKey) seenVariantKeys.add(attrKey);

        const stock = v.stock !== undefined ? Math.max(0, Number(v.stock) || 0) : 0;

        return {
          variantId,
          sku,
          attributes: attrs,
          description: v.description || {},
          price,
          salePrice,
          paymentPlan: v.paymentPlan || {},
          stock,
          images: Array.isArray(v.images) ? v.images : [],
          isActive: v.isActive !== undefined ? !!v.isActive : true,
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
    return handleProductError(error, res, "createProduct");
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const {
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

    // Sanitize pagination — positive integers, hard cap on limit to prevent DoS
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter = {};

    // ===============================
    // ADMIN OVERRIDE (OPTION D FIX)
    // ===============================
    const isAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "super_admin");

    if (!isAdmin) {
      // Public users only see non-deleted, published products
      filter.isDeleted = false;
      filter.listingStatus = "published";
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
    // VARIANT ATTRIBUTE FILTER
    // ?attr[Color]=Red&attr[Size]=L
    // ===============================
    if (req.query.attr && typeof req.query.attr === "object") {
      const attrFilters = Object.entries(req.query.attr);
      if (attrFilters.length > 0) {
        filter.variants = {
          $elemMatch: {
            isActive: true,
            attributes: {
              $all: attrFilters.map(([name, value]) => ({
                $elemMatch: { name, value },
              })),
            },
          },
        };
      }
    }

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
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    });
  } catch (error) {
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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

    // Non-admin callers must only see published, non-deleted products
    const callerIsAdmin =
      req.user &&
      (req.user.role === "admin" || req.user.role === "super_admin");
    if (
      !callerIsAdmin &&
      (product.isDeleted || product.listingStatus !== "published")
    ) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Compute price range from active variants (e.g. "₹299 – ₹349" for Flutter card)
    let priceRange = null;
    if (product.hasVariants && product.variants?.length > 0) {
      const activePrices = product.variants
        .filter((v) => v.isActive)
        .map((v) => (v.salePrice != null ? v.salePrice : v.price))
        .filter((p) => typeof p === "number");
      if (activePrices.length > 0) {
        priceRange = {
          min: Math.min(...activePrices),
          max: Math.max(...activePrices),
          currency: product.pricing?.currency || "INR",
        };
      }
    }

    res.json({
      success: true,
      data: product,
      priceRange,
    });
  } catch (error) {
    return handleProductError(error, res);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.productId;

    // Strip audit / soft-delete fields that must never come from client
    const BLOCKED_FIELDS = [
      "isDeleted", "deletedAt", "deletedByEmail",
      "restoredAt", "restoredByEmail",
      "createdByEmail", "updatedByEmail",
      "reviewStats", "createdAt",
    ];
    BLOCKED_FIELDS.forEach((f) => { delete req.body[f]; });

    let product = await Product.findOne({ productId: id });
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findById(id);
    }

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Validate pricing.salePrice < regularPrice before touching the document
    if (req.body.pricing) {
      const newRegular =
        req.body.pricing.regularPrice ?? product.pricing?.regularPrice;
      const newSale = req.body.pricing.salePrice;
      if (newSale != null && newRegular != null && Number(newSale) >= Number(newRegular)) {
        return res.status(400).json({
          success: false,
          message: `Sale price (${newSale}) must be less than regular price (${newRegular})`,
          field: "pricing.salePrice",
        });
      }
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
          (ev) => ev.variantId === v.variantId,
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

        const price = Number(v.price);
        if (v.price === undefined || v.price === null || isNaN(price) || price < 0) {
          throw new AppError(
            `Variant at index ${idx} must have a valid price >= 0`,
            400,
            "VARIANT_PRICE_REQUIRED",
          );
        }

        const salePrice = v.salePrice !== undefined
          ? (v.salePrice != null ? Number(v.salePrice) : null)
          : existingVariant?.salePrice;

        if (salePrice != null && salePrice >= price) {
          throw new AppError(
            `Variant at index ${idx}: salePrice must be less than price`,
            400,
            "VARIANT_SALE_PRICE_INVALID",
          );
        }

        const stock = v.stock !== undefined
          ? Math.max(0, Number(v.stock) || 0)
          : (existingVariant?.stock ?? 0);

        updatedVariants.push({
          variantId,
          sku,

          attributes:
            v.attributes !== undefined
              ? v.attributes
              : existingVariant?.attributes || [],

          description:
            v.description !== undefined
              ? v.description
              : existingVariant?.description || {},

          price,
          salePrice,

          paymentPlan:
            v.paymentPlan !== undefined
              ? v.paymentPlan
              : existingVariant?.paymentPlan || {},

          stock,

          // IMAGE PRESERVATION — only override if explicitly sent
          images:
            v.images !== undefined ? v.images : existingVariant?.images || [],

          isActive:
            v.isActive !== undefined
              ? !!v.isActive
              : (existingVariant?.isActive ?? true),
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
      // New catalog fields
      "slug",
      "tags",
      "condition",
      "taxInfo",
      "weightUnit",
      "dimensionUnit",
      "warrantyUnit",
      "images",
      "category",
      "defaultVariantId",
      // Listing visibility (admin can override directly; use /listing-status for approval flow)
      "listingStatus",
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
          (r) => r.region === "global",
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
    return handleProductError(error, res, "updateProduct");
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
      },
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { region = "global" } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    // Get all subcategory IDs recursively (includes parent + all children)
    const allCategoryIds = await getAllSubcategoryIds(category);

    // Support hierarchical category filtering
    const filter = {
      isDeleted: false,
      listingStatus: "published",   // Only serve approved listings to buyers
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
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    return handleProductError(error, res);
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const { region = "global" } = req.query;

    const filter = {
      isDeleted: false,
      listingStatus: "published",
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
    return handleProductError(error, res);
  }
};

exports.getProductsByRegion = async (req, res) => {
  try {
    const { region } = req.params;
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      status,
    } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    // Build filter object
    const filter = {
      isDeleted: false,
      listingStatus: "published",
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
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return handleProductError(error, res);
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
      (p) => p.region !== region,
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
    return handleProductError(error, res);
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
      (a) => a.region !== region,
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
    return handleProductError(error, res);
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
      (s) => s.region !== region,
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
      (p) => p.region === region,
    );
    const regionalSeo = product.regionalSeo.find((s) => s.region === region);
    const regionalAvailability = product.regionalAvailability.find(
      (a) => a.region === region,
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
    return handleProductError(error, res);
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
          (p) => p.region !== region,
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
        console.error(
          `[bulkUpdateRegionalPricing] Failed for product ${update.productId}:`,
          { name: error.name, message: error.message, code: error.code || null }
        );
        errors.push({
          productId: update.productId,
          reason:
            error.name === "ValidationError"
              ? Object.values(error.errors)
                  .map((e) => e.message)
                  .join("; ")
              : "Failed to update regional pricing",
        });
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
    return handleProductError(error, res);
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
        (p) => p.region === region,
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
    return handleProductError(error, res);
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
      (p) => p.region === sourceRegion,
    );
    const sourceSeo = product.regionalSeo.find(
      (s) => s.region === sourceRegion,
    );
    const sourceAvailability = product.regionalAvailability.find(
      (a) => a.region === sourceRegion,
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
        (p) => p.region !== targetRegion,
      );
      product.regionalPricing.push({
        ...(sourcePricing.toObject ? sourcePricing.toObject() : sourcePricing),
        region: targetRegion,
      });

      // Sync SEO if exists
      if (sourceSeo) {
        product.regionalSeo = product.regionalSeo.filter(
          (s) => s.region !== targetRegion,
        );
        product.regionalSeo.push({
          ...(sourceSeo.toObject ? sourceSeo.toObject() : sourceSeo),
          region: targetRegion,
        });
      }

      // Sync availability if exists
      if (sourceAvailability) {
        product.regionalAvailability = product.regionalAvailability.filter(
          (a) => a.region !== targetRegion,
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
    return handleProductError(error, res);
  }
};

exports.getProductsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { region = "global" } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const filter = {
      isDeleted: false,
      listingStatus: "published",
      "project.projectId": projectId,
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

    const projectProducts = await Product.find({
      isDeleted: false, // 🔥 FIX: Hide deleted products from users
      "project.projectId": projectId,
    });
    const regions = [
      ...new Set(
        projectProducts.flatMap((p) =>
          p.regionalAvailability.map((a) => a.region),
        ),
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
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    return handleProductError(error, res);
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
    } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    // Support both 'q' and 'query' parameters
    const searchQuery = q || query;

    const filter = {
      isDeleted: false,
      listingStatus: "published",   // Filter by listing approval status, not product status
    };

    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: "i" } },
        { "description.short": { $regex: searchQuery, $options: "i" } },
        { "description.long": { $regex: searchQuery, $options: "i" } },
        { "regionalSeo.metaTitle": { $regex: searchQuery, $options: "i" } },
        {
          "regionalSeo.metaDescription": { $regex: searchQuery, $options: "i" },
        },
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
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return handleProductError(error, res);
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
      800,
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
    return handleProductError(error, res);
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
      800,
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 10)); // Admin gets a higher cap (200)

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
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(filter);
    // Global stats (NOT paginated)
    const allMatchingProducts = await Product.find(filter).select(
      "status hasVariants availability.stockQuantity",
    );

    let totalPublished = 0;
    let totalWithVariants = 0;
    let totalStock = 0;

    for (const p of allMatchingProducts) {
      if (p.status === "published") totalPublished++;
      if (p.hasVariants) totalWithVariants++;
      totalStock += p.availability?.stockQuantity || 0;
    }

    res.json({
      success: true,
      data: products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
      stats: {
        totalProducts: total,
        totalPublished,
        totalWithVariants,
        totalStock,
      },
      appliedFilters: {
        region: region || "all",
        status: status || "all",
        category: category || "all",
        hasVariants: hasVariants || "all",
        showDeleted: showDeleted === "true",
      },
    });
  } catch (error) {
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
  }
};

exports.getProductsByCategoryId = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    const filter = {
      isDeleted: false,
      listingStatus: "published",
      "category.mainCategoryId": categoryId,
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
    return handleProductError(error, res);
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
    return handleProductError(error, res);
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
        `attachment; filename="products-${Date.now()}.csv"`,
      );
      res.send(csvData);
    } else {
      // Export as Excel (default)
      const workbook = await exportProductsToExcel(filter);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="products-${Date.now()}.xlsx"`,
      );

      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    console.error("Export error:", error);
    return handleProductError(error, res);
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
    return handleProductError(error, res);
  }
};

// ============================================================
// VARIANT MATRIX
// ============================================================

const { generateVariantMatrix } = require("../utils/variantMatrixUtils");

/**
 * @desc  Preview the full cartesian-product variant matrix for a product.
 *        Reads the product's category attributeSchema, merges with existing
 *        variants, and returns the proposed list WITHOUT saving.
 *        The admin reviews it in the Flutter UI and POSTs back to confirm.
 * @route POST /api/products/:productId/generate-variant-matrix
 * @access Admin
 */
exports.generateVariantMatrix = async (req, res) => {
  try {
    const { productId } = req.params;

    // Find product
    let product = await Product.findOne({ productId });
    if (!product && mongoose.isValidObjectId(productId)) {
      product = await Product.findById(productId);
    }
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Load category to get its attributeSchema
    const category = await Category.findById(
      product.category?.mainCategoryId
    ).select("attributeSchema name");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Product's category not found — cannot build variant matrix",
      });
    }

    if (!category.attributeSchema || category.attributeSchema.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Category '${category.name}' has no attributeSchema defined. Add attributes to the category first.`,
      });
    }

    const result = generateVariantMatrix(
      category.attributeSchema,
      product.variants || []
    );

    return res.json({
      success: true,
      message: `Matrix preview: ${result.combinationCount} combinations (${result.newCombinations} new, ${result.preservedCombinations} preserved). POST back with save=true to apply.`,
      data: {
        productId: product.productId,
        categoryName: category.name,
        ...result,
      },
    });
  } catch (error) {
    return handleProductError(error, res, "generateVariantMatrix");
  }
};

// ============================================================
// VARIANT CRUD — per-combination price, stock, and images
// ============================================================

/**
 * Helper: find a product by productId string (falls back to _id).
 * Returns null if not found.
 */
async function findProductById(id) {
  let product = await Product.findOne({ productId: id });
  if (!product && mongoose.isValidObjectId(id)) {
    product = await Product.findById(id);
  }
  return product;
}

/**
 * Compute the price range from a product's active variants.
 * Returns { min, max, currency } or null if no active variants.
 */
function computePriceRange(product) {
  if (!product.hasVariants || !product.variants?.length) return null;
  const activePrices = product.variants
    .filter((v) => v.isActive)
    .map((v) => (v.salePrice != null ? v.salePrice : v.price))
    .filter((p) => typeof p === "number");
  if (activePrices.length === 0) return null;
  return {
    min: Math.min(...activePrices),
    max: Math.max(...activePrices),
    currency: product.pricing?.currency || "INR",
  };
}

/**
 * @desc  Save the confirmed variant matrix after the admin fills in prices in Flutter.
 *        Merges with existing variants: existing images are preserved, prices/stock
 *        overwritten. New skeleton variants (variantId=null) get IDs auto-generated.
 * @route POST /api/products/:productId/apply-variant-matrix
 * @access Admin
 */
exports.applyVariantMatrix = async (req, res) => {
  try {
    const { productId } = req.params;
    const incoming = req.body.variants;

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({
        success: false,
        message: "variants array is required and must not be empty",
      });
    }

    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Build lookup map of existing variants keyed by variantId
    const existingByVariantId = new Map();
    for (const v of product.variants || []) {
      existingByVariantId.set(v.variantId, v);
    }

    const mergedVariants = [];
    const seenAttributeKeys = new Set();

    for (let idx = 0; idx < incoming.length; idx++) {
      const v = incoming[idx];

      // ── Price validation ────────────────────────────────────────────────────
      const price = Number(v.price);
      if (v.price === undefined || v.price === null || isNaN(price) || price < 0) {
        throw new AppError(
          `Variant at index ${idx} must have a valid price >= 0`,
          400,
          "VARIANT_PRICE_REQUIRED"
        );
      }

      // ── salePrice validation ────────────────────────────────────────────────
      const salePrice =
        v.salePrice != null ? Number(v.salePrice) : null;
      if (salePrice != null && (isNaN(salePrice) || salePrice < 0)) {
        throw new AppError(
          `Variant at index ${idx}: salePrice must be a number >= 0`,
          400,
          "VARIANT_SALE_PRICE_INVALID"
        );
      }
      if (salePrice != null && salePrice >= price) {
        throw new AppError(
          `Variant at index ${idx}: salePrice must be less than price`,
          400,
          "VARIANT_SALE_PRICE_INVALID"
        );
      }

      // ── Stock validation ────────────────────────────────────────────────────
      const stock = v.stock != null ? Math.max(0, Number(v.stock) || 0) : 0;

      // ── Attributes validation ───────────────────────────────────────────────
      const attributes = Array.isArray(v.attributes) ? v.attributes : [];
      for (const attr of attributes) {
        if (
          !attr ||
          typeof attr.name !== "string" ||
          !attr.name.trim() ||
          typeof attr.value !== "string" ||
          !attr.value.trim()
        ) {
          throw new AppError(
            `Variant at index ${idx}: each attribute must have a non-empty name and value`,
            400,
            "VARIANT_ATTRIBUTE_INVALID"
          );
        }
      }

      // ── Generate IDs for new skeleton variants ──────────────────────────────
      const isNew = !v.variantId;
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      const variantId =
        v.variantId || `VAR${timestamp}${random}${idx.toString().padStart(2, "0")}`;

      const skuBase = product.sku || product.productId;
      const sku = v.sku || `${skuBase}-V${idx + 1}-${variantId.slice(-4)}`;

      // ── Compute attributeKey for dedup (pre-save hook will recompute on save) ─
      const attributeKey =
        attributes.length > 0
          ? attributes
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((a) => `${a.name}:${a.value}`)
              .join("|")
          : "";

      // ── Duplicate-combination guard ─────────────────────────────────────────
      if (attributeKey && seenAttributeKeys.has(attributeKey)) {
        throw new AppError(
          `Duplicate variant combination '${attributeKey}' at index ${idx}`,
          400,
          "DUPLICATE_VARIANT"
        );
      }
      if (attributeKey) seenAttributeKeys.add(attributeKey);

      // ── Merge: preserve images for existing combos, start empty for new ones ─
      const existing = existingByVariantId.get(v.variantId);

      mergedVariants.push({
        variantId,
        sku,
        attributes,
        attributeKey,
        description: v.description ?? existing?.description ?? {},
        price,
        salePrice,
        paymentPlan: v.paymentPlan ?? existing?.paymentPlan ?? {},
        stock,
        images: isNew ? [] : (existing?.images || []),
        isActive: v.isActive ?? existing?.isActive ?? false,
      });
    }

    product.variants = mergedVariants;
    product.hasVariants = mergedVariants.length > 0;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Variant matrix saved: ${mergedVariants.length} variant(s)`,
      data: {
        productId: product.productId,
        variantCount: mergedVariants.length,
        priceRange: computePriceRange(product),
        variants: product.variants,
      },
    });
  } catch (error) {
    return handleProductError(error, res, "applyVariantMatrix");
  }
};

/**
 * @desc  Update a single variant's price, salePrice, stock, or isActive.
 *        Images are managed via the dedicated image endpoints — NOT touched here.
 * @route PATCH /api/products/:productId/variants/:variantId
 * @access Admin
 */
exports.updateVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const variant = product.variants.find((v) => v.variantId === variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // Apply only fields that are explicitly present in the request body.
    // Images are managed via dedicated image endpoints — never touched here.

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (isNaN(price) || price < 0) {
        throw new AppError("price must be a number >= 0", 400, "VARIANT_PRICE_INVALID");
      }
      variant.price = price;
    }

    if (req.body.salePrice !== undefined) {
      // Passing null explicitly removes the discount
      if (req.body.salePrice === null) {
        variant.salePrice = null;
      } else {
        const salePrice = Number(req.body.salePrice);
        const effectivePrice =
          req.body.price !== undefined ? Number(req.body.price) : variant.price;
        if (isNaN(salePrice) || salePrice < 0) {
          throw new AppError(
            "salePrice must be a number >= 0 (or null to remove it)",
            400,
            "VARIANT_SALE_PRICE_INVALID"
          );
        }
        if (salePrice >= effectivePrice) {
          throw new AppError(
            `salePrice (${salePrice}) must be less than price (${effectivePrice})`,
            400,
            "VARIANT_SALE_PRICE_INVALID"
          );
        }
        variant.salePrice = salePrice;
      }
    }

    if (req.body.stock !== undefined) {
      const stock = Number(req.body.stock);
      if (isNaN(stock) || stock < 0) {
        throw new AppError("stock must be a number >= 0", 400, "VARIANT_STOCK_INVALID");
      }
      variant.stock = stock;
    }

    if (req.body.isActive !== undefined) {
      variant.isActive = !!req.body.isActive;
    }

    if (req.body.sku !== undefined && req.body.sku !== null) {
      variant.sku = String(req.body.sku).trim();
    }

    if (req.body.description !== undefined) {
      variant.description = req.body.description;
    }

    product.updatedAt = new Date();
    product.updatedByEmail = req.user?.email;
    await product.save();

    return res.json({
      success: true,
      message: "Variant updated successfully",
      data: { variant },
    });
  } catch (error) {
    return handleProductError(error, res, "updateVariant");
  }
};

/**
 * @desc  List all variants for a product with a priceRange summary at the top.
 *        Variants are returned sorted: active first, then alphabetically by attributeKey.
 * @route GET /api/products/:productId/variants
 * @access Public
 */
exports.getProductVariants = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await findProductById(productId);
    if (!product || product.isDeleted || product.listingStatus !== "published") {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Sort: active variants first, then alphabetically by attributeKey
    const sortedVariants = [...(product.variants || [])].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return (a.attributeKey || "").localeCompare(b.attributeKey || "");
    });

    const activeCount = sortedVariants.filter((v) => v.isActive).length;

    return res.json({
      success: true,
      data: {
        productId: product.productId,
        productName: product.name,
        priceRange: computePriceRange(product),
        totalVariants: sortedVariants.length,
        activeVariants: activeCount,
        variants: sortedVariants,
      },
    });
  } catch (error) {
    return handleProductError(error, res, "getProductVariants");
  }
};

/**
 * @desc  Get full detail of a single variant (price, images, stock, attributes).
 * @route GET /api/products/:productId/variants/:variantId
 * @access Public
 */
exports.getVariantById = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await findProductById(productId);
    if (!product || product.isDeleted || product.listingStatus !== "published") {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const variant = product.variants.find((v) => v.variantId === variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    return res.json({
      success: true,
      data: {
        variant,
        productId: product.productId,
        productName: product.name,
      },
    });
  } catch (error) {
    return handleProductError(error, res, "getVariantById");
  }
};

/**
 * @desc  Remove a single variant and delete its S3 images.
 *        If this was the last variant, sets hasVariants=false on the product.
 * @route DELETE /api/products/:productId/variants/:variantId
 * @access Admin
 */
exports.deleteVariant = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const product = await findProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const variantIndex = product.variants.findIndex(
      (v) => v.variantId === variantId
    );
    if (variantIndex === -1) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    const variant = product.variants[variantIndex];

    // Delete variant images from S3 — log failures but never block DB deletion
    const imageUrls = (variant.images || []).map((img) => img.url).filter(Boolean);
    if (imageUrls.length > 0) {
      try {
        await deleteMultipleImagesFromS3(imageUrls);
      } catch (s3Err) {
        console.error(
          `[deleteVariant] S3 cleanup failed for variant ${variantId} (proceeding with DB delete):`,
          { message: s3Err.message }
        );
      }
    }

    product.variants.splice(variantIndex, 1);

    if (product.variants.length === 0) {
      product.hasVariants = false;
    }

    product.updatedAt = new Date();
    product.updatedByEmail = req.user?.email;
    await product.save();

    return res.json({
      success: true,
      message: `Variant ${variantId} deleted`,
      data: {
        remainingVariants: product.variants.length,
        hasVariants: product.hasVariants,
      },
    });
  } catch (error) {
    return handleProductError(error, res, "deleteVariant");
  }
};

// ============================================================
// EXCHANGE RATE SYNC (Admin)
// ============================================================

const ExchangeRateService = require("../services/exchangeRateService");
const { syncProductRegionalPrices } = require("../jobs/syncExchangeRates");

/**
 * @desc  Force-refresh exchange rates and recalculate non-overridden
 *        regional prices across all products.
 * @route POST /api/products/sync-exchange-rates
 * @access Admin
 */
exports.syncExchangeRates = async (_req, res) => {
  try {
    await ExchangeRateService.refreshRates();
    await syncProductRegionalPrices();
    const info = ExchangeRateService.getCacheInfo();

    return res.json({
      success: true,
      message: "Exchange rates refreshed and regional prices recalculated",
      data: info,
    });
  } catch (error) {
    return handleProductError(error, res, "syncExchangeRates");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SELLER LISTING APPROVAL
// ─────────────────────────────────────────────────────────────────────────────

const { sendPushNotification } = require("../services/fcmService");

/**
 * @desc  Admin approves or rejects a seller's product listing.
 *        On approval   → listingStatus = "published"
 *        On rejection  → listingStatus = "rejected" + reason stored
 *        Push notification is sent to the seller in both cases.
 * @route PATCH /api/products/:productId/listing-status
 * @access Admin
 */
exports.updateListingStatus = async (req, res) => {
  try {
    const { action, reason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'approve' or 'reject'",
        code: "INVALID_ACTION",
      });
    }

    if (action === "reject" && (!reason || !String(reason).trim())) {
      return res.status(400).json({
        success: false,
        message: "reason is required when rejecting a product",
        code: "REASON_REQUIRED",
      });
    }

    // Find product
    const id = req.params.productId;
    let product = await Product.findOne({ productId: id, isDeleted: false });
    if (!product && mongoose.isValidObjectId(id)) {
      product = await Product.findOne({ _id: id, isDeleted: false });
    }
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Only seller-submitted products should go through this approval flow
    if (!product.sellerId) {
      return res.status(400).json({
        success: false,
        message: "This product is platform-owned and does not require listing approval",
        code: "NOT_SELLER_PRODUCT",
      });
    }

    // Enforce valid source states for approval actions
    const approveableStatuses = ["pending_approval", "rejected"];
    const rejectableStatuses  = ["pending_approval", "published"];

    if (action === "approve" && !approveableStatuses.includes(product.listingStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot approve a product with status '${product.listingStatus}'`,
        code: "INVALID_STATUS_TRANSITION",
      });
    }
    if (action === "reject" && !rejectableStatuses.includes(product.listingStatus)) {
      return res.status(409).json({
        success: false,
        message: `Cannot reject a product with status '${product.listingStatus}'`,
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    // Apply state transition
    if (action === "approve") {
      product.listingStatus           = "published";
      product.listingRejectionReason  = null;
    } else {
      product.listingStatus           = "rejected";
      product.listingRejectionReason  = String(reason).trim();
    }

    product.listingReviewedBy  = req.user._id;
    product.listingReviewedAt  = new Date();
    product.updatedByEmail     = req.user.email;

    await product.save();

    // ── Push notification to seller (best-effort — never fail the request) ────
    try {
      const notifPayload =
        action === "approve"
          ? {
              title: "Product Approved!",
              body: `Your product "${product.name}" is now live on the platform.`,
              data: { type: "product_approved", productId: product.productId },
            }
          : {
              title: "Product Rejected",
              body: `Your product "${product.name}" was not approved. Reason: ${reason}`,
              data: { type: "product_rejected", productId: product.productId, reason },
            };

      await sendPushNotification([product.sellerId], notifPayload);
    } catch (notifErr) {
      // Log but do not fail — notification failure is non-critical
      console.error("[updateListingStatus] Push notification failed:", notifErr.message);
    }

    return res.json({
      success: true,
      message:
        action === "approve"
          ? "Product approved and published"
          : "Product rejected",
      data: {
        productId:     product.productId,
        listingStatus: product.listingStatus,
        reviewedBy:    req.user.email,
        reviewedAt:    product.listingReviewedAt,
        ...(action === "reject" && { rejectionReason: product.listingRejectionReason }),
      },
    });
  } catch (error) {
    return handleProductError(error, res, "updateListingStatus");
  }
};
