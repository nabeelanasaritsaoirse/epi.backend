# Admin Panel Notification System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Notification Flow](#notification-flow)
4. [API Endpoints](#api-endpoints)
5. [Request & Response Examples](#request--response-examples)
6. [Notification Types](#notification-types)
7. [Authentication](#authentication)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)

---

## Overview

The notification system allows admins to create, manage, and send notifications to users. Admins can create different types of posts including offers, announcements, product shares, and system notifications with images, scheduling, and engagement features (likes/comments).

**Base URL**: `https://your-api-domain.com/api/admin/notifications`

---

## Features

### Core Features
- ✅ Create notifications as drafts
- ✅ Upload images to notifications (S3 storage)
- ✅ Publish notifications immediately
- ✅ Schedule notifications for future delivery
- ✅ Edit notifications
- ✅ Soft delete notifications
- ✅ Enable/disable comments and likes
- ✅ Moderate user comments
- ✅ View analytics and engagement metrics
- ✅ Filter and search notifications
- ✅ Send push notifications to all users or specific users

### Notification Delivery Options
- **In-App Only**: Notifications appear in user's notification feed
- **Push Only**: Push notification sent to mobile devices (not saved in feed)
- **In-App + Push**: Notification saved in feed AND push notification sent

---

## Notification Flow

### Creating and Publishing a Notification

```
1. Create Notification (Draft)
   POST /api/admin/notifications/create
   ↓
2. Upload Image (Optional)
   PUT /api/admin/notifications/:id/upload-image
   ↓
3. Choose Publishing Method:

   Option A: Publish Immediately
   POST /api/admin/notifications/:id/publish

   Option B: Schedule for Later
   POST /api/admin/notifications/:id/schedule
```

### Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN CREATES NOTIFICATION (DRAFT STATUS)              │
│ - Choose post type (OFFER/POST/PRODUCT_SHARE)         │
│ - Enter title and body                                 │
│ - Set delivery options (sendInApp/sendPush)           │
│ - Enable/disable comments & likes                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ Upload Image?        │
          └──┬────────────────┬──┘
             │ YES            │ NO
             ▼                │
    ┌────────────────┐        │
    │ Upload Image   │        │
    │ (S3 Storage)   │        │
    └────────┬───────┘        │
             │                │
             └────────┬───────┘
                      ▼
          ┌─────────────────────────┐
          │ Ready to Publish?       │
          └──┬───────────────────┬──┘
             │ NOW                │ SCHEDULE
             ▼                    ▼
    ┌────────────────┐   ┌────────────────────┐
    │ PUBLISH NOW    │   │ SCHEDULE FOR LATER │
    │ Status: PUBLISHED   │ Status: SCHEDULED   │
    └────────┬───────┘   └────────┬───────────┘
             │                    │
             ▼                    ▼
    ┌─────────────────┐   ┌──────────────────┐
    │ Push sent       │   │ Cron job will    │
    │ immediately     │   │ publish at time  │
    └─────────────────┘   └──────────────────┘
```

---

## API Endpoints

### 1. Create Notification (Draft)

**Endpoint**: `POST /api/admin/notifications/create`

**Description**: Create a new notification in draft mode. This does NOT send it to users yet.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "postType": "OFFER",
  "title": "50% Off on All Products!",
  "body": "Limited time offer! Get 50% discount on all products. Shop now and save big!",
  "sendInApp": true,
  "sendPush": true,
  "sendPushOnly": false,
  "commentsEnabled": true,
  "likesEnabled": true,
  "productId": "optional_product_id_for_PRODUCT_SHARE"
}
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| postType | String | Yes | One of: `OFFER`, `POST`, `POST_WITH_IMAGE`, `PRODUCT_SHARE` |
| title | String | Yes | Notification title (max 200 chars) |
| body | String | Yes | Notification body/message (max 5000 chars) |
| sendInApp | Boolean | No | Save in user feed (default: true) |
| sendPush | Boolean | No | Send push notification (default: false) |
| sendPushOnly | Boolean | No | Only push, don't save in feed (default: false) |
| commentsEnabled | Boolean | No | Allow users to comment (default: true) |
| likesEnabled | Boolean | No | Allow users to like (default: true) |
| productId | String | No | Required if postType is `PRODUCT_SHARE` |

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Notification created as draft",
  "data": {
    "notificationId": "NOTIF-1234567890",
    "_id": "mongodb_object_id",
    "status": "DRAFT",
    "nextStep": "Upload image (if needed) then publish or schedule"
  }
}
```

---

### 2. Upload Image to Notification

**Endpoint**: `PUT /api/admin/notifications/:id/upload-image`

**Description**: Upload an image to an existing notification (S3 storage).

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: multipart/form-data
```

**Request** (Form Data):
- `image`: Image file (JPEG, PNG, WebP)
- Max size: 5MB
- Recommended dimensions: 1920px width

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "imageUrl": "https://s3.amazonaws.com/bucket/notifications/image.jpg"
  }
}
```

**Rate Limit**: 10 uploads per hour

---

### 3. Publish Notification Immediately

**Endpoint**: `POST /api/admin/notifications/:id/publish`

**Description**: Publish a draft notification immediately. This sends it to users right away.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification published successfully",
  "data": {
    "success": true,
    "notificationId": "NOTIF-1234567890",
    "pushSent": true,
    "sent": 1245,
    "failed": 5
  }
}
```

**What Happens**:
- Notification status changes from `DRAFT` to `PUBLISHED`
- If `sendPush` or `sendPushOnly` is true, push notifications are sent to all users
- If `sendInApp` is true, notification appears in user feeds
- `publishedAt` timestamp is set

---

### 4. Schedule Notification for Later

**Endpoint**: `POST /api/admin/notifications/:id/schedule`

**Description**: Schedule a notification to be published at a future date/time.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "scheduledAt": "2025-12-25T10:00:00.000Z"
}
```

**Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scheduledAt | String (ISO 8601) | Yes | Must be at least 5 minutes in the future |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification scheduled successfully",
  "data": {
    "notificationId": "NOTIF-1234567890",
    "status": "SCHEDULED",
    "scheduledAt": "2025-12-25T10:00:00.000Z",
    "willPublishIn": "30 days 2 hours 15 minutes"
  }
}
```

**Note**: A cron job runs every minute to check for scheduled notifications and publishes them automatically.

---

### 5. Update Notification

**Endpoint**: `PATCH /api/admin/notifications/:id`

**Description**: Update notification content. Can only update drafts and scheduled notifications.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "body": "Updated body text",
  "commentsEnabled": false,
  "likesEnabled": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification updated successfully",
  "data": {
    "notificationId": "NOTIF-1234567890",
    "updatedFields": ["title", "body", "commentsEnabled"]
  }
}
```

---

### 6. Delete Notification

**Endpoint**: `DELETE /api/admin/notifications/:id`

**Description**: Soft delete a notification (it's marked as deleted, not removed from database).

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Note**: Deleted notifications won't appear in user feeds and status changes to `DELETED`.

---

### 7. Update Notification Settings

**Endpoint**: `PATCH /api/admin/notifications/:id/settings`

**Description**: Toggle comments and likes on/off for a notification.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "commentsEnabled": false,
  "likesEnabled": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "commentsEnabled": false,
    "likesEnabled": true
  }
}
```

---

### 8. Get All Notifications

**Endpoint**: `GET /api/admin/notifications`

**Description**: List all notifications with filtering, search, and pagination.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | Number | No | Page number (default: 1) |
| limit | Number | No | Items per page (default: 20, max: 100) |
| status | String | No | Filter by: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `DELETED` |
| type | String | No | Filter by: `ADMIN_POST`, `SYSTEM_NOTIFICATION` |
| search | String | No | Search in title and body (max 100 chars) |

**Example Request**:
```
GET /api/admin/notifications?page=1&limit=20&status=PUBLISHED&search=offer
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "mongodb_id",
        "notificationId": "NOTIF-1234567890",
        "type": "ADMIN_POST",
        "postType": "OFFER",
        "title": "50% Off on All Products!",
        "body": "Limited time offer...",
        "imageUrl": "https://s3.amazonaws.com/...",
        "status": "PUBLISHED",
        "publishedAt": "2025-11-22T10:00:00.000Z",
        "likeCount": 125,
        "commentCount": 45,
        "viewCount": 1250,
        "commentsEnabled": true,
        "likesEnabled": true,
        "createdBy": {
          "name": "Admin Name",
          "email": "admin@example.com"
        },
        "createdAt": "2025-11-22T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "stats": {
      "totalPublished": 100,
      "totalDrafts": 25,
      "totalScheduled": 15,
      "totalDeleted": 10
    }
  }
}
```

---

### 9. Get Analytics

**Endpoint**: `GET /api/admin/notifications/analytics`

**Description**: Get engagement analytics for published notifications.

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | String (ISO 8601) | No | Filter from date |
| endDate | String (ISO 8601) | No | Filter to date |

**Example Request**:
```
GET /api/admin/notifications/analytics?startDate=2025-11-01T00:00:00.000Z&endDate=2025-11-30T23:59:59.000Z
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalNotifications": 45,
    "totalLikes": 2340,
    "totalComments": 890,
    "totalViews": 15600,
    "averageEngagement": 20.77,
    "topPerformingPost": {
      "notificationId": "NOTIF-1234567890",
      "title": "50% Off on All Products!",
      "likeCount": 340,
      "commentCount": 125,
      "viewCount": 2100,
      "engagementRate": 22.14
    },
    "postsByType": {
      "OFFER": 20,
      "POST": 15,
      "POST_WITH_IMAGE": 8,
      "PRODUCT_SHARE": 2
    }
  }
}
```

---

### 10. Delete Comment (Admin Moderation)

**Endpoint**: `DELETE /api/admin/notifications/:notificationId/comments/:commentId`

**Description**: Delete a user comment as admin (moderation).

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Request Body** (optional):
```json
{
  "reason": "Spam / Inappropriate content"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Comment deleted by admin"
}
```

---

## Notification Types

### Admin Post Types

| Type | Description | Use Case |
|------|-------------|----------|
| `OFFER` | Special offers and discounts | Flash sales, seasonal offers |
| `POST` | General announcements | News, updates, announcements |
| `POST_WITH_IMAGE` | Post with image | Visual announcements, banners |
| `PRODUCT_SHARE` | Share a specific product | Product launches, highlights |

### System Notification Types (Auto-generated)

These are created automatically by the system, not by admin:

- `ORDER_CONFIRMATION` - Order placed successfully
- `ORDER_SHIPPED` - Order shipped
- `ORDER_DELIVERED` - Order delivered
- `ORDER_CANCELLED` - Order cancelled
- `PAYMENT_SUCCESS` - Payment successful
- `PAYMENT_FAILED` - Payment failed
- `PAYMENT_PENDING` - Payment pending
- `WALLET_CREDIT` - Wallet credited
- `WALLET_DEBIT` - Wallet debited
- `COMMISSION_EARNED` - Referral commission earned
- `REFERRAL_JOINED` - New referral joined

---

## Authentication

All admin endpoints require authentication using JWT token with admin privileges.

**How to Authenticate**:

1. Login as admin to get JWT token
2. Include token in Authorization header:
   ```
   Authorization: Bearer <your_jwt_token>
   ```

**Admin Check**: The middleware verifies:
- Valid JWT token
- User exists
- User has `isAdmin: true` flag

---

## Error Handling

### Common Error Responses

**400 Bad Request** - Validation Error:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Title is required",
      "param": "title",
      "location": "body"
    }
  ]
}
```

