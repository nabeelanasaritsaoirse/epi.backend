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
      // Include brand in populated product
      select: 'name brand pricing images availability status'
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

      // Determine price based on variant or product
      let pricePerUnit = product.pricing?.finalPrice || product.pricing?.regularPrice || 0;
      let variantInfo = null;

      // If variant exists, use variant price
      if (item.variantId && item.variantDetails && item.variantDetails.price) {
        pricePerUnit = item.variantDetails.price;
        variantInfo = {
          variantId: item.variantId,
          sku: item.variantDetails.sku,
          attributes: item.variantDetails.attributes,
          description: item.variantDetails.description
        };
      }

      const quantity = item.quantity;
      const itemTotal = pricePerUnit * quantity;

      totalItems += quantity;
      totalPrice += itemTotal;

      // Calculate installment totals
      const installmentPlan = item.installmentPlan || {};
      const totalInstallmentAmount = installmentPlan.dailyAmount
        ? installmentPlan.dailyAmount * installmentPlan.totalDays
        : itemTotal;

      return {
        productId: product._id,
        name: product.name,
        brand: product.brand || null,
        price: product.pricing?.regularPrice || 0,
        finalPrice: pricePerUnit,
        discount: product.pricing?.salePrice
          ? Math.round(
              ((product.pricing.regularPrice - product.pricing.salePrice) /
                product.pricing.regularPrice) *
              100
            )
          : 0,
        images: product.images || [],
        stock: product.availability?.stockQuantity || 0,
        isActive: product.availability?.isAvailable || false,
        quantity: quantity,
        variant: variantInfo,
        installmentPlan: {
          totalDays: installmentPlan.totalDays || 0,
          dailyAmount: installmentPlan.dailyAmount || 0,
          totalAmount: totalInstallmentAmount
        },
        addedAt: item.addedAt,
        updatedAt: item.updatedAt,
        itemTotal: itemTotal
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

// POST /api/cart/add/:productId - Add product to cart with installment plan
router.post('/add/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      quantity = 1,
      variantId = null,
      installmentPlan,
      totalDays: topLevelTotalDays,
      dailyAmount: topLevelDailyAmount
    } = req.body;
    const userId = req.user._id;

    // Support both nested and flat structure for installment plan
    console.log('🔍 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 installmentPlan:', installmentPlan);
    console.log('🔍 topLevelTotalDays:', topLevelTotalDays, 'topLevelDailyAmount:', topLevelDailyAmount);

    const totalDays = installmentPlan?.totalDays || topLevelTotalDays;
    const dailyAmount = installmentPlan?.dailyAmount || topLevelDailyAmount;

    console.log('🔍 Final totalDays:', totalDays, 'Final dailyAmount:', dailyAmount);

    // Validate inputs
    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be between 1 and 10'
      });
    }

    // Validate installment plan only if provided
    if (totalDays && totalDays < 5) {
      return res.status(400).json({
        success: false,
        message: 'totalDays must be at least 5'
      });
    }

    if (dailyAmount && dailyAmount < 50) {
      return res.status(400).json({
        success: false,
        message: 'dailyAmount must be at least ₹50'
      });
    }

    // Fetch product
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

    const stock = product.availability.stockQuantity || 0;
    if (stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock} items available in stock`
      });
    }

    // Handle variant selection
    let selectedVariant = null;
    let variantDetailsSnapshot = null;

    if (variantId && product.variants && product.variants.length > 0) {
      selectedVariant = product.variants.find((v) => v.variantId === variantId);

      if (!selectedVariant) {
        return res.status(404).json({
          success: false,
          message: `Variant '${variantId}' not found for this product`
        });
      }

      if (!selectedVariant.isActive) {
        return res.status(400).json({
          success: false,
          message: `Variant '${variantId}' is not available`
        });
      }

      // Check variant stock
      if (selectedVariant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${selectedVariant.stock} items available for this variant`
        });
      }

      // Create variant details snapshot
      variantDetailsSnapshot = {
        sku: selectedVariant.sku || null,
        attributes: selectedVariant.attributes || {},
        price: selectedVariant.salePrice || selectedVariant.price || null,
        description: selectedVariant.description || null
      };
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    // Check if same product with same variant AND same plan already exists
    const existingIndex = cart.products.findIndex(p => {
      const sameProduct = p.productId.toString() === productId;
      const sameVariant = (p.variantId || null) === (variantId || null);

      // Handle plan comparison - if both have no plan or both have same plan
      const currentPlanDays = p.installmentPlan?.totalDays || null;
      const currentPlanAmount = p.installmentPlan?.dailyAmount || null;
      const newPlanDays = totalDays || null;
      const newPlanAmount = dailyAmount || null;

      const samePlan = currentPlanDays === newPlanDays && currentPlanAmount === newPlanAmount;
      return sameProduct && sameVariant && samePlan;
    });

    if (existingIndex !== -1) {
      // Same product, variant, and plan exists - update quantity
      const newQuantity = cart.products[existingIndex].quantity + Number(quantity);

      // Check stock for new quantity
      if (selectedVariant) {
        if (selectedVariant.stock < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Cannot add more. Only ${selectedVariant.stock} items available for this variant`
          });
        }
      } else if (stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${stock} items available in stock`
        });
      }

      cart.products[existingIndex].quantity = newQuantity;
      cart.products[existingIndex].updatedAt = new Date();
    } else {
      // New entry - different product, variant, or plan
      const newCartItem = {
        productId,
        quantity: Number(quantity),
        variantId: variantId || null,
        variantDetails: variantDetailsSnapshot,
        installmentPlan: (totalDays && dailyAmount) ? {
          totalDays: Number(totalDays),
          dailyAmount: Number(dailyAmount)
        } : {
          totalDays: 0,
          dailyAmount: 0
        },
        addedAt: new Date(),
        updatedAt: new Date()
      };

      console.log('🔍 New cart item before push:', JSON.stringify(newCartItem, null, 2));
      cart.products.push(newCartItem);
    }

    console.log('🔍 Cart products before save:', JSON.stringify(cart.products, null, 2));
    await cart.save();

    res.json({
      success: true,
      message: 'Product added to cart successfully',
      data: {
        cartItemCount: cart.products.reduce((sum, item) => sum + item.quantity, 0),
        cartItems: cart.products.length
      }
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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

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

// PUT /api/cart/update-plan - Update installment plan for a cart item
router.put('/update-plan', verifyToken, async (req, res) => {
  try {
    const {
      productId,
      variantId = null,
      totalDays,
      dailyAmount,
      installmentPlan
    } = req.body;
    const userId = req.user._id;

    // Support both nested and flat structure
    const planDays = installmentPlan?.totalDays || totalDays;
    const planAmount = installmentPlan?.dailyAmount || dailyAmount;

    // Validate inputs
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId is required'
      });
    }

    if (!planDays || !planAmount) {
      return res.status(400).json({
        success: false,
        message: 'totalDays and dailyAmount are required'
      });
    }

    if (planDays < 5) {
      return res.status(400).json({
        success: false,
        message: 'totalDays must be at least 5'
      });
    }

    if (planAmount < 50) {
      return res.status(400).json({
        success: false,
        message: 'dailyAmount must be at least ₹50'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    // Find the cart item to update - match by product and variant only
    const itemIndex = cart.products.findIndex(p => {
      const sameProduct = p.productId.toString() === productId;
      const sameVariant = (p.variantId || null) === (variantId || null);
      return sameProduct && sameVariant;
    });

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found with specified product and variant'
      });
    }

    // Update the installment plan
    cart.products[itemIndex].installmentPlan = {
      totalDays: Number(planDays),
      dailyAmount: Number(planAmount)
    };
    cart.products[itemIndex].updatedAt = new Date();

    await cart.save();

    res.json({
      success: true,
      message: 'Installment plan updated successfully',
      data: {
        productId,
        variantId: variantId || null,
        updatedPlan: {
          totalDays: Number(planDays),
          dailyAmount: Number(planAmount),
          totalAmount: Number(planDays) * Number(planAmount)
        }
      }
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update installment plan',
      error: error.message
    });
  }
});

module.exports = router;
