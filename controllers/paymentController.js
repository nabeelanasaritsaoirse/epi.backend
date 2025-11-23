const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const razorpay = require('../config/razorpay');

/**
 * Create a Razorpay order for daily installment
 */
exports.createDailyInstallmentOrder = async (req, res) => {
  try {
    const { orderId, dailyAmount } = req.body;
    
    if (!orderId || !dailyAmount || dailyAmount < 1) {
      return res.status(400).json({ message: 'Order ID and valid daily amount are required' });
    }
    
    // Get the order
    const order = await Order.findOne({
      _id: orderId,
      user: req.body.userId
    }).populate('product');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    if (order.paymentOption !== 'daily') {
      return res.status(400).json({ message: 'This order is not configured for daily payments' });
    }
    
    // Check if payment has already been made today for this order
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const existingPaymentToday = await Transaction.findOne({
      user: req.body.userId,
      type: 'purchase',
      status: 'completed',
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    if (existingPaymentToday) {
      return res.status(400).json({ 
        message: 'You have already made a payment today for this order. Next payment can be made tomorrow.',
        nextPaymentDate: tomorrow.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      });
    }
    
    // Continue with creating the Razorpay order
    const options = {
      amount: dailyAmount * 100, // Razorpay amount is in paisa
      currency: 'INR',
      receipt: `pay_${Date.now().toString().slice(-8)}_${req.body.userId.toString().slice(-6)}`,
      payment_capture: 1,
      notes: {
        order_id: orderId,
        payment_type: 'daily_installment',
        product_id: order.product._id.toString()
      }
    };
    
    const razorpayOrder = await razorpay.orders.create(options);
    
    // Create a pending transaction
    const transaction = new Transaction({
      user: req.body.userId,
      type: 'purchase',
      amount: dailyAmount,
      status: 'pending',
      paymentMethod: 'razorpay',
      product: order.product._id,
      paymentDetails: {
        orderId: razorpayOrder.id,
        orderReference: order._id
      },
      description: `Daily installment payment for ${order.product.name}`
    });
    
    await transaction.save();
    
    res.status(200).json({
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      transaction_id: transaction._id,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating daily installment payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Verify Razorpay payment for daily installment
 */
exports.verifyDailyInstallmentPayment = async (req, res) => {
  try {
    const { 
      orderId,
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      transaction_id,
      userId,
      dailyAmount,
      days,
      totalAmount
    } = req.body;
    
    // Get the transaction
    const transaction = await Transaction.findById(transaction_id);
    
    if (!transaction && !userId) {
      return res.status(404).json({ message: 'Transaction not found and no userId provided' });
    }
    
    // Use provided userId or transaction.user
    const userIdForQuery = userId || (transaction ? transaction.user : null);
    
    if (!userIdForQuery) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get the order if transaction exists
    let order = null;
    if (transaction && orderId) {
      order = await Order.findById(orderId);
    }

    console.log("order", order)
    
    // Use provided transaction amount or dailyAmount
    const paymentAmount = transaction ? transaction.amount : (dailyAmount || 0);
    
    // If transaction exists, update its status
    if (transaction) {
      transaction.status = 'completed';
      if (razorpay_payment_id) transaction.paymentDetails.paymentId = razorpay_payment_id;
      if (razorpay_signature) transaction.paymentDetails.signature = razorpay_signature;
      await transaction.save();
    }
    
    let completedTransactions = [];
    let totalPaid = 0;
    let isFirstPayment = false;
    
    // If order exists, update its status
    if (order) {
      // Calculate total paid so far
      completedTransactions = await Transaction.find({
        user: userIdForQuery,
        product: order.product,
        status: 'completed'
      });
      
      totalPaid = completedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      isFirstPayment = completedTransactions.length === 1;
      
      // Update order payment status
      if (totalPaid >= order.orderAmount) {
        order.paymentStatus = 'completed';
        if (order.orderStatus === 'confirmed') {
          order.orderStatus = 'completed';
        }
      } else if (order.paymentStatus === 'pending') {
        // First payment converts status from pending to partial
        order.paymentStatus = 'partial';
        order.orderStatus = 'confirmed';
      }
      
      await order.save();
    } else {
      // If no order, assume this is the first payment for direct verification
      isFirstPayment = true;
    }
    
    // Process referral commission - 30% of daily payment amount
    try {
      // Get the user to find their referrer
      const User = require('../models/User');
      const DailyCommission = require('../models/DailyCommission');
      const Referral = require('../models/Referral');
      
      const currentUser = await User.findById(userIdForQuery);
      
      if (currentUser && currentUser.referredBy) {
        // Find the referral record
        let referral = await Referral.findOne({
          referredUser: userIdForQuery,
          referrer: currentUser.referredBy
        });
        
        // If referral record doesn't exist but user has a referrer, create one
        if (!referral && currentUser.referredBy) {
          referral = new Referral({
            referrer: currentUser.referredBy,
            referredUser: userIdForQuery,
            status: 'ACTIVE',
            startDate: new Date(),
            dailyAmount: dailyAmount || paymentAmount,
            days: days || 30,
            totalAmount: totalAmount || (order ? order.orderAmount : (dailyAmount * days || 3000)),
            commissionPercentage: 30
          });
          
          await referral.save();
        } else if (referral && (dailyAmount || days || totalAmount)) {
          // Update referral with new installment plan details if provided
          const updateData = {};
          if (dailyAmount) updateData.dailyAmount = dailyAmount;
          if (days) updateData.days = days;
          if (totalAmount) updateData.totalAmount = totalAmount;
          
          await Referral.findByIdAndUpdate(referral._id, updateData);
          
          // Reload referral with updated data
          referral = await Referral.findById(referral._id);
        }
        
        if (referral) {
          // Calculate 30% commission
          const commissionAmount = Math.round(paymentAmount * (referral.commissionPercentage / 100));
          
          if (commissionAmount > 0) {
            // Create commission record
            const commission = new DailyCommission({
              referral: referral._id,
              referrer: currentUser.referredBy,
              amount: commissionAmount,
              date: new Date(),
              status: 'PENDING'
            });
            
            await commission.save();
            
            // Update referrer's wallet
            await User.findByIdAndUpdate(
              currentUser.referredBy, 
              { 
                $inc: { 'wallet.balance': commissionAmount },
                $push: { 'wallet.transactions': {
                  type: 'referral_commission',
                  amount: commissionAmount,
                  description: `Commission from ${currentUser.name || 'user'}'s daily payment`,
                  createdAt: new Date()
                }}
              }
            );
            
            // Update commission status to PAID
            await DailyCommission.findByIdAndUpdate(
              commission._id,
              { status: 'PAID' }
            );
            
            // Update referral with new commission data and increment daysPaid
            const updatedReferral = await Referral.findByIdAndUpdate(
              referral._id,
              {
                $inc: {
                  commissionEarned: commissionAmount,
                  daysPaid: 1
                },
                $set: {
                  lastPaymentDate: new Date()
                }
              },
              { new: true } // Return the updated document
            );
            
            // Check if this completes the referral
            if (updatedReferral.daysPaid >= updatedReferral.days) {
              await Referral.findByIdAndUpdate(
                referral._id,
                {
                  status: 'COMPLETED',
                  endDate: new Date()
                }
              );
              console.log(`Referral ${referral._id} completed with ${updatedReferral.daysPaid}/${updatedReferral.days} days paid`);
            } else {
              // Calculate the end date (start date + days + missed days)
              const startDate = new Date(updatedReferral.startDate);
              const endDate = new Date(startDate);
              // Add the total days to complete
              endDate.setDate(startDate.getDate() + updatedReferral.days);
              
              await Referral.findByIdAndUpdate(
                referral._id,
                { endDate: endDate }
              );
              console.log(`Referral progress: ${updatedReferral.daysPaid}/${updatedReferral.days} days paid`);
            }
            
            console.log(`Referral commission of ₹${commissionAmount} credited to user ${currentUser.referredBy}`);
          }
        }
      }
    } catch (commissionError) {
      console.error('Error processing referral commission:', commissionError);
      // Don't fail the payment verification if commission processing fails
    }
    
    // If this is the first payment, add product to the user's plan
    if (isFirstPayment && order) {
      try {
        const Plan = require('../models/Plan');
        const Product = require('../models/Product');

        // Validate that order.product is a valid ObjectId before querying
        if (!order.product || !mongoose.Types.ObjectId.isValid(order.product)) {
          throw new Error('Invalid product ID in order');
        }

        // Get the product details
        const product = await Product.findById(order.product);
        if (!product) {
          throw new Error('Product not found');
        }
        
        // Check if user has a plan
        let userPlan = await Plan.findOne({ user: userIdForQuery });
        
        if (!userPlan) {
          // Create a new plan for the user
          userPlan = new Plan({
            user: userIdForQuery,
            totalAmount: product.price,
            completedAmount: paymentAmount,
            products: []
          });
        }
        
        // Check if this product is already in the plan
        const existingProductIndex = userPlan.products.findIndex(
          p => p.product.toString() === order.product.toString()
        );
        
        if (existingProductIndex === -1) {
          // Calculate end date based on daily payment
          const finalDailyPayment = dailyAmount || order.paymentDetails?.dailyAmount || paymentAmount;
          const daysNeeded = days || Math.ceil(product.price / finalDailyPayment);
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + daysNeeded);
          
          // Add the product to the plan
          userPlan.products.push({
            product: order.product,
            lastPaymentDate: new Date(),
            dailyPayment: finalDailyPayment,
            totalProductAmount: product.price,
            paidAmount: paymentAmount,
            status: 'partial',
            isActive: true,  // Active since payment is made
            startDate: new Date(),
            endDate: endDate,
            deliveryAddress: order.deliveryAddress || {
              street: '',
              city: '',
              state: '',
              pincode: '',
              country: 'India'
            },
            paymentMethod: transaction ? transaction.paymentMethod : 'card',
            cardDetails: {
              bank: transaction ? (transaction.paymentDetails?.bankName || '') : '',
              cardType: '',
              last4Digits: ''
            }
          });
          
          // Update total amount by adding this product's price
          userPlan.totalAmount = product.price;
          
          // Set completed amount to this transaction amount
          userPlan.completedAmount = paymentAmount;
        } else {
          // Update existing product
          userPlan.products[existingProductIndex].isActive = true;
          userPlan.products[existingProductIndex].lastPaymentDate = new Date();
          
          // Add payment amount if it's not already counted
          if (userPlan.products[existingProductIndex].paidAmount === 0) {
            userPlan.products[existingProductIndex].paidAmount = paymentAmount;
            userPlan.completedAmount = paymentAmount;
          }
        }
        
        // Recalculate total and completed amounts based on all products
        let calculatedTotalAmount = 0;
        let calculatedCompletedAmount = 0;
        
        for (const planProduct of userPlan.products) {
          // Get the correct product price
          if (order && planProduct.product.toString() === order.product.toString()) {
            calculatedTotalAmount += product.price;
            calculatedCompletedAmount += planProduct.paidAmount;
          } else {
            calculatedTotalAmount += planProduct.totalProductAmount;
            calculatedCompletedAmount += planProduct.paidAmount;
          }
        }
        
        userPlan.totalAmount = calculatedTotalAmount;
        userPlan.completedAmount = calculatedCompletedAmount;
        
        // Save the updated plan
        await userPlan.save();
        
      } catch (planError) {
        console.error('Error adding product to plan after first payment:', planError);
        // We don't want to fail the payment verification if plan update fails
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      paymentStatus: order ? order.paymentStatus : 'completed',
      totalPaid: totalPaid || paymentAmount,
      remainingAmount: order ? Math.max(0, order.orderAmount - totalPaid) : 0,
      isFirstPayment: isFirstPayment
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

/**
 * Get payment status for an order
 */
exports.getOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Get the userId from the order
    const userId = order.user;
    
    // Get all completed transactions for this order
    const transactions = await Transaction.find({
      user: userId,
      product: order.product,
      status: 'completed'
    }).sort({ createdAt: -1 });
    
    const totalPaid = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const remainingAmount = Math.max(0, order.orderAmount - totalPaid);
    
    res.status(200).json({
      orderId: order._id,
      product: order.product,
      orderAmount: order.orderAmount,
      paymentOption: order.paymentOption,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalPaid,
      remainingAmount,
      transactions: transactions.map(tx => ({
        id: tx._id,
        amount: tx.amount,
        createdAt: tx.createdAt,
        paymentMethod: tx.paymentMethod
      })),
      nextPaymentDue: order.paymentStatus !== 'completed' ? true : false
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get next payment date for daily installment
 */
exports.getNextPaymentDate = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Get the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order is completed
    if (order.paymentStatus === 'completed') {
      return res.status(200).json({
        canMakePayment: false,
        message: 'Order is already fully paid',
        nextPaymentDate: null
      });
    }

    // Check if a payment has been made today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingPaymentToday = await Transaction.findOne({
      user: order.user,
      type: 'purchase',
      status: 'completed',
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    // Get total payments made so far
    const completedTransactions = await Transaction.find({
      user: order.user,
      type: 'purchase',
      status: 'completed',
      'paymentDetails.orderReference': orderId
    });

    const totalPaid = completedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const remainingAmount = Math.max(0, order.orderAmount - totalPaid);
    const paymentsMade = completedTransactions.length;

    let response = {};

    if (existingPaymentToday) {
      // Payment already made today
      response = {
        canMakePayment: false,
        message: 'You have already made a payment today for this order. Next payment can be made tomorrow.',
        nextPaymentDate: tomorrow,
        totalPaid,
        remainingAmount,
        paymentsMade
      };
    } else if (remainingAmount <= 0) {
      // Order fully paid
      response = {
        canMakePayment: false,
        message: 'Order is already fully paid',
        nextPaymentDate: null,
        totalPaid,
        remainingAmount: 0,
        paymentsMade
      };
    } else {
      // Can make payment today
      response = {
        canMakePayment: true,
        message: 'You can make a payment today',
        nextPaymentDate: today,
        suggestedAmount: Math.min(order.paymentDetails.dailyAmount || 100, remainingAmount),
        totalPaid,
        remainingAmount,
        paymentsMade
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting next payment date:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Process payment (generic endpoint for both wallet and Razorpay)
 */
exports.processPayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;

    // Validate required fields
    if (!orderId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and payment method are required'
      });
    }

    // Get the order
    const order = await Order.findById(orderId).populate('product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify Razorpay payment if payment method is RAZORPAY
    if (paymentMethod === 'RAZORPAY') {
      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay payment details are required'
        });
      }

      // Verify signature
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature'
        });
      }
    }

    // Calculate payment progress
    const completedTransactions = await Transaction.find({
      user: order.user,
      product: order.product._id,
      status: 'completed'
    });

    const totalPaid = completedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const progress = Math.min(100, Math.round((totalPaid / order.orderAmount) * 100));

    // Update order status based on payment
    if (totalPaid >= order.orderAmount) {
      order.paymentStatus = 'completed';
      order.orderStatus = 'ACTIVE';
    } else if (totalPaid > 0) {
      order.paymentStatus = 'partial';
      order.orderStatus = 'ACTIVE';
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        order: {
          orderId: order._id,
          status: order.orderStatus,
          progress: progress,
          paymentStatus: order.paymentStatus,
          totalPaid: totalPaid,
          remainingAmount: Math.max(0, order.orderAmount - totalPaid)
        }
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 