**401 Unauthorized** - Not authenticated:
```json
{
  "success": false,
  "message": "Authentication token required"
}
```

**403 Forbidden** - Not admin:
```json
{
  "success": false,
  "message": "Admin access required"
}
```

**404 Not Found** - Notification not found:
```json
{
  "success": false,
  "message": "Notification not found"
}
```

**429 Too Many Requests** - Rate limit exceeded:
```json
{
  "success": false,
  "message": "Too many upload requests. Please try again later."
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Failed to create notification",
  "error": "Detailed error message"
}
```

---

## Best Practices

### 1. Notification Creation Workflow

**Recommended Steps**:
1. Create notification as draft
2. Review content carefully
3. Upload image if needed
4. Test with a small group first (if possible)
5. Either publish immediately or schedule for optimal time

### 2. Optimal Publishing Times

- **Offers**: Morning (9-11 AM) or Evening (6-8 PM)
- **Announcements**: During business hours (10 AM - 5 PM)
- **Product Launches**: Mid-week (Tuesday-Thursday)

### 3. Content Guidelines

**Title**:
- Keep it short and catchy (max 50 chars recommended)
- Use emojis sparingly for attention
- Be clear and direct

**Body**:
- First 100 characters are crucial (shown in push notification)
- Use clear call-to-action
- Keep paragraphs short for mobile readability
- Avoid excessive formatting

