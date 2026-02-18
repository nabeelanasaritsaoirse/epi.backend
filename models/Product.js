const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: String,
  isPrimary: Boolean,
  altText: String,
  order: {
    type: Number,
    default: 1,
  },
});

const installmentSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  minDownPayment: {
    type: Number,
    min: 0,
  },
  maxDownPayment: {
    type: Number,
    min: 0,
  },
  minPaymentAmount: {
    type: Number,
    min: 0,
  },
  maxPaymentAmount: {
    type: Number,
    min: 0,
  },
  minInstallmentDays: {
    type: Number,
    min: 1,
  },
  maxInstallmentDays: {
    type: Number,
    min: 1,
  },
  interestRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
});

const referralBonusSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  type: {
    type: String,
    enum: ["percentage", "fixed"],
    default: "percentage",
  },
  value: {
    type: Number,
    min: 0,
  },
  minPurchaseAmount: {
    type: Number,
    min: 0,
    default: 0,
  },
});

const variantSchema = new mongoose.Schema({
  variantId: { type: String, required: true },
  sku: { type: String, required: true },
  attributes: {
    size: String,
    color: String,
    material: String,
  },
  // Optional human-readable description for the variant
  description: {
    short: { type: String },
    long: { type: String },
  },
  // Pricing for the variant
  price: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  // Variant-level installment/payment plan (optional)
  paymentPlan: installmentSchema,
  // Stock & images
  stock: { type: Number, default: 0, min: 0 },
  images: [imageSchema],
  isActive: { type: Boolean, default: true },
});

// FIXED: Remove required: true from finalPrice
// FIXED: Remove required: true from finalPrice
const regionalPricingSchema = new mongoose.Schema({
  region: { type: String, required: true },
  currency: { type: String, default: "USD" },
  regularPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },
  finalPrice: { type: Number, min: 0 },
});

const regionalSeoSchema = new mongoose.Schema({
  region: { type: String, required: true },
  metaTitle: String,
  metaDescription: String,
  keywords: [String],
  slug: String,
});

const regionalAvailabilitySchema = new mongoose.Schema({
  region: { type: String, required: true },
  stockQuantity: { type: Number, default: 0, min: 0 },
  lowStockLevel: { type: Number, default: 10, min: 0 },
  isAvailable: { type: Boolean, default: true },
  stockStatus: {
    type: String,
    enum: ["in_stock", "out_of_stock", "low_stock", "pre_order"],
    default: "in_stock",
  },
});

const relatedProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  relationType: {
    type: String,
    enum: ["cross_sell", "up_sell", "complementary", "similar"],
    required: true,
  },
});

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
  },
  variantId: {
    type: String,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    short: { type: String, required: true },
    long: String,
    features: [String],
    specifications: mongoose.Schema.Types.Mixed,
  },
  category: {
    mainCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    mainCategoryName: { type: String, required: true },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategoryName: String,
  },
  brand: { type: String, required: true },
  sku: { type: String, unique: true, sparse: true },

  // Enhanced Availability
  availability: {
    isAvailable: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0, min: 0 },
    lowStockLevel: { type: Number, default: 10, min: 0 },
    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock", "low_stock", "pre_order"],
      default: "in_stock",
    },
  },

  pricing: {
    regularPrice: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    finalPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    currency: { type: String, default: "USD" },
  },

  isGlobalProduct: {
    type: Boolean,
    default: true,
  },

  regionalPricing: [regionalPricingSchema],

  regionalSeo: [regionalSeoSchema],

  regionalAvailability: [regionalAvailabilitySchema],

  relatedProducts: [relatedProductSchema],

  paymentPlan: installmentSchema,

  // Admin-created investment plans for this product
  plans: [
    {
      name: { type: String, required: true }, // e.g., "Quick Plan", "Standard Plan"
      days: { type: Number, required: true, min: 1 }, // Total days to complete
      perDayAmount: { type: Number, required: true, min: 0 }, // Daily payment amount
      totalAmount: { type: Number }, // Auto-calculated: days * perDayAmount
      isRecommended: { type: Boolean, default: false }, // Mark one plan as recommended
      description: { type: String }, // Optional description
    },
  ],

  origin: {
    country: String,
    manufacturer: String,
  },

  referralBonus: referralBonusSchema,

  variants: [variantSchema],
  hasVariants: { type: Boolean, default: false },

  images: [imageSchema],

  project: {
    projectId: String,
    projectName: String,
  },

  dimensions: {
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },

  warranty: {
    period: { type: Number, min: 0 },
    returnPolicy: { type: Number, min: 0 },
  },

  // Review Statistics (denormalized for performance)
  reviewStats: {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },

    // Aspect-wise average ratings
    aspectRatings: {
      quality: { type: Number, default: 0, min: 0, max: 5 },
      valueForMoney: { type: Number, default: 0, min: 0, max: 5 },
      delivery: { type: Number, default: 0, min: 0, max: 5 },
      accuracy: { type: Number, default: 0, min: 0, max: 5 },
    },

    // Rating distribution (count per star)
    ratingDistribution: {
      5: { type: Number, default: 0, min: 0 },
      4: { type: Number, default: 0, min: 0 },
      3: { type: Number, default: 0, min: 0 },
      2: { type: Number, default: 0, min: 0 },
      1: { type: Number, default: 0, min: 0 },
    },

    // Last updated timestamp
    lastUpdated: { type: Date },
  },

  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
  },

  status: {
    type: String,
    enum: ["draft", "published", "archived", "active"],
    default: "draft",
  },

  // Simple product categorization
  isFeatured: { type: Boolean, default: false },
  isPopular: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  isTrending: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  createdByEmail: {
    type: String,
    required: function () {
      return this.isNew;
    },
    index: true,
  },

  updatedByEmail: {
    type: String,
    index: true,
  },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedByEmail: { type: String, index: true },

  restoredByEmail: {
    type: String,
    index: true,
  },

  restoredAt: {
    type: Date,
  },
});

