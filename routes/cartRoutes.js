const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Using proper auth middleware
const { verifyFirebaseToken } = require('../middlewares/auth');

// POST /add/:productId
router.post('/add/:productId', verifyFirebaseToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity = 1 } = req.body;
    const userId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    const existing = cart.products.find(p => p.productId.toString() === productId);
    if (existing) {
      existing.quantity = existing.quantity + Number(quantity);
    } else {
      cart.products.push({ productId, quantity: Number(quantity) });
    }

    await cart.save();
    res.json({ success: true, message: 'Product added to cart', data: cart });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /
router.get('/cart/', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ userId }).populate('products.productId');
    res.json({ success: true, data: (cart && cart.products) || [] });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /remove/:productId
router.delete('/remove/:productId', verifyFirebaseToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const beforeCount = cart.products.length;
    cart.products = cart.products.filter(p => p.productId.toString() !== productId);
    if (cart.products.length === beforeCount) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    await cart.save();
    res.json({ success: true, message: 'Product removed from cart', data: cart });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
