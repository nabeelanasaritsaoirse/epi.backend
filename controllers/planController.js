const Order = require('../models/Order');
const Plan = require('../models/Plan');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * Get user's current plan with products
 */
exports.getCurrentPlan = async (req, res) => {
  try {
    const userId = req.body.userId;
    
    // Find the user's current plan
    let plan = await Plan.findOne({ user: userId })
      .populate({
        path: 'products.product',
        select: 'name images price brand model'
      });
    
    if (!plan) {
      return res.status(404).json({ message: 'No active plan found for this user' });
    }
    
    // Filter to only include active products in the response
    const filteredPlan = {
      ...plan.toObject(),
      products: plan.products.filter(product => product.isActive)
    };
    
    res.status(200).json({ plan: filteredPlan });
  } catch (error) {
    console.error('Error fetching current plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get detailed information about a specific product in a plan
 */
exports.getPlanProductDetail = async (req, res) => {
  try {
    const { planId, productId } = req.params;
    const userId = req.body.userId;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: 'Invalid plan ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    // Find the user's plan and the specific product
    const plan = await Plan.findOne({ 
      _id: planId, 
      user: userId,
      'products.product': productId
    }).populate({
      path: 'products.product',
      select: 'name images price brand model features specifications'
    });
    
    if (!plan) {
      return res.status(404).json({ message: 'Plan or product not found' });
    }
    
    // Find the specific product in the plan
    const planProduct = plan.products.find(p => p.product._id.toString() === productId);
    
    if (!planProduct) {
      return res.status(404).json({ message: 'Product not found in this plan' });
    }
    
    // Only allow accessing details of active products unless it's the user's most recent inactive product
    if (!planProduct.isActive) {
      // If the product is not active, we'll still show it if it's pending first payment
      if (planProduct.paidAmount > 0) {
        return res.status(404).json({ message: 'Product is not active in this plan' });
      }
    }
    
    // Calculate equivalent time in days
    const startDate = new Date(planProduct.startDate);
    const endDate = new Date(planProduct.endDate);
    const daysDifference = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    // Calculate remaining amount to be paid
    const remainingAmount = planProduct.totalProductAmount - planProduct.paidAmount;

    const order = await Order.findOne({
      user: userId,
      product: productId,
      // savedPlanId: planId
    });

    const responseData = {
      product: planProduct.product,
      lastPaymentDate: planProduct.lastPaymentDate,
      dailyPayment: planProduct.dailyPayment,
      totalProductAmount: planProduct.totalProductAmount,
      paidAmount: planProduct.paidAmount,
      status: planProduct.status,
      isActive: planProduct.isActive,
      equivalentTime: daysDifference,
      startDate: planProduct.startDate,
      endDate: planProduct.endDate,
      deliveryAddress: planProduct.deliveryAddress,
      paymentMethod: planProduct.paymentMethod,
      cardDetails: planProduct.cardDetails,
      remainingAmount: remainingAmount,
      orderDetails: order ? {
        orderId: order._id,
        orderAmount: order.orderAmount,
        paymentOption: order.paymentOption,
        paymentDetails: order.paymentDetails,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        deliveryStatus: order.deliveryStatus,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      } : null
    };
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching plan product details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Make a payment for a product in a plan
 */
exports.makeProductPayment = async (req, res) => {
  try {
    const { planId, productId, amount } = req.body;
    const userId = req.body.userId;

    // Validate input
    if (!planId || !productId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid plan ID, product ID, and amount are required' });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: 'Invalid plan ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    
    // Find the plan and product
    const plan = await Plan.findOne({ 
      _id: planId, 
      user: userId,
      'products.product': productId
    });
    
    if (!plan) {
      return res.status(404).json({ message: 'Plan or product not found' });
    }
    
    // Find the product in the plan
    const productInPlan = plan.products.find(p => p.product.toString() === productId);
    const isFirstPayment = productInPlan.paidAmount === 0;
    
    // Update the plan
    const result = await Plan.updateOne(
      { 
        _id: planId, 
        'products.product': productId 
      },
      {
        $inc: {
          'products.$.paidAmount': amount,
          'completedAmount': amount
        },
        $set: {
          'products.$.lastPaymentDate': new Date(),
          // Set isActive to true on first payment
          ...(isFirstPayment ? { 'products.$.isActive': true } : {})
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: 'Failed to update payment' });
    }
    
    // Create a transaction
    const transaction = new Transaction({
      user: userId,
      type: 'plan_payment',
      amount,
      status: 'completed',
      paymentMethod: 'card',
      plan: planId,
      product: productId,
      description: `Payment for product in plan`
    });
    
    await transaction.save();
    
    // Get the updated plan
    const updatedPlan = await Plan.findById(planId);
    
    // Check if the product payment is complete
    const updatedProductInPlan = updatedPlan.products.find(p => p.product.toString() === productId);
    if (updatedProductInPlan.paidAmount >= updatedProductInPlan.totalProductAmount) {
      await Plan.updateOne(
        { _id: planId, 'products.product': productId },
        { $set: { 'products.$.status': 'completed' } }
      );
    } else if (updatedProductInPlan.status === 'pending') {
      await Plan.updateOne(
        { _id: planId, 'products.product': productId },
        { $set: { 'products.$.status': 'partial' } }
      );
    }
    
    res.status(200).json({ 
      message: 'Payment successful',
      updatedPaidAmount: updatedProductInPlan.paidAmount,
      totalProductAmount: updatedProductInPlan.totalProductAmount,
      remainingAmount: Math.max(0, updatedProductInPlan.totalProductAmount - updatedProductInPlan.paidAmount),
      isActive: true // Product is now active after payment
    });
  } catch (error) {
    console.error('Error making plan product payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Add a product to the user's plan
 */
exports.addProductToPlan = async (req, res) => {
  try {
    const { productId, dailyPayment, deliveryAddress, paymentMethod, cardDetails } = req.body;
    const userId = req.body.userId;
    
    // Validate input
    if (!productId || !dailyPayment || dailyPayment <= 0) {
      return res.status(400).json({ message: 'Product ID and valid daily payment amount are required' });
    }

    // Get the product - handle both custom productId and MongoDB _id
    let product;
    if (mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
      // If it's a valid ObjectId, try finding by _id
      product = await Product.findById(productId);
    }

    // If not found or not a valid ObjectId, try finding by custom productId field
    if (!product) {
      product = await Product.findOne({ productId });
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Calculate end date based on daily payment
    const daysNeeded = Math.ceil(product.price / dailyPayment);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysNeeded);
    
    // Find user's existing plan or create a new one
    let plan = await Plan.findOne({ user: userId });
    
    if (!plan) {
      // Create a new plan
      plan = new Plan({
        user: userId,
        totalAmount: product.price,
        products: [{
          product: product._id,
          dailyPayment,
          totalProductAmount: product.price,
          startDate: new Date(),
          endDate,
          isActive: false, // Set to false initially, will be true after first payment
          deliveryAddress,
          paymentMethod,
          cardDetails
        }]
      });
    } else {
      // Check if product already exists in plan
      const existingProduct = plan.products.find(p => p.product.toString() === product._id.toString());

      if (existingProduct) {
        return res.status(400).json({ message: 'This product is already in your plan' });
      }

      // Add product to existing plan
      plan.totalAmount += product.price;
      plan.products.push({
        product: product._id,
        dailyPayment,
        totalProductAmount: product.price,
        startDate: new Date(),
        endDate,
        isActive: false, // Set to false initially, will be true after first payment
        deliveryAddress,
        paymentMethod,
        cardDetails
      });
    }
    
    await plan.save();
    
    res.status(201).json({
      message: 'Product added to plan successfully',
      product: {
        _id: productId,
        name: product.name,
        price: product.price,
        dailyPayment: dailyPayment,
        requiresInitialPayment: true // Indicate that payment is required to activate
      }
    });
  } catch (error) {
    console.error('Error adding product to plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get user's pending (not yet active) products
 */
exports.getPendingProducts = async (req, res) => {
  try {
    const userId = req.body.userId;
    
    // Find the user's current plan
    const plan = await Plan.findOne({ user: userId })
      .populate({
        path: 'products.product',
        select: 'name images price brand model'
      });
    
    if (!plan) {
      return res.status(200).json({ pendingProducts: [] });
    }
    
    // Filter to only include inactive products (waiting for first payment)
    const pendingProducts = plan.products
      .filter(product => !product.isActive && product.paidAmount === 0)
      .map(product => ({
        planId: plan._id,
        productId: product.product._id,
        product: {
          name: product.product.name,
          images: product.product.images,
          price: product.product.price,
          brand: product.product.brand,
          model: product.product.model
        },
        dailyPayment: product.dailyPayment,
        totalProductAmount: product.totalProductAmount
      }));
    
    res.status(200).json({ pendingProducts });
  } catch (error) {
    console.error('Error fetching pending products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Remove a product from the user's plan
 */
exports.removeProductFromPlan = async (req, res) => {
  try {
    const { planId, productId } = req.params;
    const userId = req.body.userId;
    
    // Find the plan
    const plan = await Plan.findOne({ _id: planId, user: userId });
    
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    
    // Find the product in the plan
    const productInPlan = plan.products.find(p => p.product.toString() === productId);
    
    if (!productInPlan) {
      return res.status(404).json({ message: 'Product not found in this plan' });
    }
    
    // Cannot remove if payment has already started
    if (productInPlan.paidAmount > 0) {
      return res.status(400).json({ message: 'Cannot remove product as payment has already started' });
    }
    
    // Reduce total plan amount
    plan.totalAmount -= productInPlan.totalProductAmount;
    
    // Remove the product from the plan
    plan.products = plan.products.filter(p => p.product.toString() !== productId);
    
    // If no products left, delete the plan
    if (plan.products.length === 0) {
      await Plan.deleteOne({ _id: planId });
      return res.status(200).json({ message: 'Plan deleted as no products remain' });
    }
    
    await plan.save();
    
    res.status(200).json({ message: 'Product removed from plan successfully', plan });
  } catch (error) {
    console.error('Error removing product from plan:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 