# Notification API Reference

Quick reference for all notification endpoints.

---

## 🔐 Authentication

All endpoints require authentication:
```
Authorization: Bearer <token>
```

Admin endpoints additionally require `role: 'admin'`

---

## 👤 USER ENDPOINTS

Base URL: `/api/notifications`

### Get Notification Feed
```http
GET /api/notifications
Query: page, limit, type
Auth: Required
```

### Get Single Notification
```http
GET /api/notifications/:id
Auth: Required
```

### Like/Unlike Notification
```http
POST /api/notifications/:id/like
Auth: Required
Rate Limit: 100/hour
```

### Add Comment
```http
POST /api/notifications/:id/comments
Body: { text: string }
Auth: Required
Rate Limit: 50/hour
```

### Get Comments
```http
GET /api/notifications/:id/comments
Query: page, limit
Auth: Required
```

### Delete Own Comment
```http
DELETE /api/notifications/:notificationId/comments/:commentId
Auth: Required
```

### Mark as Read
```http
POST /api/notifications/:id/mark-read
Auth: Required
```

### Get Unread Count
```http
GET /api/notifications/unread-count
Auth: Required
```

### Register FCM Token
```http
POST /api/notifications/register-token
Body: { fcmToken: string }
Auth: Required
```

### Remove FCM Token
```http
POST /api/notifications/remove-token
Auth: Required
```

### Update Preferences
```http
PUT /api/notifications/preferences
Body: {
  pushEnabled?: boolean,
  orderUpdates?: boolean,
  promotionalOffers?: boolean,
  paymentAlerts?: boolean,
  systemNotifications?: boolean
}
Auth: Required
```

---

## 👑 ADMIN ENDPOINTS

Base URL: `/api/admin/notifications`

### Create Notification
```http
POST /api/admin/notifications/create
Body: {
  postType: 'OFFER' | 'POST' | 'POST_WITH_IMAGE' | 'PRODUCT_SHARE',
  title: string,
  body: string,
  productId?: string,
  sendInApp?: boolean,
  sendPush?: boolean,
  sendPushOnly?: boolean,
  commentsEnabled?: boolean,
  likesEnabled?: boolean
}
Auth: Admin
```

### Upload Image
```http
PUT /api/admin/notifications/:id/upload-image
Body: multipart/form-data { image: file }
Auth: Admin
Rate Limit: 10/hour
```

### Publish Notification
```http
POST /api/admin/notifications/:id/publish
Auth: Admin
```

### Schedule Notification
```http
POST /api/admin/notifications/:id/schedule
Body: { scheduledAt: ISO8601 date string }
Auth: Admin
```

### Update Notification
```http
PATCH /api/admin/notifications/:id
Body: {
  title?: string,
  body?: string,
  commentsEnabled?: boolean,
  likesEnabled?: boolean
}
Auth: Admin
```

### Delete Notification
```http
DELETE /api/admin/notifications/:id
Auth: Admin
```

### Update Settings
```http
PATCH /api/admin/notifications/:id/settings
Body: {
  commentsEnabled?: boolean,
  likesEnabled?: boolean
}
Auth: Admin
```

### Delete Comment (Moderation)
```http
DELETE /api/admin/notifications/:notificationId/comments/:commentId
Body: { reason?: string }
Auth: Admin
```

### Get All Notifications
```http
GET /api/admin/notifications
Query: page, limit, status, type, search
Auth: Admin
```

### Get Analytics
```http
GET /api/admin/notifications/analytics
Query: startDate, endDate
Auth: Admin
```

---

## 🔧 TRIGGER FUNCTION (Server-Side Only)

```javascript
const { triggerNotification } = require('./services/notificationSystemService');

await triggerNotification({
  type: string,              // System notification type
  userId: string | string[], // User ID(s)
  title: string,            // Notification title
  body: string,             // Notification body
  sendPush?: boolean,       // Send push notification
  sendInApp?: boolean,      // Add to in-app feed
  metadata?: object         // Additional data
});
```

**System Notification Types:**
- `ORDER_CONFIRMATION`
- `ORDER_SHIPPED`
- `ORDER_DELIVERED`
- `ORDER_CANCELLED`
- `PAYMENT_SUCCESS`
- `PAYMENT_FAILED`
- `PAYMENT_PENDING`
- `DELIVERY_UPDATE`
- `WALLET_CREDIT`
- `WALLET_DEBIT`
- `COMMISSION_EARNED`
- `REFERRAL_JOINED`
- `KYC_APPROVED`
- `KYC_REJECTED`
- `GENERAL`

---

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

### Notification Object
```json
{
  "notificationId": "NOTIF-20241120-0001",
  "_id": "65abc123...",
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
  "publishedAt": "2024-11-20T10:00:00Z",
  "createdBy": {
    "_id": "...",
    "name": "Admin",
    "avatar": "..."
  }
}
```

### Pagination Object
```json
{
  "page": 1,
  "limit": 20,
  "total": 150,
  "totalPages": 8,
  "hasMore": true
}
```

---

## 🔒 Rate Limits

- **Like:** 100 requests/hour
- **Comment:** 50 requests/hour
- **Image Upload:** 10 requests/hour

---

## ⚠️ Validation Rules

### Create Notification
- `title`: 1-200 characters
- `body`: 1-5000 characters
- `productId`: Valid MongoDB ObjectId (if PRODUCT_SHARE)

### Add Comment
- `text`: 1-1000 characters
- No URLs allowed
- XSS sanitized

### Schedule Date
- Must be ISO 8601 format
- Must be at least 5 minutes in future

### Image Upload
- Max size: 5MB
- Allowed types: JPG, PNG, WebP
- Auto-resized to 1920px width

---

## 📱 HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden / Admin Required
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Server Error

---

## 💡 Examples

### JavaScript/Node.js
```javascript
const response = await fetch('http://localhost:3000/api/notifications', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

### cURL
```bash
curl -X GET http://localhost:3000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Flutter/Dart
```dart
final response = await http.get(
  Uri.parse('$apiUrl/api/notifications'),
  headers: {'Authorization': 'Bearer $token'},
);
final data = json.decode(response.body);
```

### React Native
```javascript
const response = await fetch(`${API_URL}/api/notifications`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## 🎯 Quick Examples

**Get feed:**
```bash
GET /api/notifications?page=1&limit=20
```

**Like post:**
```bash
POST /api/notifications/65abc123/like
```

**Add comment:**
```bash
POST /api/notifications/65abc123/comments
Body: { "text": "Great offer!" }
```

**Create admin post:**
```bash
POST /api/admin/notifications/create
Body: {
  "postType": "OFFER",
  "title": "Sale!",
  "body": "50% off"
}
```

**Publish:**
```bash
POST /api/admin/notifications/65abc123/publish
```

---

That's the complete API reference! For detailed examples, see [Integration Examples](./NOTIFICATION_INTEGRATION_EXAMPLES.md).
