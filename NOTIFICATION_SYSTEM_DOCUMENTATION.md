# Notification System Documentation

## 🎯 Overview

A complete, production-ready notification system with admin post management, user interactions (likes/comments), push notifications via Firebase Cloud Messaging (FCM), and automated scheduling.

## 📁 File Structure

```
├── models/
│   ├── Notification.js           # Main notification model (admin posts + system notifications)
│   ├── NotificationComment.js    # User comments on posts
│   ├── NotificationLike.js       # User likes on posts
│   └── User.js                   # Updated with FCM token + preferences
├── services/
│   ├── fcmService.js            # Firebase Cloud Messaging (push notifications)
│   ├── notificationSystemService.js # Core notification service + triggerNotification()
│   └── awsUploadService.js      # Existing S3 service (reused)
├── controllers/
│   ├── notificationController.js       # User endpoints
│   └── adminNotificationController.js  # Admin endpoints
├── routes/
│   ├── notificationRoutes.js          # User routes
│   └── adminNotificationRoutes.js     # Admin routes
├── validators/
│   └── notificationValidator.js       # Input validation
├── utils/
│   └── notificationHelpers.js         # Helper functions
├── jobs/
│   └── notificationCron.js           # Cron job for scheduled posts
└── config/
    └── firebase.js                   # Firebase Admin SDK config
```

## 🚀 Quick Start

### 1. Install Dependencies (Already Installed)
```bash
# All required packages are already in package.json:
# - firebase-admin
# - @aws-sdk/client-s3
# - express-validator
# - node-cron
# - multer
# - sharp
# - xss
```

### 2. Setup Firebase (For Push Notifications)

**Download Firebase Service Account Key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file as `serviceAccountKey.json` in the **root directory**

**⚠️ Important:** Add to `.gitignore`:
```
serviceAccountKey.json
```

**Note:** The app will work without Firebase, but push notifications will be disabled.

### 3. Environment Variables

Add to your `.env` file:
```env
# AWS S3 (already configured)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=your_bucket_name

# JWT Secret (already configured)
JWT_SECRET=your_jwt_secret
```

### 4. Start the Server

```bash
npm start
```

The notification cron job will start automatically!

---

## 📱 Core Feature: Trigger Notifications

### Universal Notification Function

Use this function **anywhere in your codebase** to send notifications:

```javascript
const { triggerNotification } = require('./services/notificationSystemService');

// Example: Order confirmation
await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: order.userId,
  title: 'Order Confirmed! 🎉',
  body: `Your order #${order.orderNumber} has been confirmed and will be processed soon.`,
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id }
});
```

### Supported System Notification Types

```javascript
// Order notifications
'ORDER_CONFIRMATION'
'ORDER_SHIPPED'
'ORDER_DELIVERED'
'ORDER_CANCELLED'

// Payment notifications
'PAYMENT_SUCCESS'
'PAYMENT_FAILED'
'PAYMENT_PENDING'

// Wallet notifications
'WALLET_CREDIT'
'WALLET_DEBIT'
'COMMISSION_EARNED'

// Other
'DELIVERY_UPDATE'
'REFERRAL_JOINED'
'KYC_APPROVED'
'KYC_REJECTED'
'GENERAL'
```

### Usage Examples

#### 1. In Order Controller
```javascript
// orderController.js
const { triggerNotification } = require('../services/notificationSystemService');

// After order is confirmed
await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: order.userId,
  title: 'Order Confirmed! 🎉',
  body: `Your order #${order.orderNumber} has been confirmed`,
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id }
});

// After order is shipped
await triggerNotification({
  type: 'ORDER_SHIPPED',
  userId: order.userId,
  title: 'Order Shipped 📦',
  body: `Your order is on its way! Track: ${trackingNumber}`,
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: order._id, trackingNumber }
});
```

#### 2. In Payment Controller
```javascript
// paymentController.js
const { triggerNotification } = require('../services/notificationSystemService');

