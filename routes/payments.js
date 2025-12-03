const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const paymentController = require('../controllers/paymentController');

// Request withdrawal
router.post('/withdraw', verifyToken, async (req, res) => {
  try {
    const { amount, paymentMethod, bankDetailsId } = req.body;
    
    if (!amount || amount < 100) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is 100' });
    }
    
    if (!paymentMethod || !['bank_transfer', 'upi'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }
    
    // Check if user is KYC verified
    const user = await User.findById(req.user._id);
    const hasVerifiedKyc = user.kycDocuments.some(doc => doc.isVerified === true);
    
    // Check if either Aadhar or PAN is verified
    const hasVerifiedId = user.kycDetails && 
                        (user.kycDetails.aadharVerified || user.kycDetails.panVerified);
    
    if (!hasVerifiedKyc || !hasVerifiedId) {
      let message = 'KYC verification required for withdrawals: ';
      if (!hasVerifiedKyc) message += 'Document verification needed. ';
      if (!hasVerifiedId) message += 'ID verification (Aadhar/PAN) needed.';
      
      return res.status(403).json({ message: message.trim() });
    }
    
    // Get user's wallet balance
    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }
    
    // Check if bank details are available
    let selectedBankDetails;
    
    if (bankDetailsId) {
      // Find the specified bank details
      selectedBankDetails = user.bankDetails.find(
        bank => bank._id.toString() === bankDetailsId
      );
      
      if (!selectedBankDetails) {
        return res.status(404).json({ message: 'Bank details not found' });
      }
    } else {
      // Find default bank details or the first one
      selectedBankDetails = user.bankDetails.find(bank => bank.isDefault) || 
                           (user.bankDetails.length > 0 ? user.bankDetails[0] : null);
    }
    
    if (!selectedBankDetails) {
      return res.status(400).json({ message: 'No bank details available' });
    }
    
    // Create withdrawal transaction
    const transaction = new Transaction({
      user: req.user._id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      paymentMethod,
      paymentDetails: {
        bankName: selectedBankDetails.bankName || '',
        accountNumber: selectedBankDetails.accountNumber || '',
        accountHolderName: selectedBankDetails.accountHolderName || '',
        ifscCode: selectedBankDetails.ifscCode || '',
        upiId: selectedBankDetails.upiId || '',
        bankDetailsId: selectedBankDetails._id
      },
      description: `Withdrawal via ${paymentMethod === 'bank_transfer' ? 'bank transfer' : 'UPI'}`
    });
    
    await transaction.save();
    
    // Add transaction to user's wallet transactions
    await User.findByIdAndUpdate(req.user._id, {
      $push: { 'wallet.transactions': transaction._id },
      $inc: { 'wallet.balance': -amount } // Deduct amount from wallet
    });
    
    res.status(200).json({
      message: 'Withdrawal request submitted successfully',
      transaction
    });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all withdrawal transactions
router.get('/withdrawals', verifyToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      user: req.user._id,
      type: 'withdrawal'
    }).sort({ createdAt: -1 });
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a Razorpay order for daily installment payment
router.post('/dailyInstallment', paymentController.createDailyInstallmentOrder);

// Verify Razorpay payment for daily installment
router.post('/verifyDailyInstallment', paymentController.verifyDailyInstallmentPayment);

// Get payment status for an order
router.get('/orderStatus/:orderId', paymentController.getOrderPaymentStatus);

// Add this new route after your existing routes
router.get('/next-payment/:orderId', paymentController.getNextPaymentDate);

// Process payment (verify Razorpay or wallet payment)
router.post('/process', verifyToken, paymentController.processPayment);

module.exports = router; 