### 4. Image Guidelines

- **Format**: JPEG, PNG, WebP
- **Size**: Max 5MB (smaller is better for performance)
- **Dimensions**: 1920x1080px recommended
- **Aspect Ratio**: 16:9 works best on most devices
- **Content**: Clear, high-quality, relevant to the message

### 5. Push Notification Best Practices

**When to Send Push**:
- ✅ Important offers (limited time)
- ✅ Flash sales
- ✅ Critical announcements
- ❌ Don't overuse - can lead to users disabling notifications

**Frequency**:
- Maximum 1-2 push notifications per day
- Space them at least 4-6 hours apart
- Monitor opt-out rates

### 6. Engagement Settings

**Enable Comments When**:
- You want user feedback
- Community engagement is desired
- Announcement is discussion-worthy

**Disable Comments When**:
- Pure promotional content
- No need for user interaction
- High spam/moderation risk

**Enable Likes When**:
- You want to gauge interest
- Track popularity of content
- Encourage engagement

### 7. Scheduling Strategy

**Schedule Instead of Immediate Publish When**:
- Targeting specific time zones
- Planning campaign launches
- Coordinating with other marketing channels
- Publishing during off-hours

### 8. Analytics Monitoring

**Key Metrics to Track**:
- **View Count**: How many users saw it
- **Like Count**: Engagement indicator
- **Comment Count**: User interest level
- **Engagement Rate**: (Likes + Comments) / Views × 100