productSchema.pre("save", function (next) {
  // Skip heavy logic for deletes/restores
  if (this.isModified("isDeleted")) {
    this.updatedAt = Date.now();
    return next();
  }

  this.updatedAt = Date.now();

  // plans
  if (this.plans && this.plans.length > 0) {
    this.plans.forEach((plan) => {
      if (plan.days && plan.perDayAmount) {
        plan.totalAmount = plan.days * plan.perDayAmount;
      }
    });
  }

  // regional pricing
  if (this.regionalPricing && this.regionalPricing.length > 0) {
    this.regionalPricing.forEach((pricing) => {
      if (!pricing.finalPrice) {
        pricing.finalPrice =
          pricing.salePrice && pricing.salePrice > 0
            ? pricing.salePrice
            : pricing.regularPrice;
      }
    });
  }

  // regional availability
  if (this.regionalAvailability && this.regionalAvailability.length > 0) {
    this.regionalAvailability.forEach((availability) => {
      if (!availability.stockStatus) {
        if (availability.stockQuantity <= 0) {
          availability.stockStatus = "out_of_stock";
        } else if (availability.stockQuantity <= availability.lowStockLevel) {
          availability.stockStatus = "low_stock";
        } else {
          availability.stockStatus = "in_stock";
        }
      }
    });
  }

  // pricing
  if (this.pricing && !this.pricing.finalPrice) {
    this.pricing.finalPrice =
      this.pricing.salePrice && this.pricing.salePrice > 0
        ? this.pricing.salePrice
        : this.pricing.regularPrice;
  }

  // availability
  if (this.availability && !this.availability.stockStatus) {
    if (this.availability.stockQuantity <= 0) {
      this.availability.stockStatus = "out_of_stock";
    } else if (
      this.availability.stockQuantity <= this.availability.lowStockLevel
    ) {
      this.availability.stockStatus = "low_stock";
    } else {
      this.availability.stockStatus = "in_stock";
    }
  }

  next();
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================

// Index for country-based filtering (CRITICAL for performance)
productSchema.index({
  "regionalAvailability.region": 1,
  "regionalAvailability.isAvailable": 1,
});

// Compound index for common queries
productSchema.index({
  status: 1,
  isDeleted: 1,
  createdAt: -1,
});

// Index for category filtering
productSchema.index({
  "category.mainCategoryId": 1,
});

// Index for search functionality
productSchema.index({
  name: "text",
  description: "text",
  "regionalSeo.metaTitle": "text",
});

const Product = mongoose.model("Product", productSchema);

// ============================================
// AUTO-UPDATE CATEGORY PRODUCT COUNT
// ============================================

// Helper function to update category product count
async function updateCategoryProductCount(categoryId) {
  try {
    const Category = require("./Category");

    // Count only active/published products that are not deleted
    const count = await Product.countDocuments({
      "category.mainCategoryId": categoryId,
      isDeleted: false,
      status: { $in: ["published", "active"] },
    });

    await Category.findByIdAndUpdate(categoryId, {
      productCount: count,
    });
  } catch (error) {
    console.error("Error updating category product count:", error);
  }
}

// Update category count after product is saved
productSchema.post("save", async function (doc) {
  try {
    if (doc.category && doc.category.mainCategoryId) {
      await updateCategoryProductCount(doc.category.mainCategoryId);
    }

    // Sync featured lists when product is saved
    const FeaturedList = require("./FeaturedList");
    await FeaturedList.syncProductInAllLists(doc.productId);
  } catch (error) {
    console.error("Error in post-save hook:", error);
  }
});

// Update category count after product is deleted
productSchema.post("findOneAndUpdate", async function (doc) {
  try {
    if (doc && doc.category && doc.category.mainCategoryId) {
      await updateCategoryProductCount(doc.category.mainCategoryId);
    }

    // Sync featured lists when product is updated
    if (doc) {
      const FeaturedList = require("./FeaturedList");
      await FeaturedList.syncProductInAllLists(doc.productId);
    }
  } catch (error) {
    console.error("Error in post-update hook:", error);
  }
});

// Update category count after product is removed
productSchema.post("findOneAndDelete", async function (doc) {
  try {
    if (doc && doc.category && doc.category.mainCategoryId) {
      await updateCategoryProductCount(doc.category.mainCategoryId);
    }

    // Remove product from all featured lists when deleted
    if (doc) {
      const FeaturedList = require("./FeaturedList");
      await FeaturedList.syncProductInAllLists(doc.productId);
    }
  } catch (error) {
    console.error("Error in post-delete hook:", error);
  }
});

module.exports = Product;