// After successful payment
await triggerNotification({
  type: 'PAYMENT_SUCCESS',
  userId: payment.userId,
  title: 'Payment Successful ✅',
  body: `₹${payment.amount} received. Thank you!`,
  sendPush: true,
  sendInApp: true,
  metadata: {
    paymentId: payment._id,
    amount: payment.amount,
    transactionId: payment.razorpayPaymentId
  }
});
```

#### 3. In Wallet Service
```javascript
// walletService.js
const { triggerNotification } = require('../services/notificationSystemService');

// After commission credited
await triggerNotification({
  type: 'COMMISSION_EARNED',
  userId: wallet.userId,
  title: 'Commission Earned! 💰',
  body: `₹${commission} credited to your wallet`,
  sendPush: true,
  sendInApp: true,
  metadata: { amount: commission }
});
```

#### 4. In Referral System
```javascript
// referralController.js
const { triggerNotification } = require('../services/notificationSystemService');

// When someone joins using referral
await triggerNotification({
  type: 'REFERRAL_JOINED',
  userId: referrer.userId,
  title: 'New Referral! 🎊',
  body: `${newUser.name} joined using your referral code`,
  sendPush: true,
  sendInApp: true,
  metadata: { referralUserId: newUser._id }
});
```

---

## 🔔 API Endpoints

### User Endpoints (`/api/notifications`)

#### 1. Get Notification Feed
```http
GET /api/notifications?page=1&limit=20&type=ADMIN_POST
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "notificationId": "NOTIF-20241120-0001",
        "type": "ADMIN_POST",
        "postType": "OFFER",
        "title": "50% Off Sale!",
        "body": "Limited time offer...",
        "imageUrl": "https://s3.../image.jpg",
        "likeCount": 150,
        "commentCount": 25,
        "viewCount": 500,
        "isLikedByMe": true,
        "commentsEnabled": true,
        "likesEnabled": true,
        "publishedAt": "2024-11-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

#### 2. Get Single Notification
```http
GET /api/notifications/:id
Authorization: Bearer <token>
```

#### 3. Like/Unlike Notification
```http
POST /api/notifications/:id/like
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Post liked successfully",
  "data": {
    "isLiked": true,
    "newLikeCount": 201
  }
}
```

#### 4. Add Comment
```http
POST /api/notifications/:id/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "This is awesome!"
}
```

#### 5. Get Comments
```http
GET /api/notifications/:id/comments?page=1&limit=20
Authorization: Bearer <token>
```

#### 6. Delete Own Comment
```http
DELETE /api/notifications/:notificationId/comments/:commentId
Authorization: Bearer <token>
```

#### 7. Mark as Read
```http
POST /api/notifications/:id/mark-read
Authorization: Bearer <token>
```

#### 8. Get Unread Count
```http
GET /api/notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5,
    "systemNotifications": 3,
    "adminPosts": 2
  }
}
```

#### 9. Register FCM Token
```http
POST /api/notifications/register-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "fcmToken": "fcm_token_from_mobile_device"
}
```

#### 10. Remove FCM Token (Logout)
```http
POST /api/notifications/remove-token
Authorization: Bearer <token>
```

#### 11. Update Notification Preferences
```http
PUT /api/notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "pushEnabled": true,
  "orderUpdates": true,
  "promotionalOffers": false,
  "paymentAlerts": true,
  "systemNotifications": true
}
```

---

### Admin Endpoints (`/api/admin/notifications`)

#### 1. Create Notification (Draft)
```http
POST /api/admin/notifications/create
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "postType": "OFFER",
  "title": "50% Off Sale!",
  "body": "Limited time offer on all products...",
  "sendInApp": true,
  "sendPush": false,
  "sendPushOnly": false,
  "commentsEnabled": true,
  "likesEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification created as draft",
  "data": {
    "notificationId": "NOTIF-20241120-0001",
    "_id": "65abc123...",
    "status": "DRAFT",
    "nextStep": "Upload image (if needed) then publish or schedule"
  }
}
```

#### 2. Upload Image
```http
PUT /api/admin/notifications/:id/upload-image
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data

image: <file>
```

**Validation:**
- Max size: 5MB
- Allowed types: JPG, PNG, WebP
- Auto-resized to 1920px width

