const mongoose = require('mongoose');

/**
 * Cart Product Schema
 * Supports installment-based purchases with variant selection
 */
const cartProductSchema = new mongoose.Schema({
  // Product Reference
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  // Quantity
  quantity: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },

  // Product Variant (if applicable)
  variantId: {
    type: String,
    default: null
  },

  // Variant Details Snapshot (saved at time of adding to cart)
  variantDetails: {
    sku: { type: String, default: null },
    attributes: {
      size: { type: String, default: null },
      color: { type: String, default: null },
      weight: { type: String, default: null },
      purity: { type: String, default: null },
      material: { type: String, default: null }
    },
    price: { type: Number, default: null },
    description: { type: String, default: null }
  },

  // Installment Plan (selected by user)
  installmentPlan: {
    totalDays: {
      type: Number,
      required: false,
      min: 5,
      default: null
    },
    dailyAmount: {
      type: Number,
      required: false,
      min: 50,
      default: null
    }
  },

  // Timestamps
  addedAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: [cartProductSchema]
}, { timestamps: true });

// Indexes for better performance
cartSchema.index({ userId: 1 });
cartSchema.index({ 'products.productId': 1 });

// Helper method to remove inactive or deleted products
cartSchema.methods.cleanInactiveProducts = async function() {
  const Product = mongoose.model('Product');
  const validProducts = [];

  for (const item of this.products) {
    // Validate ObjectId before querying
    if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
      continue; // Skip invalid productId
    }

    const product = await Product.findById(item.productId);
    // Keep only products that exist and are available
    if (product && product.availability && product.availability.isAvailable &&
        (product.status === 'active' || product.status === 'published')) {
      validProducts.push(item);
    }
  }

  this.products = validProducts;
  return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);
