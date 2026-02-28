"use strict";

/**
 * Seller Controller
 * Handles all seller-facing operations:
 *   - Profile management
 *   - Product CRUD (scoped to own products)
 *   - Order management (view + fulfillment updates)
 *   - Dashboard statistics
 *
 * All routes in this controller are protected by verifyToken + isSeller.
 * Sellers can only access resources they own (sellerId === req.user._id).
 */

const mongoose = require("mongoose");
const Product          = require("../models/Product");
const InstallmentOrder = require("../models/InstallmentOrder");
const User             = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");
const Category         = require("../models/Category");
const { AppError }     = require("../utils/customErrors");
const { sendPushNotification } = require("../services/fcmService");

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised error handler for seller controller.
 * Matches the same pattern as handleProductError in productController.
 */
function handleSellerError(error, res, context = "") {
  const tag = context ? `[sellerController:${context}]` : "[sellerController]";
  console.error(`Seller error ${tag}:`, {
    name:    error.name,
    message: error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });

  if (error instanceof mongoose.Error.ValidationError) {
    const fields = Object.values(error.errors).map((e) => ({
      field:   e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors:  fields,
      code:    "VALIDATION_ERROR",
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field '${error.path}': ${error.value}`,
      code:    "CAST_ERROR",
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `Duplicate value for '${field}'`,
      code:    "DUPLICATE_KEY",
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code:    error.code || "APP_ERROR",
    });
  }

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred. Please try again later."
        : error.message,
    code: "INTERNAL_ERROR",
  });
}

/**
 * Verify a product belongs to the requesting seller.
 * Returns the product document or throws AppError.
 * @param {string} productId  - custom productId or MongoDB _id
 * @param {string} sellerId   - req.user._id.toString()
 * @returns {Promise<import('../models/Product').default>}
 */
async function findOwnProduct(productId, sellerId) {
  let product = await Product.findOne({
    productId,
    isDeleted: false,
  });
  if (!product && mongoose.isValidObjectId(productId)) {
    product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });
  }
  if (!product) {
    throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
  }
  if (!product.sellerId || product.sellerId.toString() !== sellerId) {
    throw new AppError(
      "You do not have permission to access this product",
      403,
      "FORBIDDEN",
    );
  }
  return product;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc  Get seller's own profile (account + sellerProfile stats)
 * @route GET /api/seller/profile
 * @access Seller
 */
exports.getProfile = async (req, res) => {
  try {
    const seller = await User.findById(req.user._id).select(
      "name email phoneNumber profilePicture role isActive sellerProfile wallet createdAt",
    );

    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found" });
    }

    return res.json({ success: true, data: seller });
  } catch (error) {
    return handleSellerError(error, res, "getProfile");
  }
};

/**
 * @desc  Update seller's store profile (name, description, image)
 * @route PUT /api/seller/profile
 * @access Seller
 */
exports.updateProfile = async (req, res) => {
  try {
    const ALLOWED_PROFILE_FIELDS = [
      "storeName",
      "storeDescription",
      "storeImage",
      "gstNumber",
      "panNumber",
    ];

    // Only pick allowed sellerProfile fields — never let client update
    // computed fields like totalSales, totalRevenue, rating, isVerified, etc.
    const updates = {};
    ALLOWED_PROFILE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        const val = typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
        updates[`sellerProfile.${field}`] = val || null;
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updatable fields provided",
        code:    "NO_FIELDS",
      });
    }

    const seller = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true, select: "name email sellerProfile" },
    );

    return res.json({
      success: true,
      message: "Profile updated",
      data:    seller,
    });
  } catch (error) {
    return handleSellerError(error, res, "updateProfile");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc  Seller dashboard — aggregated KPIs
 * @route GET /api/seller/dashboard
 * @access Seller
 */
exports.getDashboard = async (req, res) => {
  try {
    const sellerId = req.user._id;

    const [
      totalProducts,
      pendingApproval,
      publishedProducts,
      rejectedProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      seller,
    ] = await Promise.all([
      Product.countDocuments({ sellerId, isDeleted: false }),
      Product.countDocuments({ sellerId, isDeleted: false, listingStatus: "pending_approval" }),
      Product.countDocuments({ sellerId, isDeleted: false, listingStatus: "published" }),
      Product.countDocuments({ sellerId, isDeleted: false, listingStatus: "rejected" }),
      InstallmentOrder.countDocuments({ sellerId }),
      InstallmentOrder.countDocuments({ sellerId, sellerFulfillmentStatus: "pending" }),
      InstallmentOrder.countDocuments({ sellerId, sellerFulfillmentStatus: "confirmed" }),
      InstallmentOrder.countDocuments({ sellerId, sellerFulfillmentStatus: "shipped" }),
      User.findById(sellerId).select("sellerProfile wallet"),
    ]);

    return res.json({
      success: true,
      data: {
        products: {
          total:          totalProducts,
          pendingApproval,
          published:      publishedProducts,
          rejected:       rejectedProducts,
        },
        orders: {
          total:      totalOrders,
          pending:    pendingOrders,
          confirmed:  confirmedOrders,
          shipped:    shippedOrders,
        },
        revenue: {
          totalRevenue:  seller?.sellerProfile?.totalRevenue  || 0,
          totalSales:    seller?.sellerProfile?.totalSales    || 0,
          walletBalance: seller?.wallet?.balance              || 0,
        },
        rating: {
          average: seller?.sellerProfile?.rating      || 0,
          count:   seller?.sellerProfile?.ratingCount || 0,
        },
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "getDashboard");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Fields the client must never set on a seller product */
const SELLER_PRODUCT_BLOCKED_FIELDS = [
  "isDeleted", "deletedAt", "deletedByEmail",
  "restoredAt", "restoredByEmail",
  "createdByEmail", "updatedByEmail",
  "reviewStats",
  // Listing lifecycle — managed via admin /listing-status endpoint
  "listingStatus", "listingRejectionReason", "listingReviewedBy", "listingReviewedAt",
  // Ownership — always set from req.user server-side
  "sellerId", "sellerInfo",
];

/**
 * @desc  List seller's own products with optional filters
 * @route GET /api/seller/products
 * @access Seller
 */
exports.getProducts = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = { sellerId, isDeleted: false };

    // Optional filters
    if (req.query.listingStatus) {
      const validStatuses = ["draft", "pending_approval", "published", "rejected", "archived"];
      if (!validStatuses.includes(req.query.listingStatus)) {
        return res.status(400).json({
          success: false,
          message: `listingStatus must be one of: ${validStatuses.join(", ")}`,
          code:    "INVALID_FILTER",
        });
      }
      filter.listingStatus = req.query.listingStatus;
    }

    if (req.query.search) {
      filter.$or = [
        { name:        { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("productId name pricing availability listingStatus listingRejectionReason images hasVariants createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "getProducts");
  }
};

/**
 * @desc  Create a new product (assigned to this seller, pending admin approval)
 * @route POST /api/seller/products
 * @access Seller
 */
exports.createProduct = async (req, res) => {
  try {
    // Block server-managed fields
    SELLER_PRODUCT_BLOCKED_FIELDS.forEach((f) => { delete req.body[f]; });

    // Seller must have a verified store name
    const seller = await User.findById(req.user._id).select("sellerProfile");
    if (!seller?.sellerProfile?.storeName) {
      return res.status(400).json({
        success: false,
        message: "Please complete your seller profile (storeName is required) before listing products",
        code:    "INCOMPLETE_SELLER_PROFILE",
      });
    }

    // ── Server-generated IDs ──────────────────────────────────────────────────
    const timestamp = Date.now().toString().slice(-6);
    const random    = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    if (!req.body.productId) {
      req.body.productId = `PROD${timestamp}${random}`;
    }

    // ── Product-level pricing guard ───────────────────────────────────────────
    const rp = req.body.pricing?.regularPrice;
    const sp = req.body.pricing?.salePrice;

    // At least one price must be present and positive
    const effectivePrice = rp ?? sp;
    if (effectivePrice == null || Number(effectivePrice) <= 0) {
      return res.status(400).json({
        success: false,
        message: "pricing.regularPrice is required and must be greater than 0",
        code:    "PRICE_REQUIRED",
      });
    }

    if (sp != null && rp != null && Number(sp) >= Number(rp)) {
      return res.status(400).json({
        success: false,
        message: `Sale price (${sp}) must be less than regular price (${rp})`,
        field:   "pricing.salePrice",
        code:    "INVALID_PRICE",
      });
    }

    // ── Variant normalization (same rules as admin createProduct) ─────────────
    let normalizedVariants = [];
    const hasVariants = !!req.body.hasVariants;
    if (hasVariants) {
      if (!Array.isArray(req.body.variants) || req.body.variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "variants array is required when hasVariants is true",
          code:    "VARIANTS_REQUIRED",
        });
      }

      const seenVariantKeys = new Set();
      normalizedVariants = req.body.variants.map((v, idx) => {
        const vTs  = Date.now().toString().slice(-6);
        const vRnd = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        const variantId = v.variantId || `VAR${vTs}${vRnd}${idx.toString().padStart(2, "0")}`;
        const skuBase   = req.body.sku || req.body.productId;
        const sku       = v.sku || `${skuBase}-V${idx + 1}-${variantId.slice(-4)}`;

        const price = Number(v.price);
        if (v.price === undefined || v.price === null || isNaN(price) || price < 0) {
          throw new AppError(
            `Variant at index ${idx} must have a valid price >= 0`,
            400,
            "VARIANT_PRICE_REQUIRED",
          );
        }

        const salePrice = v.salePrice != null ? Number(v.salePrice) : undefined;
        if (salePrice != null && salePrice >= price) {
          throw new AppError(
            `Variant at index ${idx}: salePrice must be less than price`,
            400,
            "VARIANT_SALE_PRICE_INVALID",
          );
        }

        const attrs  = Array.isArray(v.attributes) ? v.attributes : [];
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

        return {
          variantId,
          sku,
          attributes: attrs,
          description: v.description || {},
          price,
          salePrice,
          stock:    Math.max(0, Number(v.stock) || 0),
          images:   Array.isArray(v.images) ? v.images : [],
          isActive: v.isActive !== undefined ? !!v.isActive : true,
        };
      });
    }

    // ── Resolve commission rate: seller override → category → platform default ─
    let commissionRate = seller.sellerProfile.commissionRate;   // null = inherit
    if (commissionRate == null && req.body.category?.mainCategoryId) {
      const cat = await Category.findById(req.body.category.mainCategoryId)
        .select("commissionRate")
        .lean();
      commissionRate = cat?.commissionRate ?? 15;
    }
    if (commissionRate == null) commissionRate = 15; // platform fallback

    // ── Assemble product document ─────────────────────────────────────────────
    const productData = {
      ...req.body,

      // Force seller fields — never trust client
      sellerId: req.user._id,
      sellerInfo: {
        storeName:  seller.sellerProfile.storeName,
        rating:     seller.sellerProfile.rating    || 0,
        isVerified: seller.sellerProfile.isVerified || false,
      },

      // Seller products always start in pending_approval, not published
      listingStatus: req.body.isDraft ? "draft" : "pending_approval",

      // Keep commission on the product for order-time reference
      sellerCommissionRate: commissionRate,

      availability: {
        isAvailable:   true,
        stockQuantity: 0,
        lowStockLevel: 10,
        stockStatus:   "in_stock",
        ...req.body.availability,
      },
      pricing: {
        currency:   "INR",
        finalPrice: req.body.pricing?.salePrice || req.body.pricing?.regularPrice || 0,
        ...req.body.pricing,
      },
      hasVariants,
      ...(hasVariants && { variants: normalizedVariants }),

      createdByEmail: req.user.email,
      updatedByEmail: req.user.email,
      createdAt:      new Date(),
      updatedAt:      new Date(),
    };

    // Remove isDraft from document (not a schema field)
    delete productData.isDraft;

    const product = new Product(productData);
    await product.save();

    // Increment seller's product count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { "sellerProfile.totalProducts": 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Product submitted for admin approval",
      data: {
        productId:     product.productId,
        listingStatus: product.listingStatus,
        name:          product.name,
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "createProduct");
  }
};

/**
 * @desc  Update seller's own product (ownership enforced)
 *        If the product was published, editing it resets to pending_approval
 *        so admin must re-review before changes go live.
 * @route PUT /api/seller/products/:productId
 * @access Seller
 */
exports.updateProduct = async (req, res) => {
  try {
    SELLER_PRODUCT_BLOCKED_FIELDS.forEach((f) => { delete req.body[f]; });

    const product = await findOwnProduct(req.params.productId, req.user._id.toString());

    // Cannot edit a live product without re-triggering approval
    const wasPublished = product.listingStatus === "published";

    // Whitelist of updatable product fields for seller
    const SELLER_UPDATABLE_FIELDS = [
      "name", "description", "brand",
      "pricing", "availability",
      "images", "tags", "condition",
      "plans", "taxInfo",
      "seo", "status",
    ];

    SELLER_UPDATABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    // Pricing guard
    if (req.body.pricing) {
      const rp = Number(product.pricing?.regularPrice);
      const sp = product.pricing?.salePrice != null ? Number(product.pricing.salePrice) : null;
      if (sp != null && !isNaN(rp) && sp >= rp) {
        return res.status(400).json({
          success: false,
          message: "Sale price must be less than regular price",
          code:    "INVALID_PRICE",
        });
      }
    }

    // Editing a live listing resets it to pending_approval for admin re-review
    if (wasPublished) {
      product.listingStatus = "pending_approval";
    }

    product.updatedByEmail = req.user.email;
    await product.save();

    return res.json({
      success: true,
      message: wasPublished
        ? "Product updated and re-submitted for approval"
        : "Product updated",
      data: {
        productId:     product.productId,
        listingStatus: product.listingStatus,
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "updateProduct");
  }
};

/**
 * @desc  Soft-delete seller's own product.
 *        Published products cannot be deleted directly — seller must first
 *        archive (set listingStatus = "archived") via updateProduct.
 * @route DELETE /api/seller/products/:productId
 * @access Seller
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await findOwnProduct(req.params.productId, req.user._id.toString());

    if (product.listingStatus === "published") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a published product. Archive it first by setting listingStatus to 'archived'.",
        code:    "CANNOT_DELETE_PUBLISHED",
      });
    }

    product.isDeleted      = true;
    product.deletedAt      = new Date();
    product.deletedByEmail = req.user.email;
    await product.save();

    // Decrement seller product count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { "sellerProfile.totalProducts": -1 },
    });

    return res.json({
      success: true,
      message: "Product deleted",
    });
  } catch (error) {
    return handleSellerError(error, res, "deleteProduct");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Valid fulfillment status transitions a seller is allowed to make */
const SELLER_FULFILLMENT_TRANSITIONS = {
  pending:   ["confirmed"],
  confirmed: ["packed"],
  packed:    ["shipped"],
};

/**
 * @desc  List orders for this seller's products
 * @route GET /api/seller/orders
 * @access Seller
 */
exports.getOrders = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = { sellerId };

    // Optional fulfillment status filter
    if (req.query.fulfillmentStatus) {
      const validStatuses = ["pending", "confirmed", "packed", "shipped", "delivered", "not_applicable"];
      if (!validStatuses.includes(req.query.fulfillmentStatus)) {
        return res.status(400).json({
          success: false,
          message: `fulfillmentStatus must be one of: ${validStatuses.join(", ")}`,
          code:    "INVALID_FILTER",
        });
      }
      filter.sellerFulfillmentStatus = req.query.fulfillmentStatus;
    }

    const [orders, total] = await Promise.all([
      InstallmentOrder.find(filter)
        .select(
          "orderId user product productName quantity pricePerUnit totalProductPrice " +
          "sellerFulfillmentStatus sellerNotes sellerFulfilledAt " +
          "deliveryStatus createdAt updatedAt variantDetails",
        )
        .populate("user", "name email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InstallmentOrder.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "getOrders");
  }
};

/**
 * @desc  Get full detail of a single order (ownership enforced)
 * @route GET /api/seller/orders/:orderId
 * @access Seller
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await InstallmentOrder.findOne({
      orderId:  req.params.orderId,
      sellerId: req.user._id,
    })
      .populate("user",    "name email phoneNumber addresses")
      .populate("product", "productId name images pricing")
      .lean();

    if (!order) {
      // Return 404 whether order doesn't exist OR belongs to another seller —
      // never reveal that the order exists at all
      return res.status(404).json({
        success: false,
        message: "Order not found",
        code:    "ORDER_NOT_FOUND",
      });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    return handleSellerError(error, res, "getOrderById");
  }
};

/**
 * @desc  Update fulfillment status for an order (ownership enforced).
 *        Valid transitions: pending → confirmed → packed → shipped
 *        "delivered" is set by the admin/system on final delivery confirmation.
 * @route PATCH /api/seller/orders/:orderId/fulfillment
 * @access Seller
 */
exports.updateFulfillment = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
        code:    "STATUS_REQUIRED",
      });
    }

    const order = await InstallmentOrder.findOne({
      orderId:  req.params.orderId,
      sellerId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
        code:    "ORDER_NOT_FOUND",
      });
    }

    // Guard: only specific transitions are allowed
    const currentStatus = order.sellerFulfillmentStatus;
    const allowedNext   = SELLER_FULFILLMENT_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot transition from '${currentStatus}' to '${status}'. Allowed next statuses: ${allowedNext.join(", ") || "none"}`,
        code:    "INVALID_STATUS_TRANSITION",
      });
    }

    order.sellerFulfillmentStatus = status;
    if (notes !== undefined) {
      order.sellerNotes = String(notes).trim().slice(0, 500);
    }
    if (status === "shipped") {
      order.sellerFulfilledAt = new Date();
    }

    await order.save();

    // Best-effort push notification to buyer on key status changes
    try {
      const messages = {
        confirmed: { title: "Order Confirmed", body: `Your order ${order.orderId} has been confirmed by the seller.` },
        packed:    { title: "Order Packed",    body: `Your order ${order.orderId} has been packed and is ready to ship.` },
        shipped:   { title: "Order Shipped",   body: `Your order ${order.orderId} is on its way to you!` },
      };
      if (messages[status]) {
        await sendPushNotification([order.user], {
          ...messages[status],
          data: { type: "order_fulfillment", orderId: order.orderId, status },
        });
      }
    } catch (notifErr) {
      console.error("[updateFulfillment] Push notification failed:", notifErr.message);
    }

    return res.json({
      success: true,
      message: `Order status updated to '${status}'`,
      data: {
        orderId:               order.orderId,
        sellerFulfillmentStatus: order.sellerFulfillmentStatus,
        sellerFulfilledAt:     order.sellerFulfilledAt,
      },
    });
  } catch (error) {
    return handleSellerError(error, res, "updateFulfillment");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SELLER EARNING (canonical implementation lives in services/sellerService.js)
// ─────────────────────────────────────────────────────────────────────────────

const { creditSellerEarning: _creditSellerEarning } = require("../services/sellerService");

/**
 * Credit seller's wallet after order delivery is confirmed.
 * Delegates to sellerService.creditSellerEarning — the single source of truth.
 *
 * @param {Object} order - InstallmentOrder document
 * @returns {Promise<void>}
 */
exports.creditSellerEarning = _creditSellerEarning;
