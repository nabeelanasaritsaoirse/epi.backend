const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { verifyToken } = require('../middlewares/auth');

// GET /api/cart - Get user's cart with totals
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ userId }).populate({
      path: 'products.productId',
      select: 'name pricing images availability status'
    });

    if (!cart) {
      return res.json({
        success: true,
        message: 'Cart is empty',
        data: {
          products: [],
          totalItems: 0,
          totalPrice: 0,
          subtotal: 0
        }
      });
    }

    // Filter out inactive/deleted products
    const activeProducts = cart.products.filter(item => {
      const product = item.productId;
      return product &&
             product.availability &&
             product.availability.isAvailable &&
             (product.status === 'active' || product.status === 'published');
    });

    // Update cart if products were filtered
    if (activeProducts.length !== cart.products.length) {
      cart.products = activeProducts;
      await cart.save();
    }

    // Calculate totals
    let totalItems = 0;
    let totalPrice = 0;

    const cartItems = activeProducts.map(item => {
      const product = item.productId;
      const price = product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
      const quantity = item.quantity;

      totalItems += quantity;
      totalPrice += price * quantity;

      return {
        productId: product._id,
        name: product.name,
        price: product.pricing?.regularPrice || 0,
        finalPrice: price,
        discount: product.pricing?.salePrice ?
          Math.round(((product.pricing.regularPrice - product.pricing.salePrice) / product.pricing.regularPrice) * 100) : 0,
        images: product.images || [],
        stock: product.availability?.stockQuantity || 0,
        isActive: product.availability?.isAvailable || false,
        quantity: quantity,
        addedAt: item.addedAt,
        itemTotal: price * quantity
      };
    });

    res.json({
      success: true,
      message: 'Cart fetched successfully',
      data: {
        products: cartItems,
        totalItems,
        totalPrice: Math.round(totalPrice * 100) / 100,
        subtotal: Math.round(totalPrice * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart',
      error: error.message
    });
  }
});

// GET /api/cart/count - Get cart item count for badge
router.get('/count', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.json({
        success: true,
        data: { count: 0 }
      });
    }

    const totalItems = cart.products.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      success: true,
      data: { count: totalItems }
    });
  } catch (error) {
    console.error('Error fetching cart count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart count',
      error: error.message
    });
  }
});

// POST /api/cart/add/:productId - Add product to cart
router.post('/add/:productId', verifyToken, async (req, res) => {
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
      message: 'Product added to cart successfully',
      data: { cartItemCount: cart.products.reduce((sum, item) => sum + item.quantity, 0) }
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add product to cart',
      error: error.message
    });
  }
});

// PUT /api/cart/update/:productId - Update product quantity
router.put('/update/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    // Validate quantity
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Check product stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const stock = product.availability?.stockQuantity || 0;
    if (stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} items available in stock`
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not in cart'
      });
    }

    cart.products[productIndex].quantity = Number(quantity);
    await cart.save();

    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: { cartItemCount: cart.products.reduce((sum, item) => sum + item.quantity, 0) }
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message
    });
  }
});

// DELETE /api/cart/remove/:productId - Remove product from cart
router.delete('/remove/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const beforeCount = cart.products.length;
    cart.products = cart.products.filter(p => p.productId.toString() !== productId);

    if (cart.products.length === beforeCount) {
      return res.status(404).json({
        success: false,
        message: 'Product not in cart'
      });
    }

    await cart.save();

    res.json({
      success: true,
      message: 'Product removed from cart successfully',
      data: { cartItemCount: cart.products.reduce((sum, item) => sum + item.quantity, 0) }
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove product from cart',
      error: error.message
    });
  }
});

// DELETE /api/cart/clear - Clear entire cart
router.delete('/clear', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.json({
        success: true,
        message: 'Cart is already empty'
      });
    }

    cart.products = [];
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: { cartItemCount: 0 }
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message
    });
  }
});

module.exports = router;
