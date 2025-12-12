const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: String,
    altText: String,
    order: { type: Number, default: 1 },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema({
  categoryId: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  slug: { type: String, unique: true, lowercase: true, trim: true },

  image: { url: String, altText: String },
  images: [imageSchema],

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

  /* ------------------------------------------------------
     🌍 REGIONAL FIELDS — FINAL VALID VERSION (NO DUPLICATES)
     ------------------------------------------------------ */

  availableInRegions: [
    {
      type: String,
      lowercase: true,
      trim: true,
    },
  ],

  regionalMeta: [
    {
      region: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      metaTitle: String, // <── matches frontend
      metaDescription: String, // <── matches frontend
      keywords: [String],
    },
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Auto-update path/level
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
    } catch (e) {
      this.level = 0;
      this.path = [];
    }
  } else {
    this.level = 0;
    this.path = [];
  }

  next();
});

categorySchema.index({ name: 1, isDeleted: 1 }, { unique: true });
categorySchema.index({ slug: 1 });
categorySchema.index({ availableInRegions: 1 });

module.exports = mongoose.model("Category", categorySchema);
