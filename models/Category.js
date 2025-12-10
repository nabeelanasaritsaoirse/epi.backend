const mongoose = require('mongoose');

// Image schema for categories with order field
const imageSchema = new mongoose.Schema({
  url: String,
  altText: String,
  order: {
    type: Number,
    default: 1
  }
}, { _id: false });

const categorySchema = new mongoose.Schema({
  categoryId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  image: {
    url: String,
    altText: String
  },
  images: [imageSchema],
  banner: {
    url: String,
    altText: String,
    link: String
  },
  icon: {
    type: String
  },
  parentCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  subCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  level: {
    type: Number,
    default: 0
  },
  path: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  productCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  showInMenu: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  meta: {
    title: String,
    description: String,
    keywords: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ============================================
  // REGIONAL AVAILABILITY (For admin to control which regions see this category)
  // ============================================
  availableInRegions: [{
    type: String,
    lowercase: true,
    trim: true
    // Examples: ['india', 'usa', 'uk', 'uae']
    // If empty array, category is available globally in all regions
  }],

  regionalMeta: [{
    region: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    title: String,
    description: String,
    keywords: [String]
  }]
});

// Middleware to update the updatedAt field and auto-calculate level & path
categorySchema.pre('save', async function(next) {
  this.updatedAt = new Date();

  // Auto-calculate level and path based on parent
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
    } catch (error) {
      this.level = 0;
      this.path = [];
    }
  } else {
    this.level = 0;
    this.path = [];
  }

  next();
});

// Create index for faster queries
categorySchema.index({ name: 1, parentCategoryId: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ availableInRegions: 1 }); // For regional filtering

module.exports = mongoose.model('Category', categorySchema);
