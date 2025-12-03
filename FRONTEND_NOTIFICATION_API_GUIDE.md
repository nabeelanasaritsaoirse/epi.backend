# Frontend Notification API Guide

## Overview
This API allows frontend applications to trigger custom notifications for logged-in users. You can send push notifications to the user's device and/or display in-app notifications.

---

## API Endpoint

### Trigger Custom Notification

**Endpoint:** `POST /api/notifications/trigger`

**Description:** Send a custom notification to the currently logged-in user. You can choose to send it as a push notification, in-app notification, or both.

**Authentication:** Required (JWT Token)

**Rate Limit:** 20 requests per hour per user

---

## Request

### Headers
```http
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

### Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `title` | string | ✅ Yes | - | Notification title (1-200 characters) |
| `message` | string | ✅ Yes | - | Notification message/body (1-1000 characters) |
| `sendPush` | boolean | ❌ No | `false` | Send as push notification to device |
| `sendInApp` | boolean | ❌ No | `true` | Show in app notification feed |

### Request Body Example

```json
{
  "title": "Welcome Back, Nishant!",
  "message": "Thanks for your order! Your items will be delivered soon.",
  "sendPush": true,
  "sendInApp": true
}
```

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": true,
    "pushResult": null
  }
}
```

### Error Responses

#### Validation Error (400 Bad Request)
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

#### Unauthorized (401)
```json
{
  "success": false,
  "message": "Authentication token required"
}
```

#### Rate Limit Exceeded (429)
```json
{
  "success": false,
  "message": "Too many notification requests. Please try again later."
}
```

#### Server Error (500)
```json
{
  "success": false,
  "message": "Failed to trigger notification",
  "error": "Error details here"
}
```

---

## Usage Examples

### Example 1: Send Push + In-App Notification (After Order)

```javascript
async function sendOrderConfirmation(userName) {
  try {
    const response = await fetch('http://13.127.15.87:8080/api/notifications/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: `Thank you, ${userName}!`,
        message: 'Your order has been confirmed and will be delivered soon.',
        sendPush: true,
        sendInApp: true
      })
    });

    const data = await response.json();
    console.log('Notification sent:', data);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Call after order is placed
sendOrderConfirmation('Nishant');
```

### Example 2: Send Only In-App Notification (After Login)

```javascript
async function sendWelcomeNotification(userName) {
  try {
    const response = await fetch('http://13.127.15.87:8080/api/notifications/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: `Welcome back, ${userName}! 👋`,
        message: 'Check out the latest deals and offers just for you.',
        sendPush: false,  // Don't send push notification
        sendInApp: true   // Only show in app
      })
    });

    const data = await response.json();
    if (data.success) {
      console.log('Welcome notification created');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call after successful login
sendWelcomeNotification('Nishant');
```

### Example 3: Send Only Push Notification (Urgent Alert)

```javascript
async function sendUrgentAlert() {
  try {
    const response = await fetch('http://13.127.15.87:8080/api/notifications/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        title: '⚡ Flash Sale Alert!',
        message: 'Limited time offer: 50% OFF on all products. Shop now!',
        sendPush: true,   // Send push to device
        sendInApp: false  // Don't show in notification feed
      })
    });

    const data = await response.json();
    console.log('Push notification sent:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Example 4: Using Axios (React/Vue)

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://13.127.15.87:8080';

// Set up axios with auth token
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Send notification
async function triggerNotification(title, message, options = {}) {
  try {
    const response = await api.post('/api/notifications/trigger', {
      title,
      message,
      sendPush: options.sendPush || false,
      sendInApp: options.sendInApp !== false  // Default true
    });

    return response.data;
  } catch (error) {
    console.error('Notification error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage examples
// 1. After order
triggerNotification(
  'Order Confirmed! 🎉',
  'Your order #12345 has been confirmed. Track your order in the Orders section.',
  { sendPush: true, sendInApp: true }
);

// 2. After login
triggerNotification(
  'Welcome Back!',
  'Great to see you again. Continue shopping where you left off.',
  { sendPush: false, sendInApp: true }
);

// 3. Payment success
triggerNotification(
  'Payment Successful ✅',
  'Your payment of ₹1,499 has been received successfully.',
  { sendPush: true, sendInApp: true }
);
```

### Example 5: Using Fetch with Async/Await (Flutter/Dart)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> sendNotification({
  required String title,
  required String message,
  bool sendPush = false,
  bool sendInApp = true,
  required String token,
}) async {
  final url = Uri.parse('http://13.127.15.87:8080/api/notifications/trigger');

  try {
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'title': title,
        'message': message,
        'sendPush': sendPush,
        'sendInApp': sendInApp,
      }),
    );

    final data = jsonDecode(response.body);

    if (response.statusCode == 200 && data['success']) {
      print('Notification sent: ${data['message']}');
    } else {
      print('Error: ${data['message']}');
    }
  } catch (e) {
    print('Failed to send notification: $e');
  }
}

