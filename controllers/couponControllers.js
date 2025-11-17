
const Coupon = require('../models/Coupon');

/**
 * Create a new coupon (admin only)
 */
exports.createCoupon = async (req, res) => {
  try {
    const { couponCode, discountType, discountValue, minOrderValue, expiryDate } = req.body;

    // Validate required fields
    if (!couponCode || !discountType || discountValue === undefined || !expiryDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'couponCode, discountType, discountValue, and expiryDate are required' 
      });
    }

    // Validate discountType
    if (!['flat', 'percentage'].includes(discountType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'discountType must be either "flat" or "percentage"' 
      });
    }

    // Validate discountValue
    if (discountValue < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'discountValue must be a positive number' 
      });
    }

    // Validate minOrderValue
    if (minOrderValue !== undefined && minOrderValue < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'minOrderValue must be a positive number' 
      });
    }

    // Validate expiryDate
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'expiryDate must be a valid date' 
      });
    }

    // Check if coupon already exists
    const existingCoupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({ 
        success: false, 
        message: 'Coupon code already exists' 
      });
    }

    // Create coupon
    const coupon = new Coupon({
      couponCode: couponCode.toUpperCase(),
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      expiryDate: expiry,
      isActive: true
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon: coupon
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

/**
 * Get all coupons (admin only)
 */
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Coupons retrieved successfully',
      coupons: coupons
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

/**
 * Validate a coupon and calculate discount
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;

    // Validate required fields
    if (!couponCode || orderAmount === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'couponCode and orderAmount are required' 
      });
    }

    // Validate orderAmount
    if (orderAmount < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'orderAmount must be a positive number' 
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coupon is not active' 
      });
    }

    // Check if coupon is expired
    const now = new Date();
    if (now > coupon.expiryDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coupon has expired' 
      });
    }

    // Check minimum order value
    if (orderAmount < coupon.minOrderValue) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order value of ₹${coupon.minOrderValue} is required to apply this coupon`,
        minOrderValue: coupon.minOrderValue
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((orderAmount * coupon.discountValue) / 100);
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    const finalAmount = orderAmount - discountAmount;

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount,
        originalAmount: orderAmount,
        finalAmount: finalAmount
      }
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

/**
 * Delete a coupon by ID (admin only)
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Coupon ID is required' 
      });
    }

    // Find and delete the coupon
    const coupon = await Coupon.findByIdAndDelete(id);

    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
      coupon: coupon
    });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};
