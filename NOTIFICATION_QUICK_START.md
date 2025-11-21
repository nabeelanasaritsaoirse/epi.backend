# Notification System - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Firebase Setup (Optional - For Push Notifications)

1. **Download Firebase Service Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Project Settings → Service Accounts
   - Generate New Private Key
   - Save as `serviceAccountKey.json` in root directory

2. **Add to .gitignore:**
   ```
   serviceAccountKey.json
   ```

**Note:** The system works WITHOUT Firebase, but push notifications will be disabled.

---

### Step 2: Start the Server

```bash
npm start
```

You should see:
```
✅ Firebase Admin SDK initialized successfully
✅ Notification scheduler cron job started (runs every minute)
```

---

### Step 3: Test the System

#### A. Send Your First System Notification

Add this to any controller (e.g., `orderController.js`):

```javascript
const { triggerNotification } = require('../services/notificationSystemService');

// Send a test notification
await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: req.user._id,  // Current user ID
  title: 'Test Notification 🎉',
  body: 'This is your first notification!',
  sendPush: true,
  sendInApp: true,
  metadata: { test: true }
});
```

#### B. Create Admin Post via API

```bash
# 1. Create a draft notification
curl -X POST http://localhost:3000/api/admin/notifications/create \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postType": "OFFER",
    "title": "Welcome to Our Store! 🎊",
    "body": "Get 10% off on your first order. Use code: WELCOME10",
    "sendInApp": true,
    "sendPush": false,
    "commentsEnabled": true,
    "likesEnabled": true
  }'

# Response will include notificationId and _id

# 2. Publish it immediately
curl -X POST http://localhost:3000/api/admin/notifications/NOTIFICATION_ID/publish \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### C. Test User Endpoints

```bash
# Get notification feed
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer USER_TOKEN"

# Like a notification
curl -X POST http://localhost:3000/api/notifications/NOTIFICATION_ID/like \
  -H "Authorization: Bearer USER_TOKEN"

# Add a comment
curl -X POST http://localhost:3000/api/notifications/NOTIFICATION_ID/comments \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "This is amazing!"}'
```

---

### Step 4: Integrate Into Your App

#### Order Confirmation Example

```javascript
// controllers/orderController.js
const { triggerNotification } = require('../services/notificationSystemService');

exports.createOrder = async (req, res) => {
  try {
    // Create order
    const order = await Order.create({
      userId: req.user._id,
      items: req.body.items,
      totalAmount: req.body.totalAmount
    });

    // 🎯 Send notification
    await triggerNotification({
      type: 'ORDER_CONFIRMATION',
      userId: req.user._id,
      title: 'Order Confirmed! 🎉',
      body: `Your order #${order.orderNumber} has been confirmed`,
      sendPush: true,
      sendInApp: true,
      metadata: { orderId: order._id }
    });

    res.json({ success: true, data: { order } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

## 📱 Mobile App Integration

### 1. Register FCM Token (When User Logs In)

```dart
// Flutter
final fcmToken = await FirebaseMessaging.instance.getToken();

await http.post(
  Uri.parse('$apiUrl/api/notifications/register-token'),
  headers: {
    'Authorization': 'Bearer $userToken',
    'Content-Type': 'application/json'
  },
  body: json.encode({'fcmToken': fcmToken}),
);
```

### 2. Handle Notification Clicks

```dart
// Flutter
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
  final notificationId = message.data['notificationId'];

  // Navigate to notification details
  Navigator.pushNamed(
    context,
    '/notification-details',
    arguments: notificationId,
  );
});
```

### 3. Display Notification Feed

```dart
// Flutter
Future<void> loadNotifications() async {
  final response = await http.get(
    Uri.parse('$apiUrl/api/notifications?page=1&limit=20'),
    headers: {'Authorization': 'Bearer $userToken'},
  );

  final data = json.decode(response.body);
  setState(() {
    notifications = data['data']['notifications'];
  });
}
```

---

## 🎯 Common Use Cases

### 1. Order Status Updates
```javascript
// Order confirmed
await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: order.userId,
  title: 'Order Confirmed! 🎉',
  body: `Order #${order.orderNumber} confirmed`,
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id }
});

// Order shipped
await triggerNotification({
  type: 'ORDER_SHIPPED',
  userId: order.userId,
  title: 'Order Shipped 📦',
  body: `Track: ${trackingNumber}`,
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id, trackingNumber }
});
```

### 2. Payment Notifications
```javascript
await triggerNotification({
  type: 'PAYMENT_SUCCESS',
  userId: payment.userId,
  title: 'Payment Successful ✅',
  body: `₹${payment.amount} received`,
  sendPush: true,
  sendInApp: true,
  metadata: { paymentId: payment._id, amount: payment.amount }
});
```

### 3. Wallet Credits
```javascript
await triggerNotification({
  type: 'WALLET_CREDIT',
  userId: user._id,
  title: 'Money Added! 💰',
  body: `₹${amount} credited to your wallet`,
  sendPush: true,
  sendInApp: true,
  metadata: { amount, newBalance: user.wallet.balance }
});
```

### 4. Commission Earnings
```javascript
await triggerNotification({
  type: 'COMMISSION_EARNED',
  userId: user._id,
  title: 'Commission Earned! 💰',
  body: `₹${commission} earned from referral`,
  sendPush: true,
  sendInApp: true,
  metadata: { amount: commission }
});
```

---

## 🎨 Admin Operations

### Create and Publish Post
```javascript
// 1. Create draft
POST /api/admin/notifications/create
{
  "postType": "OFFER",
  "title": "50% Off Sale!",
  "body": "Limited time offer...",
  "sendInApp": true,
  "sendPush": false
}

// 2. Upload image (optional)
PUT /api/admin/notifications/:id/upload-image
[multipart/form-data with image file]

// 3. Publish immediately
POST /api/admin/notifications/:id/publish

// OR Schedule for later
POST /api/admin/notifications/:id/schedule
{
  "scheduledAt": "2024-12-25T10:00:00Z"
}
```

---

## ⚙️ Configuration

### Environment Variables (Optional)
```env
# AWS S3 (for image uploads)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=your_bucket

# JWT
JWT_SECRET=your_secret
```

---

## 🔍 Testing Checklist

- [ ] System notification sent successfully
- [ ] Admin post created and published
- [ ] User can see notification feed
- [ ] User can like notification
- [ ] User can comment on notification
- [ ] Push notification received (if Firebase configured)
- [ ] Scheduled notification auto-published
- [ ] Image upload works
- [ ] FCM token registered

---

## 🐛 Troubleshooting

**Push notifications not working?**
- Check `serviceAccountKey.json` exists in root
- Verify user has FCM token registered
- Check user's notification preferences

**Images not uploading?**
- Verify AWS credentials in `.env`
- Check S3 bucket permissions
- Ensure file size < 5MB

**Scheduled posts not publishing?**
- Check cron job is running (console log on startup)
- Verify `scheduledAt` is correct format
- Check server time zone

---

## 📚 Learn More

- [Full Documentation](./NOTIFICATION_SYSTEM_DOCUMENTATION.md)
- [Integration Examples](./NOTIFICATION_INTEGRATION_EXAMPLES.md)
- [API Reference](./NOTIFICATION_API_REFERENCE.md)

---

## 🎉 You're Ready!

Start sending notifications with just one function:

```javascript
const { triggerNotification } = require('./services/notificationSystemService');

await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: user._id,
  title: 'Success! 🎉',
  body: 'Your action was successful',
  sendPush: true,
  sendInApp: true,
  metadata: {}
});
```

That's it! The notification system handles everything else automatically.
