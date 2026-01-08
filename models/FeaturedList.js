const mongoose = require("mongoose");

const featuredProductSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    productMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    // Cached product data for performance
    productName: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: null,
    },
    productImage: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      min: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },
    // Track when cache was last synced
    lastSynced: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const featuredListSchema = new mongoose.Schema({
  listId: {
    type: String,
    required: true,
    unique: true,
  },
  listName: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  products: [featuredProductSchema],

  isActive: {
    type: Boolean,
    default: true,
  },

  // Order in which lists appear on homepage/API
  displayOrder: {
    type: Number,
    default: 0,
  },

  // Design type for frontend rendering (1, 2, 3, 4, 5)
  design: {
    type: Number,
    required: true,
    default: 1,
    min: [1, "Design must be at least 1"],
    max: [5, "Design cannot exceed 5"],
    validate: {
      validator: Number.isInteger,
      message: "Design must be an integer",
    },
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdByEmail: {
    type: String,
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedByEmail: {
    type: String,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  deletedByEmail: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware - normalize product orders and update timestamp
featuredListSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Normalize product orders (1, 5, 10) → (1, 2, 3)
  if (this.products && this.products.length > 0) {
    // Sort by current order
    this.products.sort((a, b) => a.order - b.order);

    // Reassign sequential orders starting from 1
    this.products.forEach((product, index) => {
      product.order = index + 1;
    });
  }

  next();
});

// Pre-findOneAndUpdate middleware
featuredListSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Indexes for performance
featuredListSchema.index({ slug: 1, isDeleted: 1 });
featuredListSchema.index({ isActive: 1, isDeleted: 1, displayOrder: 1 });
featuredListSchema.index({ "products.productId": 1 });
featuredListSchema.index({ createdAt: -1 });

// Method to sync a single product's cached data
featuredListSchema.methods.syncProduct = async function (productId) {
  const Product = require("./Product");

  const product = await Product.findOne({ productId, isDeleted: false });
  if (!product) {
    // Product not found - remove from list
    this.products = this.products.filter((p) => p.productId !== productId);
    return false;
  }

  const productInList = this.products.find((p) => p.productId === productId);
  if (productInList) {
    productInList.productMongoId = product._id;
    productInList.productName = product.name;
    productInList.brand = product.brand || null;
    productInList.productImage =
      product.images?.[0]?.url || product.images?.[0] || null;
    productInList.price = product.pricing?.regularPrice || 0;
    productInList.finalPrice = product.pricing?.finalPrice || 0;
    productInList.lastSynced = Date.now();
  }

  return true;
};

// Static method to sync all lists containing a specific product
featuredListSchema.statics.syncProductInAllLists = async function (productId) {
  const lists = await this.find({
    "products.productId": productId,
    isDeleted: false,
  });

  const Product = require("./Product");
  const product = await Product.findOne({ productId, isDeleted: false });

  if (!product) {
    // Product deleted - remove from all lists
    await this.updateMany(
      { "products.productId": productId },
      { $pull: { products: { productId } } }
    );
    return;
  }

  // Update cached data in all lists
  for (const list of lists) {
    const productInList = list.products.find((p) => p.productId === productId);
    if (productInList) {
      productInList.productMongoId = product._id;
      productInList.productName = product.name;
      productInList.brand = product.brand || null;
      productInList.productImage =
        product.images?.[0]?.url || product.images?.[0] || null;
      productInList.price = product.pricing?.regularPrice || 0;
      productInList.finalPrice = product.pricing?.finalPrice || 0;
      productInList.lastSynced = Date.now();

      await list.save();
    }
  }
};

module.exports = mongoose.model("FeaturedList", featuredListSchema);
