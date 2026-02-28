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
  // Extensible key-value pairs driven by category.attributeSchema
  // e.g. [{name:"Color",value:"Red"},{name:"Size",value:"L"}]
  attributes: [
    {
      name: { type: String, required: true },
      value: { type: String, required: true },
    },
  ],
  // Computed: "Color:Red|Size:L" — sorted alphabetically, auto-built in pre-save
  // Used for duplicate detection and indexed filtering
  attributeKey: { type: String, default: "" },
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

const regionalPricingSchema = new mongoose.Schema({
  region: { type: String, required: true },
  currency: { type: String, default: "INR" },
  regularPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },
  finalPrice: { type: Number, min: 0 },
  // false = auto-converted from base price via ExchangeRateService
  // true  = seller has manually pinned a specific price for this region
  isManualOverride: { type: Boolean, default: false },
  lastSyncedAt: { type: Date },
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
    required: [true, "Product name is required"],
    trim: true,
    minlength: [2, "Product name must be at least 2 characters"],
    maxlength: [200, "Product name cannot exceed 200 characters"],
  },
  description: {
    short: {
      type: String,
      required: [true, "Short description is required"],
      minlength: [10, "Short description must be at least 10 characters"],
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    long: String,
    features: [String],
    // Structured key-value specs — queryable and filterable (replaces Mixed)
    // e.g. [{key:"RAM", value:"8", unit:"GB"}, {key:"Display", value:"6.5", unit:"inches"}]
    specifications: [
      {
        key: { type: String },
        value: { type: String },
        unit: { type: String },
      },
    ],
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

  // URL-friendly identifier — auto-generated from name on create if not provided
  slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

  // Product condition — essential for multi-seller / refurbished listings
  condition: {
    type: String,
    enum: ["new", "refurbished", "used", "pre-owned"],
    default: "new",
  },

  // Internal search + display tags (separate from SEO keywords)
  tags: [{ type: String, lowercase: true, trim: true }],

  // Indian GST compliance — required for valid tax invoices
  taxInfo: {
    hsnCode: { type: String, trim: true },      // 6–8 digit HSN code
    gstRate: {                                   // Indian GST slab
      type: Number,
      enum: [0, 5, 12, 18, 28],
    },
  },

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
    currency: { type: String, default: "INR" },
    // Canonical currency all prices are stored in before conversion
    baseCurrency: { type: String, default: "INR" },
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
  // Which variant is shown by default on the product card (e.g. cheapest or most popular)
  defaultVariantId: { type: String, default: null },

  images: [imageSchema],

  project: {
    projectId: String,
    projectName: String,
  },

  dimensions: {
    weight: { type: Number, min: 0 },
    weightUnit: { type: String, enum: ["g", "kg", "lb", "oz"], default: "kg" },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    dimensionUnit: { type: String, enum: ["cm", "in", "mm"], default: "cm" },
  },

  warranty: {
    period: { type: Number, min: 0 },
    warrantyUnit: {
      type: String,
      enum: ["days", "months", "years"],
      default: "months",
    },
    returnPolicy: { type: Number, min: 0 }, // number of days
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

  // ── Seller Ownership ────────────────────────────────────────────────────
  // null = platform-owned product (created by admin, always published)
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },
  // Denormalised seller snapshot — avoids populate on every product read
  sellerInfo: {
    storeName:  { type: String, default: null },
    rating:     { type: Number, default: null, min: 0, max: 5 },
    isVerified: { type: Boolean, default: false },
  },

  // ── Listing Status (controls visibility) ────────────────────────────────
  // Admin products default to "published" (zero breaking change).
  // Seller products are forced to "pending_approval" by the controller.
  listingStatus: {
    type: String,
    enum: ["draft", "pending_approval", "published", "rejected", "archived"],
    default: "published",
    index: true,
  },
  listingRejectionReason: { type: String, default: null },
  listingReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  listingReviewedAt: { type: Date, default: null },

  status: {
    type: String,
    enum: ["draft", "published", "archived"],
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

  // ── Slug: auto-generate from name if not set ──────────────────────────────
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")   // strip non-alphanumeric except hyphens
      .replace(/[\s_]+/g, "-")    // spaces/underscores → hyphens
      .replace(/^-+|-+$/g, "");   // trim leading/trailing hyphens
  }

  // ── Sale price guard: salePrice must be strictly less than regularPrice ─────
  if (
    this.pricing &&
    this.pricing.salePrice != null &&
    this.pricing.regularPrice != null &&
    this.pricing.salePrice >= this.pricing.regularPrice
  ) {
    const validationError = new mongoose.Error.ValidationError(this);
    validationError.errors["pricing.salePrice"] =
      new mongoose.Error.ValidatorError({
        message: `Sale price (${this.pricing.salePrice}) must be less than regular price (${this.pricing.regularPrice})`,
        path: "pricing.salePrice",
        value: this.pricing.salePrice,
      });
    return next(validationError);
  }

  // ── attributeKey: compute sorted key for each variant ────────────────────
  if (this.variants && this.variants.length > 0) {
    this.variants.forEach((variant) => {
      if (Array.isArray(variant.attributes) && variant.attributes.length > 0) {
        variant.attributeKey = variant.attributes
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((a) => `${a.name}:${a.value}`)
          .join("|");
      } else {
        variant.attributeKey = "";
      }
    });
  }

  // plans
  if (this.plans && this.plans.length > 0) {
    this.plans.forEach((plan) => {
      if (plan.days && plan.perDayAmount) {
        plan.totalAmount = plan.days * plan.perDayAmount;
      }
    });
  }

  // regional pricing — always recompute finalPrice
  if (this.regionalPricing && this.regionalPricing.length > 0) {
    this.regionalPricing.forEach((pricing) => {
      pricing.finalPrice =
        pricing.salePrice != null && pricing.salePrice > 0
          ? pricing.salePrice
          : pricing.regularPrice;
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

  // pricing — always recompute finalPrice so it stays in sync when sale ends
  if (this.pricing) {
    this.pricing.finalPrice =
      this.pricing.salePrice != null && this.pricing.salePrice > 0
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
// Homepage feature queries — partial indexes (only index docs where the flag is true, saves RAM)
productSchema.index(
  { isFeatured: 1, status: 1, isDeleted: 1 },
  { partialFilterExpression: { isFeatured: true, isDeleted: false } }
);
productSchema.index(
  { isPopular: 1, status: 1, isDeleted: 1 },
  { partialFilterExpression: { isPopular: true, isDeleted: false } }
);
productSchema.index(
  { isBestSeller: 1, status: 1, isDeleted: 1 },
  { partialFilterExpression: { isBestSeller: true, isDeleted: false } }
);
// Price range filtering
productSchema.index({ "pricing.finalPrice": 1, status: 1, isDeleted: 1 });
// Brand filtering
productSchema.index({ brand: 1, status: 1, isDeleted: 1 });

// Slug lookup
productSchema.index({ slug: 1, isDeleted: 1 });

// Tags search
productSchema.index({ tags: 1 });

// Variant attribute filtering: ?attr[Color]=Red&attr[Size]=L
productSchema.index({ "variants.attributes.name": 1, "variants.attributes.value": 1 });
productSchema.index({ "variants.attributeKey": 1 });

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
