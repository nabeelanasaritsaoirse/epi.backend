# Notification Integration Examples

## 🚀 How to Use triggerNotification() in Your Existing Code

The notification system provides a simple, reusable function that you can call from **anywhere** in your codebase to send notifications to users.

---

## 📦 Import the Function

```javascript
const { triggerNotification } = require('./services/notificationSystemService');
```

---

## 💡 Real-World Integration Examples

### 1. Order Controller - Order Lifecycle

```javascript
// controllers/orderController.js
const { triggerNotification } = require('../services/notificationSystemService');

// ✅ After order is created
exports.createOrder = async (req, res) => {
  try {
    const order = await Order.create({
      userId: req.user._id,
      items: req.body.items,
      totalAmount: req.body.totalAmount,
      orderNumber: generateOrderNumber()
    });

    // Send order confirmation notification
    await triggerNotification({
      type: 'ORDER_CONFIRMATION',
      userId: req.user._id,
      title: 'Order Confirmed! 🎉',
      body: `Your order #${order.orderNumber} for ₹${order.totalAmount} has been confirmed. We'll notify you when it ships.`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount
      }
    });

    res.status(201).json({
      success: true,
      data: { order }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ When order is shipped
exports.markAsShipped = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, carrier } = req.body;

    const order = await Order.findById(orderId);
    order.status = 'SHIPPED';
    order.trackingNumber = trackingNumber;
    await order.save();

    // Send shipping notification
    await triggerNotification({
      type: 'ORDER_SHIPPED',
      userId: order.userId,
      title: 'Order Shipped 📦',
      body: `Your order #${order.orderNumber} is on its way! Track it: ${trackingNumber}`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        orderId: order._id,
        trackingNumber,
        carrier
      }
    });

    res.status(200).json({ success: true, data: { order } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ When order is delivered
exports.markAsDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    await order.save();

    // Send delivery notification
    await triggerNotification({
      type: 'ORDER_DELIVERED',
      userId: order.userId,
      title: 'Order Delivered ✅',
      body: `Your order #${order.orderNumber} has been delivered. Enjoy your purchase!`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        orderId: order._id
      }
    });

    res.status(200).json({ success: true, data: { order } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

### 2. Payment Controller - Payment Status

```javascript
// controllers/paymentController.js
const { triggerNotification } = require('../services/notificationSystemService');
const Razorpay = require('razorpay');

// ✅ After successful payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify payment signature
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update payment status
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    payment.status = 'SUCCESS';
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    // Send payment success notification
    await triggerNotification({
      type: 'PAYMENT_SUCCESS',
      userId: payment.userId,
      title: 'Payment Successful ✅',
      body: `Your payment of ₹${payment.amount} has been received. Transaction ID: ${razorpay_payment_id}`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        paymentId: payment._id,
        razorpayPaymentId: razorpay_payment_id,
        amount: payment.amount,
        transactionId: razorpay_payment_id
      }
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: { payment }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Payment failed
exports.handlePaymentFailure = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const payment = await Payment.findOne({ orderId });
    payment.status = 'FAILED';
    payment.failureReason = reason;
    await payment.save();

    // Send payment failure notification
    await triggerNotification({
      type: 'PAYMENT_FAILED',
      userId: payment.userId,
      title: 'Payment Failed ❌',
      body: `Your payment of ₹${payment.amount} could not be processed. Please try again.`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        paymentId: payment._id,
        amount: payment.amount,
        reason
      }
    });

    res.status(200).json({ success: true });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

### 3. Wallet Service - Commission & Credits

```javascript
// services/walletService.js
const { triggerNotification } = require('./notificationSystemService');

// ✅ Credit commission to wallet
exports.creditCommission = async (userId, amount, description) => {
  try {
    const user = await User.findById(userId);

    // Credit wallet
    user.wallet.balance += amount;
    user.wallet.transactions.push({
      type: 'referral_commission',
      amount,
      description,
      createdAt: new Date()
    });

    await user.save();

    // Send wallet credit notification
    await triggerNotification({
      type: 'COMMISSION_EARNED',
      userId: userId,
      title: 'Commission Earned! 💰',
      body: `₹${amount} has been credited to your wallet. ${description}`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        amount,
        newBalance: user.wallet.balance
      }
    });

    return user.wallet;

  } catch (error) {
    console.error('Error crediting commission:', error);
    throw error;
  }
};

// ✅ Wallet withdrawal processed
exports.processWithdrawal = async (withdrawalId) => {
  try {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    const user = await User.findById(withdrawal.userId);

    // Deduct from wallet
    user.wallet.balance -= withdrawal.amount;
    user.wallet.transactions.push({
      type: 'withdrawal',
      amount: -withdrawal.amount,
      description: `Withdrawal to bank account`,
      createdAt: new Date()
    });

    withdrawal.status = 'COMPLETED';
    withdrawal.completedAt = new Date();

    await Promise.all([user.save(), withdrawal.save()]);

    // Send withdrawal notification
    await triggerNotification({
      type: 'WALLET_DEBIT',
      userId: user._id,
      title: 'Withdrawal Processed ✅',
      body: `₹${withdrawal.amount} has been transferred to your bank account.`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        amount: withdrawal.amount,
        newBalance: user.wallet.balance
      }
    });

    return withdrawal;

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    throw error;
  }
};
```

---

### 4. Referral System - New Referrals

```javascript
// controllers/referralController.js
const { triggerNotification } = require('../services/notificationSystemService');

// ✅ User signs up with referral code
exports.signupWithReferral = async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body;

    // Find referrer
    const referrer = await User.findOne({ referralCode });

    if (!referrer) {
      return res.status(400).json({
        success: false,
        message: 'Invalid referral code'
      });
    }

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password,
      referredBy: referrer._id
    });

    // Update referrer's list
    referrer.referredUsers.push(newUser._id);
    await referrer.save();

    // Notify referrer about new referral
    await triggerNotification({
      type: 'REFERRAL_JOINED',
      userId: referrer._id,
      title: 'New Referral! 🎊',
      body: `${newUser.name} joined using your referral code. You'll earn commission on their purchases!`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        referralUserId: newUser._id,
        referralName: newUser.name
      }
    });

    res.status(201).json({
      success: true,
      data: { user: newUser }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

### 5. KYC Controller - Document Verification

```javascript
// controllers/kycController.js
const { triggerNotification } = require('../services/notificationSystemService');

// ✅ KYC approved
exports.approveKYC = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    user.kycDetails.aadharVerified = true;
    user.kycDetails.panVerified = true;
    await user.save();

    // Send KYC approval notification
    await triggerNotification({
      type: 'KYC_APPROVED',
      userId: user._id,
      title: 'KYC Approved ✅',
      body: 'Your KYC documents have been verified. You can now use all features!',
      sendPush: true,
      sendInApp: true,
      metadata: {}
    });

    res.status(200).json({ success: true, data: { user } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ KYC rejected
exports.rejectKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    const kycDoc = user.kycDocuments[0];
    kycDoc.status = 'rejected';
    kycDoc.rejectionReason = reason;
    await user.save();

    // Send KYC rejection notification
    await triggerNotification({
      type: 'KYC_REJECTED',
      userId: user._id,
      title: 'KYC Verification Failed ❌',
      body: `Your KYC documents were rejected. Reason: ${reason}. Please resubmit correct documents.`,
      sendPush: true,
      sendInApp: true,
      metadata: {
        reason
      }
    });

    res.status(200).json({ success: true, data: { user } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

### 6. Daily Commissions Script - Batch Notifications

```javascript
// scripts/processDailyCommissions.js
const { triggerNotification } = require('../services/notificationSystemService');

async function processDailyCommissions() {
  try {
    // Get all users with commissions to process
    const commissions = await DailyCommission.find({
      status: 'PENDING',
      date: today
    }).populate('userId');

    for (const commission of commissions) {
      // Credit to wallet
      const user = await User.findById(commission.userId);
      user.wallet.balance += commission.amount;
      await user.save();

      commission.status = 'PROCESSED';
      await commission.save();

      // Send notification to each user
      await triggerNotification({
        type: 'COMMISSION_EARNED',
        userId: commission.userId,
        title: 'Daily Commission Credited! 💰',
        body: `₹${commission.amount} has been credited to your wallet as daily commission.`,
        sendPush: true,
        sendInApp: true,
        metadata: {
          amount: commission.amount,
          date: today
        }
      });
    }

    console.log(`Processed ${commissions.length} daily commissions`);

  } catch (error) {
    console.error('Error processing daily commissions:', error);
  }
}
```

---

## 🎯 Best Practices

### 1. Always Handle Errors
```javascript
try {
  await triggerNotification({...});
} catch (error) {
  console.error('Failed to send notification:', error);
  // Don't let notification failure break your main flow
}
```

### 2. Use Descriptive Titles and Bodies
```javascript
// ❌ Bad
await triggerNotification({
  title: 'Success',
  body: 'Done'
});

// ✅ Good
await triggerNotification({
  title: 'Order Confirmed! 🎉',
  body: `Your order #${order.orderNumber} for ₹${order.totalAmount} has been confirmed.`
});
```

### 3. Include Relevant Metadata
```javascript
// ✅ Good - Includes all relevant info
await triggerNotification({
  type: 'PAYMENT_SUCCESS',
  userId: payment.userId,
  title: 'Payment Successful',
  body: 'Your payment has been received',
  metadata: {
    paymentId: payment._id,
    transactionId: payment.razorpayPaymentId,
    amount: payment.amount,
    orderId: payment.orderId
  }
});
```

### 4. Respect User Preferences
The system automatically checks user preferences:
- `notificationPreferences.pushEnabled`
- `notificationPreferences.orderUpdates`
- `notificationPreferences.paymentAlerts`

You don't need to check manually!

---

## 🔄 Migration Guide

If you have existing notification code, replace it with `triggerNotification()`:

### Before:
```javascript
// Old code
const notification = new Notification({
  userId: user._id,
  title: 'Order Confirmed',
  message: 'Your order has been confirmed'
});
await notification.save();

// Separate push notification code
if (user.fcmToken) {
  await sendPushNotification(user.fcmToken, { title, body });
}
```

### After:
```javascript
// New code - handles everything!
await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: user._id,
  title: 'Order Confirmed',
  body: 'Your order has been confirmed',
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id }
});
```

---

## ✨ That's It!

You can now send notifications from anywhere in your app with just one function call!

**Key Points:**
- ✅ Always import from `./services/notificationSystemService`
- ✅ Use appropriate system types
- ✅ Include metadata for context
- ✅ Set `sendPush` and `sendInApp` as needed
- ✅ Don't let notification errors break main flow