// Usage
await sendNotification(
  title: 'Thank you for your order!',
  message: 'Your order has been confirmed and will arrive soon.',
  sendPush: true,
  sendInApp: true,
  token: userAuthToken,
);
```

---

## Common Use Cases

### 1. After User Login
```javascript
{
  "title": "Welcome back, [Name]! 👋",
  "message": "We've added new products you might like. Check them out!",
  "sendPush": false,
  "sendInApp": true
}
```

### 2. After Order Placed
```javascript
{
  "title": "Order Confirmed! 🎉",
  "message": "Thank you for your order! We're preparing your items for delivery.",
  "sendPush": true,
  "sendInApp": true
}
```

### 3. After Payment Success
```javascript
{
  "title": "Payment Received ✅",
  "message": "Your payment of ₹[amount] has been processed successfully.",
  "sendPush": true,
  "sendInApp": true
}
```

### 4. Promotional Messages
```javascript
{
  "title": "🔥 Special Offer Just for You!",
  "message": "Get 30% OFF on your next purchase. Use code: SPECIAL30",
  "sendPush": true,
  "sendInApp": true
}
```

### 5. Delivery Updates
```javascript
{
  "title": "Your order is on the way! 🚚",
  "message": "Your order will be delivered today between 2-5 PM.",
  "sendPush": true,
  "sendInApp": true
}
```

### 6. Wallet Credit
```javascript
{
  "title": "Wallet Credited! 💰",
  "message": "₹[amount] has been added to your wallet. Happy shopping!",
  "sendPush": true,
  "sendInApp": true
}
```

---

## Important Notes

### ⚠️ Requirements

1. **Authentication Required**: User must be logged in with a valid JWT token
2. **FCM Token**: For push notifications to work, user must have registered their device FCM token via `/api/notifications/register-token`
3. **Notification Preferences**: User's notification settings must have push enabled
4. **Rate Limiting**: Maximum 20 notification triggers per hour per user

### 📱 Push Notification Setup

Before push notifications work, users must:

1. **Register FCM Token** (one time per device):
```javascript
// Register device token for push notifications
await fetch('http://13.127.15.87:8080/api/notifications/register-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    fcmToken: 'device_fcm_token_here'
  })
});
```

2. **Enable notification permissions** in their device settings

### 🔔 In-App Notifications

In-app notifications are automatically saved to the database and can be retrieved using:

**Get Notification Feed:**
```javascript
GET /api/notifications
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "title": "Welcome back!",
        "body": "Check out new products",
        "type": "SYSTEM_NOTIFICATION",
        "createdAt": "2025-12-03T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

---

## Best Practices

1. **Keep messages concise**: Title max 200 chars, message max 1000 chars
2. **Use emojis sparingly**: Add personality but don't overdo it
3. **Personalize messages**: Use user's name when possible
4. **Choose notification type wisely**:
   - Important updates: `sendPush: true, sendInApp: true`
   - Info only: `sendPush: false, sendInApp: true`
   - Urgent alerts: `sendPush: true, sendInApp: false`
5. **Handle errors gracefully**: Always wrap API calls in try-catch
6. **Respect rate limits**: Don't spam users with too many notifications

---

## Testing

### Test with cURL

```bash
curl -X POST http://13.127.15.87:8080/api/notifications/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test message",
    "sendPush": true,
    "sendInApp": true
  }'
```

### Test Tokens Available

**User 1:**
```
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFhZjM4OTQxNWEzZDA3N2MzYmIxNTQiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDYxMjE3MiwiZXhwIjoxNzY1MjE2OTcyfQ.17eA30HF8teTB3-3G-NNYWLPr1bj4nK4cbeb3NP10v8
User ID: 691af389415a3d077c3bb154
Valid until: December 8, 2025
```

**User 2:**
```
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTFkNmQ4Mzk2MjU0MmJmNDEyMGYzNTciLCJyb2xlIjoidXNlciIsImlhdCI6MTc2NDY1MTg0NiwiZXhwIjoxNzY1MjU2NjQ2fQ.ZJ1wmE1aBdD-CfbK2GV4KfwNc2V-tFg2Qpt8YxmCMUg
User ID: 691d6d83962542bf4120f357
Valid until: December 9, 2025
```

---

## Troubleshooting

### Problem: "Authentication token required"
**Solution**: Make sure you're including the Authorization header with a valid JWT token

### Problem: "Too many notification requests"
**Solution**: You've exceeded the rate limit (20 per hour). Wait before trying again.

### Problem: "Validation failed"
**Solution**: Check that title and message meet length requirements:
- Title: 1-200 characters
- Message: 1-1000 characters

### Problem: Push notification not received on device
**Solution**:
1. Check if user has registered FCM token
2. Verify user has enabled push notifications in preferences
3. Check device notification permissions
4. Verify Firebase is configured correctly on server

---

## Support

If you encounter any issues or need help integrating this API:

1. Check the error message in the API response
2. Verify your authentication token is valid
3. Ensure request body parameters are correct
4. Contact the backend team for server-side issues

---

## API Base URL

**Production:** `http://13.127.15.87:8080`

**Endpoint:** `POST /api/notifications/trigger`

---

## Summary

✅ **Simple Integration**: Just send title and message
✅ **Flexible**: Choose push, in-app, or both
✅ **Real-time**: Notifications delivered instantly
✅ **User-friendly**: Users only receive their own notifications
✅ **Rate-limited**: Protected against spam

Start integrating notifications into your frontend app today! 🚀
