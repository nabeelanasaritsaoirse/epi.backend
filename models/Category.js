const mongoose = require("mongoose");

/* --------------------------------
   COMMON IMAGE OBJECT
-----------------------------------*/
const imageObjectSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["main", "illustration", "subcategory", "mobile", "icon", "banner"],
    },
    url: { type: String, required: true },
    altText: { type: String, default: "" },
    order: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* --------------------------------
   CATEGORY SCHEMA
-----------------------------------*/
const categorySchema = new mongoose.Schema({
  categoryId: { type: String, unique: true, required: true },

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  slug: { type: String, lowercase: true, trim: true },

  /* 🔒 SINGLE IMAGES */
  mainImage: { type: imageObjectSchema, default: null },
  illustrationImage: { type: imageObjectSchema, default: null },
  subcategoryImage: { type: imageObjectSchema, default: null },
  mobileImage: { type: imageObjectSchema, default: null },
  iconImage: { type: imageObjectSchema, default: null },

  /* 🖼️ BANNER IMAGES */
  bannerImages: {
    type: [imageObjectSchema],
    default: [],
  },

  /* ⚠️ OLD SCHEMA FIELDS - For backward compatibility */
  image: {
    url: String,
    altText: String,
  },
  images: [
    {
      url: String,
      altText: String,
      order: { type: Number, default: 1 },
    },
  ],
  banner: {
    url: String,
    altText: String,
    link: String,
  },
  icon: String,

  parentCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },

  subCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

  level: { type: Number, default: 0 },
  path: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

  productCount: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  showInMenu: { type: Boolean, default: true },

  displayOrder: { type: Number, default: 0 },

  meta: {
    title: String,
    description: String,
    keywords: [String],
  },

  // ── Multi-seller fields ──────────────────────────────────────────────────
  // Seller commission rate for products in this category (percentage 0–100)
  commissionRate: { type: Number, min: 0, max: 100, default: 0 },

  // Restrict category to verified sellers / age-verified users
  isRestricted: { type: Boolean, default: false },

  // ── Variant attribute schema ─────────────────────────────────────────────
  // Defines which filterable attributes products in this category can have.
  // The Flutter product creation form reads this to build the variant builder.
  // e.g. for "Smartphones": [{name:"Color",type:"color_swatch",options:["Black","White"]},
  //                           {name:"RAM",type:"text",options:["4GB","8GB","12GB"]},
  //                           {name:"Storage",type:"text",options:["128GB","256GB"]}]
  attributeSchema: [
    {
      name: { type: String, required: true },        // "Color", "Size", "RAM"
      type: {
        type: String,
        enum: ["text", "color_swatch", "number", "boolean"],
        default: "text",
      },
      options: [String],                             // predefined values; empty = free-text
      isRequired: { type: Boolean, default: false },
      isFilterable: { type: Boolean, default: true },
      unit: { type: String },                        // "GB", "inches", etc.
      displayOrder: { type: Number, default: 0 },
    },
  ],

  availableInRegions: [{ type: String, lowercase: true, trim: true }],

  regionalMeta: [
    {
      region: { type: String, required: true, lowercase: true, trim: true },
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

/* --------------------------------
   AUTO PATH + LEVEL
-----------------------------------*/
categorySchema.pre("save", async function (next) {
  this.updatedAt = new Date();

  if (this.parentCategoryId) {
    try {
      const parent = await this.constructor.findById(this.parentCategoryId);
      if (parent) {
        this.level = (parent.level || 0) + 1;
        this.path = [...(parent.path || []), parent._id];
      } else {
        this.level = 0;
        this.path = [];
      }
    } catch {
      this.level = 0;
      this.path = [];
    }
  } else {
    this.level = 0;
    this.path = [];
  }

  next();
});

/* --------------------------------
   BACKWARD COMPATIBILITY TRANSFORM
   Auto-populate new fields from old fields in API responses
-----------------------------------*/
categorySchema.methods.toJSON = function () {
  const obj = this.toObject();

  // OLD → NEW: image → mainImage (if mainImage is null/missing and image exists)
  if (obj.image && obj.image.url && !obj.mainImage) {
    obj.mainImage = {
      type: "main",
      url: obj.image.url,
      altText: obj.image.altText || "",
      order: 1,
      isActive: true,
    };
  }

  // OLD → NEW: images[0] → illustrationImage
  if (
    obj.images &&
    Array.isArray(obj.images) &&
    obj.images.length > 0 &&
    !obj.illustrationImage
  ) {
    obj.illustrationImage = {
      type: "illustration",
      url: obj.images[0].url,
      altText: obj.images[0].altText || "",
      order: obj.images[0].order || 1,
      isActive: true,
    };
  }

  // OLD → NEW: banner → bannerImages
  if (
    obj.banner &&
    obj.banner.url &&
    (!obj.bannerImages || obj.bannerImages.length === 0)
  ) {
    obj.bannerImages = [
      {
        type: "banner",
        url: obj.banner.url,
        altText: obj.banner.altText || "",
        order: 1,
        isActive: true,
      },
    ];
  }

  // OLD → NEW: icon → iconImage
  if (obj.icon && !obj.iconImage) {
    obj.iconImage = {
      type: "icon",
      url: obj.icon,
      altText: "",
      order: 1,
      isActive: true,
    };
  }

  // NEW → OLD: mainImage → image (for backward compatibility with old clients)
  if (obj.mainImage && obj.mainImage.url && !obj.image) {
    obj.image = {
      url: obj.mainImage.url,
      altText: obj.mainImage.altText || "",
    };
  }

  // NEW → OLD: illustrationImage → images[0] (for backward compatibility)
  if (obj.illustrationImage && obj.illustrationImage.url && (!obj.images || obj.images.length === 0)) {
    obj.images = [
      {
        url: obj.illustrationImage.url,
        altText: obj.illustrationImage.altText || "",
        order: obj.illustrationImage.order || 1,
      },
    ];
  }

  // NEW → OLD: bannerImages[0] → banner (for backward compatibility)
  if (obj.bannerImages && obj.bannerImages.length > 0 && !obj.banner) {
    obj.banner = {
      url: obj.bannerImages[0].url,
      altText: obj.bannerImages[0].altText || "",
    };
  }

  // NEW → OLD: iconImage → icon (for backward compatibility)
  if (obj.iconImage && obj.iconImage.url && !obj.icon) {
    obj.icon = obj.iconImage.url;
  }

  // Keep both old and new fields for backward compatibility
  return obj;
};

/* --------------------------------
   INDEXES
-----------------------------------*/
categorySchema.index({ name: 1, isDeleted: 1 }, { unique: true });
categorySchema.index({ slug: 1, isDeleted: 1 }, { unique: true });
categorySchema.index({ availableInRegions: 1 });

module.exports = mongoose.model("Category", categorySchema);
