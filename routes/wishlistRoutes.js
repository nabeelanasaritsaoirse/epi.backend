const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// Using proper auth middleware
const { verifyToken } = require('../middlewares/auth');

// POST /add/:productId
router.post('/add/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    // Prevent duplicates
    if (wishlist.products.some(p => p.toString() === productId)) {
      return res.json({ success: true, message: 'Product already in wishlist', data: wishlist });
    }

    wishlist.products.push(productId);
    await wishlist.save();

    res.json({ success: true, message: 'Product added to wishlist', data: wishlist });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const wishlist = await Wishlist.findOne({ userId }).populate('products');
    res.json({ success: true, data: (wishlist && wishlist.products) || [] });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /remove/:productId
router.delete('/remove/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return res.status(404).json({ success: false, message: 'Wishlist not found' });

    const beforeCount = wishlist.products.length;
    wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
    if (wishlist.products.length === beforeCount) {
      return res.status(404).json({ success: false, message: 'Product not in wishlist' });
    }

    await wishlist.save();
    res.json({ success: true, message: 'Product removed from wishlist', data: wishlist });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