**Healthy Engagement Rates**:
- **Excellent**: > 20%
- **Good**: 10-20%
- **Average**: 5-10%
- **Poor**: < 5% (review content strategy)

### 9. Content Moderation

**When to Delete Comments**:
- Spam or promotional content
- Offensive or inappropriate language
- Off-topic discussions
- Harassment or bullying

**Always Provide Reason**: When deleting comments, include a reason for transparency

### 10. Testing Checklist

Before publishing to all users:
- [ ] Title is clear and error-free
- [ ] Body text is grammatically correct
- [ ] Image loads properly (if included)
- [ ] Links work correctly (if any)
- [ ] Delivery options are set correctly
- [ ] Schedule time is accurate (if scheduling)
- [ ] Comments/likes settings are appropriate

---

## Quick Reference

### Status Flow
```
DRAFT → PUBLISHED
DRAFT → SCHEDULED → PUBLISHED
PUBLISHED → DELETED
```

### Required Headers
```
Authorization: Bearer <token>
Content-Type: application/json (for JSON requests)
Content-Type: multipart/form-data (for image uploads)
```

### Pagination Defaults
- Default page: 1
- Default limit: 20
- Max limit: 100

### Rate Limits
- Image uploads: 10 per hour
- Comment operations: 50 per hour
- Like operations: 100 per hour

---

## Support & Questions

For technical issues or questions:
- Contact backend development team
- Check API logs for detailed error messages
- Review validation errors in response body

**API Version**: v1
**Last Updated**: November 2025