#### 3. Publish Notification
```http
POST /api/admin/notifications/:id/publish
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Notification published successfully",
  "data": {
    "notificationId": "NOTIF-20241120-0001",
    "status": "PUBLISHED",
    "pushSent": true,
    "sent": 1250,
    "failed": 5
  }
}
```

#### 4. Schedule Notification
```http
POST /api/admin/notifications/:id/schedule
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "scheduledAt": "2024-11-25T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification scheduled successfully",
  "data": {
    "notificationId": "NOTIF-20241120-0001",
    "status": "SCHEDULED",
    "scheduledAt": "2024-11-25T10:00:00Z",
    "willPublishIn": "4 days 23 hours 45 minutes"
  }
}
```

#### 5. Update Notification
```http
PATCH /api/admin/notifications/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Updated title",
  "body": "Updated body",
  "commentsEnabled": false
}
```

#### 6. Delete Notification
```http
DELETE /api/admin/notifications/:id
Authorization: Bearer <admin_token>
```

#### 7. Toggle Settings
```http
PATCH /api/admin/notifications/:id/settings
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "commentsEnabled": false,
  "likesEnabled": true
}
```

#### 8. Delete Comment (Moderation)
```http
DELETE /api/admin/notifications/:notificationId/comments/:commentId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Spam/inappropriate content"
}
```

#### 9. Get All Notifications
```http
GET /api/admin/notifications?page=1&limit=20&status=PUBLISHED&search=offer
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: DRAFT | SCHEDULED | PUBLISHED | INACTIVE | DELETED
- `type`: ADMIN_POST | SYSTEM_NOTIFICATION
- `search`: Search in title/body

#### 10. Get Analytics
```http
GET /api/admin/notifications/analytics?startDate=2024-11-01&endDate=2024-11-20
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalNotifications": 50,
    "totalLikes": 5000,
    "totalComments": 1200,
    "totalViews": 25000,
    "averageEngagement": 12.4,
    "topPerformingPost": {
      "notificationId": "NOTIF-001",
      "title": "Black Friday Sale",
      "likeCount": 500,
      "commentCount": 150,
      "engagementRate": 18.5
    },
    "postsByType": {
      "OFFER": 20,
      "POST": 15,
      "PRODUCT_SHARE": 15
    }
  }
}
```

---

## 🔐 Security Features

### 1. Rate Limiting
- Like: 100 per hour per user
- Comment: 50 per hour per user
- Image upload: 10 per hour per admin

### 2. Input Sanitization
- All user input sanitized with `xss` package
- Comments: No HTML, no URLs allowed
- Max lengths enforced

### 3. File Upload Security
- File type validation (magic bytes)
- Size limit: 5MB
- Random filenames
- S3 upload with proper permissions

### 4. Authentication
- JWT tokens for admins
- Firebase tokens for mobile users
- Role-based access control

---

## 📊 Database Models

### Notification Schema
```javascript
{
  notificationId: "NOTIF-YYYYMMDD-XXXX",
  type: "ADMIN_POST" | "SYSTEM_NOTIFICATION",
  postType: "OFFER" | "POST" | "POST_WITH_IMAGE" | "PRODUCT_SHARE",
  systemType: "ORDER_CONFIRMATION" | "PAYMENT_SUCCESS" | ...,
  title: String (max 200),
  body: String (max 5000),
  imageUrl: String,
  sharedProduct: {
    productId, productName, productImage, productPrice, productUrl
  },
  targetType: "ALL_USERS" | "SPECIFIC_USER",
  targetUserId: ObjectId,
  sendInApp: Boolean,
  sendPush: Boolean,
  sendPushOnly: Boolean,
  commentsEnabled: Boolean,
  likesEnabled: Boolean,
  likeCount: Number,
  commentCount: Number,
  viewCount: Number,
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "INACTIVE" | "DELETED",
  scheduledAt: Date,
  publishedAt: Date,
  createdBy: ObjectId,
  metadata: {
    orderId, paymentId, amount, ...
  }
}
```

---

## ⚙️ Cron Job

The notification scheduler runs **every minute** to check for scheduled posts.

**Location:** `jobs/notificationCron.js`

**What it does:**
1. Finds notifications with `status: SCHEDULED` and `scheduledAt <= now`
2. Updates status to `PUBLISHED`
3. Sends push notifications if enabled
4. Logs success/failure

**Started automatically** when the app starts.

---

## 🎨 Admin Workflow

### Creating and Publishing a Post

```
1. Create Draft
   POST /api/admin/notifications/create
   → Returns notificationId

