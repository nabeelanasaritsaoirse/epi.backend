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
   INDEXES
-----------------------------------*/
categorySchema.index({ name: 1, isDeleted: 1 }, { unique: true });
categorySchema.index({ slug: 1, isDeleted: 1 }, { unique: true });
categorySchema.index({ availableInRegions: 1 });

module.exports = mongoose.model("Category", categorySchema);
