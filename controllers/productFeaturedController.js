const Product = require('../models/Product');

// Get Most Popular Products
exports.getMostPopularProducts = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const products = await Product.find({ isPopular: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments({ isPopular: true, status: 'active' });

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get Best Seller Products
exports.getBestSellerProducts = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const products = await Product.find({ isBestSeller: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments({ isBestSeller: true, status: 'active' });

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get Trending Products
exports.getTrendingProducts = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const products = await Product.find({ isTrending: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Product.countDocuments({ isTrending: true, status: 'active' });

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Get All Featured Products (Popular + Best Sellers + Trending)
exports.getAllFeaturedProducts = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const mostPopular = await Product.find({ isPopular: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const bestSellers = await Product.find({ isBestSeller: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const trending = await Product.find({ isTrending: true, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        mostPopular,
        bestSellers,
        trending
      },
      summary: {
        mostPopularCount: mostPopular.length,
        bestSellersCount: bestSellers.length,
        trendingCount: trending.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Mark Product as Popular
exports.markAsPopular = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isPopular: true },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product marked as popular',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Mark Product as Best Seller
exports.markAsBestSeller = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isBestSeller: true },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product marked as best seller',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Mark Product as Trending
exports.markAsTrending = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isTrending: true },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Product marked as trending',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Bulk Mark Products
exports.bulkMarkProducts = async (req, res) => {
  try {
    const { productIds, type } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'productIds array is required' 
      });
    }

    if (!['popular', 'bestSeller', 'trending'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'type must be: popular, bestSeller, or trending' 
      });
    }

    const updateData = {};
    if (type === 'popular') updateData.isPopular = true;
    if (type === 'bestSeller') updateData.isBestSeller = true;
    if (type === 'trending') updateData.isTrending = true;

    const result = await Product.updateMany(
      { productId: { $in: productIds } },
      updateData
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} products`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Remove Popular Flag
exports.removePopular = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isPopular: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Popular flag removed',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Remove Best Seller Flag
exports.removeBestSeller = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isBestSeller: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Best seller flag removed',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// Remove Trending Flag
exports.removeTrending = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOneAndUpdate(
      { productId },
      { isTrending: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      message: 'Trending flag removed',
      data: product
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};