2. Upload Image (Optional)
   PUT /api/admin/notifications/:id/upload-image
   → Image uploaded to S3

3. Publish Options:

   Option A: Publish Immediately
   POST /api/admin/notifications/:id/publish
   → Status: PUBLISHED
   → Push sent to all users

   Option B: Schedule for Later
   POST /api/admin/notifications/:id/schedule
   → Status: SCHEDULED
   → Cron job will auto-publish
```

---

## 📱 Mobile Integration

### Flutter/React Native Setup

#### 1. Register FCM Token
```dart
// Flutter example
import 'package:firebase_messaging/firebase_messaging.dart';

final fcmToken = await FirebaseMessaging.instance.getToken();

// Send to backend
await http.post(
  Uri.parse('$apiUrl/api/notifications/register-token'),
  headers: {'Authorization': 'Bearer $token'},
  body: json.encode({'fcmToken': fcmToken}),
);
```

#### 2. Handle Notification Click
```dart
FirebaseMessaging.onMessageOpenedApp.listen((message) {
  final notificationId = message.data['notificationId'];
  final navigateTo = message.data['navigateTo'];

  // Navigate to notification details
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => NotificationDetailPage(id: notificationId),
    ),
  );
});
```

---

## 🧪 Testing

### Test Order Notification
```javascript
// In your order controller
const { triggerNotification } = require('./services/notificationSystemService');

await triggerNotification({
  type: 'ORDER_CONFIRMATION',
  userId: '65abc123...',
  title: 'Test Order Confirmed',
  body: 'This is a test notification',
  sendPush: true,
  sendInApp: true,
  metadata: { orderId: 'test123' }
});
```

### Test Admin Post
```bash
# 1. Create draft
curl -X POST http://localhost:3000/api/admin/notifications/create \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "postType": "OFFER",
    "title": "Test Offer",
    "body": "This is a test offer",
    "sendPush": false,
    "sendInApp": true
  }'

# 2. Publish
curl -X POST http://localhost:3000/api/admin/notifications/:id/publish \
  -H "Authorization: Bearer <admin_token>"
```

---

## ✅ Checklist

- [x] User model updated with FCM token
- [x] Firebase configuration created
- [x] Notification models created
- [x] FCM service for push notifications
- [x] Helper functions
- [x] Notification service with trigger function
- [x] Validators
- [x] User controller
- [x] Admin controller
- [x] Routes (user + admin)
- [x] Cron job for scheduled posts
- [x] App.js integration
- [x] S3 image uploads
- [x] Rate limiting
- [x] XSS protection
- [x] Error handling
- [x] Documentation

---

## 🐛 Troubleshooting

### Push Notifications Not Working
1. Check Firebase setup: `serviceAccountKey.json` in root
2. Check user has FCM token: `user.fcmToken` exists
3. Check user preferences: `user.notificationPreferences.pushEnabled = true`
4. Check console logs for FCM errors

### Images Not Uploading
1. Verify AWS credentials in `.env`
2. Check S3 bucket exists and has correct permissions
3. Verify file size < 5MB
4. Check allowed file types: JPG, PNG, WebP

### Scheduled Posts Not Publishing
1. Check cron job is running (console log on startup)
2. Verify `scheduledAt` date is in the past
3. Check notification status is `SCHEDULED`
4. Check console logs for cron errors

---

## 📞 Support

For issues or questions:
1. Check console logs for errors
2. Verify environment variables are set
3. Check Firebase and AWS configurations
4. Review the code in `services/notificationSystemService.js`

---

## 🎉 You're All Set!

The notification system is production-ready and fully integrated. Start using `triggerNotification()` throughout your app!
