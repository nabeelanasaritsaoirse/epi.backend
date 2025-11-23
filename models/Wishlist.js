const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });

// Indexes for better performance
wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ products: 1 });

// Helper method to remove inactive or deleted products
wishlistSchema.methods.cleanInactiveProducts = async function() {
  const Product = mongoose.model('Product');
  const validProducts = [];

  for (const productId of this.products) {
    // Validate ObjectId before querying
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      continue; // Skip invalid productId
    }

    const product = await Product.findById(productId);
    // Keep only products that exist and are available
    if (product && product.availability && product.availability.isAvailable &&
        (product.status === 'active' || product.status === 'published')) {
      validProducts.push(productId);
    }
  }

  this.products = validProducts;
  return this.save();
};

module.exports = mongoose.model('Wishlist', wishlistSchema);
