# Notification API - Quick Reference

## 🚀 Trigger Custom Notification

### Endpoint
```
POST http://13.127.15.87:8080/api/notifications/trigger
```

### Request
```javascript
{
  "title": "Your notification title here",
  "message": "Your notification message here",
  "sendPush": true,   // Send to device (optional, default: false)
  "sendInApp": true   // Show in app (optional, default: true)
}
```

### Headers
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

### Response
```javascript
{
  "success": true,
  "message": "Notification triggered successfully",
  "data": {
    "sentPush": true,
    "sentInApp": true
  }
}
```

---

## 📝 Quick Examples

### After Login
```javascript
fetch('http://13.127.15.87:8080/api/notifications/trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Welcome back, Nishant!',
    message: 'Great to see you again!',
    sendPush: false,
    sendInApp: true
  })
});
```

### After Order
```javascript
fetch('http://13.127.15.87:8080/api/notifications/trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Thank you for your order! 🎉',
    message: 'Your order will be delivered soon.',
    sendPush: true,
    sendInApp: true
  })
});
```

---

## ⚙️ Parameters

| Parameter | Type | Required | Default | Max Length |
|-----------|------|----------|---------|------------|
| title | string | Yes | - | 200 chars |
| message | string | Yes | - | 1000 chars |
| sendPush | boolean | No | false | - |
| sendInApp | boolean | No | true | - |

---

## 🔒 Important

- ✅ User must be logged in
- ✅ Rate limit: 20 requests/hour
- ✅ For push: User needs FCM token registered
- ✅ User receives only their own notification

---

## 📖 Full Documentation

See [FRONTEND_NOTIFICATION_API_GUIDE.md](./FRONTEND_NOTIFICATION_API_GUIDE.md) for complete documentation with all examples and use cases.
