const mongoose = require('mongoose');

const cartProductSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  addedAt: { type: Date, default: Date.now }
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
