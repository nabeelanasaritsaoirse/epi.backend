const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { verifyToken } = require('../middlewares/auth');

// GET /api/wishlist - Get user's wishlist
// GET /api/wishlist - Get user's wishlist
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    let wishlist = await Wishlist.findOne({ userId }).populate({
      path: 'products',
      select: 'name pricing images availability status brand'
    });

    if (!wishlist) {
      return res.json({
        success: true,
        message: 'Wishlist is empty',
        data: []
      });
    }

    // Filter out inactive/deleted products
    const activeProducts = wishlist.products.filter(product => {
      return product &&
             product.availability &&
             product.availability.isAvailable &&
             (product.status === 'active' || product.status === 'published');
    });

    // Update wishlist if products were filtered
    if (activeProducts.length !== wishlist.products.length) {
      wishlist.products = activeProducts.map(p => p._id);
      await wishlist.save();
    }

    // Format response with product details INCLUDING BRAND
    const wishlistItems = activeProducts.map(product => ({
      productId: product._id,
      name: product.name,
      brand: product.brand || null,   // <-- brand included here
      price: product.pricing?.regularPrice || 0,
      finalPrice: product.pricing?.finalPrice || product.pricing?.regularPrice || 0,
      discount: product.pricing?.salePrice ?
        Math.round(((product.pricing.regularPrice - product.pricing.salePrice) / product.pricing.regularPrice) * 100) : 0,
      images: product.images || [],
      stock: product.availability?.stockQuantity || 0,
      isActive: product.availability?.isAvailable || false
    }));

    res.json({
      success: true,
      message: 'Wishlist fetched successfully',
      data: wishlistItems
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist',
      error: error.message
    });
  }
});

// GET /api/wishlist/count - Get wishlist count for badge
router.get('/count', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return res.json({
        success: true,
        data: { count: 0 }
      });
    }

    res.json({
      success: true,
      data: { count: wishlist.products.length }
    });
  } catch (error) {
    console.error('Error fetching wishlist count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist count',
      error: error.message
    });
  }
});

// GET /api/wishlist/check/:productId - Check if product is in wishlist
router.get('/check/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ userId });

    const isInWishlist = wishlist ?
      wishlist.products.some(p => p.toString() === productId) : false;

    res.json({
      success: true,
      data: { isInWishlist }
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check wishlist',
      error: error.message
    });
  }
});

// POST /api/wishlist/add/:productId - Add product to wishlist
router.post('/add/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Validate product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.availability || !product.availability.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    if (product.status !== 'active' && product.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Product is not active'
      });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    // Prevent duplicates
    if (wishlist.products.some(p => p.toString() === productId)) {
      return res.json({
        success: true,
        message: 'Product already in wishlist',
        data: { wishlistCount: wishlist.products.length, isInWishlist: true }
      });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    res.json({
      success: true,
      message: 'Product added to wishlist successfully',
      data: { wishlistCount: wishlist.products.length, isInWishlist: true }
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to wishlist',
      error: error.message
    });
  }
});

// DELETE /api/wishlist/remove/:productId - Remove product from wishlist
router.delete('/remove/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    const beforeCount = wishlist.products.length;
    wishlist.products = wishlist.products.filter(p => p.toString() !== productId);

    if (wishlist.products.length === beforeCount) {
      return res.status(404).json({
        success: false,
        message: 'Product not in wishlist'
      });
    }

    await wishlist.save();

    res.json({
      success: true,
      message: 'Product removed from wishlist successfully',
      data: { wishlistCount: wishlist.products.length, isInWishlist: false }
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove product from wishlist',
      error: error.message
    });
  }
});

// POST /api/wishlist/toggle/:productId - Toggle product in wishlist (add/remove)
router.post('/toggle/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Validate product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    const productIndex = wishlist.products.findIndex(p => p.toString() === productId);

    if (productIndex !== -1) {
      // Product exists, remove it
      wishlist.products.splice(productIndex, 1);
      await wishlist.save();

      return res.json({
        success: true,
        message: 'Product removed from wishlist',
        data: { wishlistCount: wishlist.products.length, isInWishlist: false }
      });
    } else {
      // Product doesn't exist, add it
      if (!product.availability || !product.availability.isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Product is not available'
        });
      }

      if (product.status !== 'active' && product.status !== 'published') {
        return res.status(400).json({
          success: false,
          message: 'Product is not active'
        });
      }

      wishlist.products.push(productId);
      await wishlist.save();

      return res.json({
        success: true,
        message: 'Product added to wishlist',
        data: { wishlistCount: wishlist.products.length, isInWishlist: true }
      });
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle wishlist',
      error: error.message
    });
  }
});

// POST /api/wishlist/move-to-cart/:productId - Move product from wishlist to cart
router.post('/move-to-cart/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity = 1 } = req.body;
    const userId = req.user._id;

    // Validate quantity
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Check if product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.availability || !product.availability.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }

    if (product.status !== 'active' && product.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Product is not active'
      });
    }

    // Check stock availability
    const stock = product.availability.stockQuantity || 0;
    if (stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} items available in stock`
      });
    }

    // Remove from wishlist
    const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
      await wishlist.save();
    }

    // Add to cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    const existingIndex = cart.products.findIndex(p => p.productId.toString() === productId);

    if (existingIndex !== -1) {
      const newQuantity = cart.products[existingIndex].quantity + Number(quantity);

      // Check stock for new quantity
      if (stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${stock} items available in stock`
        });
      }

      cart.products[existingIndex].quantity = newQuantity;
    } else {
      cart.products.push({
        productId,
        quantity: Number(quantity),
        addedAt: new Date()
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: 'Product moved to cart successfully',
      data: {
        wishlistCount: wishlist ? wishlist.products.length : 0,
        cartItemCount: cart.products.reduce((sum, item) => sum + item.quantity, 0)
      }
    });
  } catch (error) {
    console.error('Error moving to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move product to cart',
      error: error.message
    });
  }
});

// DELETE /api/wishlist/clear - Clear entire wishlist
router.delete('/clear', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.json({
        success: true,
        message: 'Wishlist is already empty'
      });
    }

    wishlist.products = [];
    await wishlist.save();

    res.json({
      success: true,
      message: 'Wishlist cleared successfully',
      data: { wishlistCount: 0 }
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist',
      error: error.message
    });
  }
});

module.exports = router;
