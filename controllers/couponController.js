// controllers/couponController.js
const Coupon = require('../models/Coupon');

/**
 * Create a new coupon (admin only)
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      discountType,
      discountValue,
      minOrderValue,
      expiryDate,
      couponType = 'INSTANT',
      maxUsageCount,
      maxUsagePerUser,
      description,
      rewardCondition,
      rewardValue
    } = req.body;

    // BASE VALIDATION
    if (!couponCode || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'couponCode and expiryDate are required'
      });
    }

    // Validate couponType
    const allowedTypes = ['INSTANT', 'REDUCE_DAYS', 'MILESTONE_REWARD'];
    if (!allowedTypes.includes(couponType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid couponType'
      });
    }

    // Additional validation for NON-milestone coupons
    if (couponType !== 'MILESTONE_REWARD') {
      if (!discountType || discountValue === undefined) {
        return res.status(400).json({
          success: false,
          message:
            'discountType and discountValue are required for INSTANT or REDUCE_DAYS coupon'
        });
      }

      if (!['flat', 'percentage'].includes(discountType)) {
        return res.status(400).json({
          success: false,
          message: 'discountType must be flat or percentage'
        });
      }

      if (discountValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'discountValue must be a positive number'
        });
      }
    }

    // MILESTONE coupon special validation
    if (couponType === 'MILESTONE_REWARD') {
      if (!rewardCondition || rewardCondition <= 0) {
        return res.status(400).json({
          success: false,
          message: 'rewardCondition must be > 0 for milestone coupon'
        });
      }
      if (!rewardValue || rewardValue <= 0) {
        return res.status(400).json({
          success: false,
          message: 'rewardValue must be > 0 for milestone coupon'
        });
      }
    }

    // Check duplicate
    const exists = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: 'Coupon already exists' });
    }

    // Create coupon
    const coupon = new Coupon({
      couponCode: couponCode.toUpperCase(),
      couponType,
      expiryDate: new Date(expiryDate),
      minOrderValue: minOrderValue ?? 0,
      isActive: true,

      // only for INSTANT / REDUCE_DAYS
      discountType: couponType !== 'MILESTONE_REWARD' ? discountType : null,
      discountValue: couponType !== 'MILESTONE_REWARD' ? discountValue : 0,

      // milestone fields
      rewardCondition: couponType === 'MILESTONE_REWARD' ? rewardCondition : null,
      rewardValue: couponType === 'MILESTONE_REWARD' ? rewardValue : null,
      milestonePaymentsRequired:
        couponType === 'MILESTONE_REWARD' ? rewardCondition : null,
      milestoneFreeDays:
        couponType === 'MILESTONE_REWARD' ? rewardValue : null,

      maxUsageCount: maxUsageCount ?? null,
      maxUsagePerUser: maxUsagePerUser ?? null,
      description: description || ''
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon
    });
  } catch (err) {
    console.error('Error creating coupon:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get all coupons
 */
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Validate a coupon for an order amount
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { couponCode, orderAmount } = req.body;

    if (!couponCode || orderAmount === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'couponCode and orderAmount required' });
    }

    const coupon = await Coupon.findActiveByCode(couponCode);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found or inactive' });
    }

    // Check validity
    const { valid, error } = coupon.isValid();
    if (!valid) {
      return res.status(400).json({ success: false, message: error });
    }

    // Order-value check
    if (orderAmount < coupon.minOrderValue) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${coupon.minOrderValue}`
      });
    }

    // HANDLE BASED ON TYPE
    let discountAmount = 0;
    let finalAmount = orderAmount;

    if (coupon.couponType !== 'MILESTONE_REWARD') {
      discountAmount = coupon.calculateDiscount(orderAmount);
      finalAmount = orderAmount - discountAmount;
    }

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      coupon: {
        code: coupon.couponCode,
        couponType: coupon.couponType,
        discountAmount,
        finalAmount,
        originalAmount: orderAmount,

        // milestone fields
        rewardCondition: coupon.rewardCondition,
        rewardValue: coupon.rewardValue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Delete coupon
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
