const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Using proper auth middleware
const { verifyToken } = require('../middlewares/auth');

// POST /add/:productId
router.post('/add/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      quantity = 1,
      variantId,
      installmentPlan,
      totalDays,
      dailyAmount
    } = req.body;
    const userId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Support both nested and flat installment plan structure
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('installmentPlan:', installmentPlan);
    console.log('totalDays:', totalDays, 'dailyAmount:', dailyAmount);

    let finalInstallmentPlan;
    if (installmentPlan && installmentPlan.totalDays && installmentPlan.dailyAmount) {
      // Nested structure
      console.log('Using nested structure');
      finalInstallmentPlan = {
        totalDays: Number(installmentPlan.totalDays),
        dailyAmount: Number(installmentPlan.dailyAmount)
      };
    } else if (totalDays && dailyAmount) {
      // Flat structure
      console.log('Using flat structure');
      finalInstallmentPlan = {
        totalDays: Number(totalDays),
        dailyAmount: Number(dailyAmount)
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Installment plan is required (totalDays and dailyAmount)'
      });
    }

    console.log('Final installment plan:', finalInstallmentPlan);

    // Validate installment plan
    if (finalInstallmentPlan.totalDays < 5) {
      return res.status(400).json({
        success: false,
        message: 'Total days must be at least 5'
      });
    }
    if (finalInstallmentPlan.dailyAmount < 50) {
      return res.status(400).json({
        success: false,
        message: 'Daily amount must be at least 50'
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    // Check if product with same variant already exists
    const existing = cart.products.find(p =>
      p.productId.toString() === productId &&
      p.variantId === (variantId || null)
    );

    if (existing) {
      existing.quantity = existing.quantity + Number(quantity);
      existing.installmentPlan = finalInstallmentPlan;
      existing.updatedAt = Date.now();
    } else {
      const newProduct = {
        productId,
        quantity: Number(quantity),
        installmentPlan: finalInstallmentPlan
      };

      // Add variantId if provided
      if (variantId) {
        newProduct.variantId = variantId;

        // Try to find and save variant details
        const variant = product.variants?.find(v => v.variantId === variantId);
        if (variant) {
          newProduct.variantDetails = {
            sku: variant.sku,
            attributes: variant.attributes,
            price: variant.price,
            description: variant.description
          };
        }
      }

      cart.products.push(newProduct);
    }

    await cart.save();
    res.json({ success: true, message: 'Product added to cart', data: cart });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Failed to add product to cart', error: error.message });
  }
});

// GET /
router.get('/cart/', verifyToken, async (req, res) => {
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
router.delete('/remove/:productId', verifyToken, async (req, res) => {
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
