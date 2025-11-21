# 📋 Chat API Endpoints - Quick Reference

## Authentication

All user endpoints require Firebase authentication token:
```
Authorization: Bearer <firebase_id_token>
```

All admin endpoints require JWT token:
```
Authorization: Bearer <admin_jwt_token>
```

---

## 👤 USER ENDPOINTS

### Base URL: `/api/chat`

#### 1. **GET** `/conversations`
Get user's conversation list
- **Query:** `?page=1&limit=20&type=INDIVIDUAL`
- **Rate Limit:** None
- **Returns:** List of conversations with unread counts

#### 2. **GET** `/conversations/:conversationId/messages`
Get messages from a conversation
- **Query:** `?page=1&limit=20&beforeMessageId=MSG-xxx`
- **Rate Limit:** None
- **Returns:** Paginated messages

#### 3. **POST** `/conversations/:conversationId/messages`
Send a message
- **Body:** `{ messageType, text, productId?, orderId?, replyToMessageId? }`
- **Rate Limit:** 50/min
- **Returns:** Created message

#### 4. **POST** `/conversations/individual`
Create/get individual conversation
- **Body:** `{ withUserId }`
- **Rate Limit:** 20/5min
- **Returns:** Conversation object

#### 5. **POST** `/conversations/group-broadcast`
Create group broadcast
- **Body:** `{ groupName?, memberIds }`
- **Rate Limit:** 20/5min
- **Returns:** Group conversation

#### 6. **POST** `/conversations/:conversationId/mark-read`
Mark messages as read
- **Body:** `{ messageIds: [] }` (empty = all)
- **Rate Limit:** None
- **Returns:** Updated counts

#### 7. **PATCH** `/messages/:messageId`
Edit a message
- **Body:** `{ text }`
- **Rate Limit:** None
- **Restrictions:** Own messages, <15min, TEXT only
- **Returns:** Updated message

#### 8. **DELETE** `/messages/:messageId`
Delete a message (soft delete)
- **Body:** `{ reason? }`
- **Rate Limit:** None
- **Returns:** Success

#### 9. **POST** `/messages/:messageId/report`
Report a message
- **Body:** `{ reason, description }`
- **Rate Limit:** 10/10min
- **Reasons:** SPAM, ABUSE, HARASSMENT, INAPPROPRIATE, OTHER
- **Returns:** Report ID

#### 10. **GET** `/my-referrals`
Get user's referrals for chat
- **Query:** `?search=john`
- **Rate Limit:** None
- **Returns:** List of referrals

#### 11. **GET** `/poll`
Poll for new messages
- **Query:** `?lastPollTime=2024-11-21T10:00:00Z&conversationId=xxx`
- **Rate Limit:** 20/min (every 3 sec)
- **Returns:** New messages since last poll

#### 12. **GET** `/search`
Search messages
- **Query:** `?query=text&conversationId=xxx&messageType=TEXT`
- **Rate Limit:** None
- **Returns:** Search results with highlights

---

## 👨‍💼 ADMIN ENDPOINTS

### Base URL: `/api/admin/chat`

#### 1. **GET** `/conversations`
Get all conversations
- **Query:** `?search=john&type=INDIVIDUAL&page=1&limit=20`
- **Returns:** All conversations with metadata

#### 2. **GET** `/conversations/:conversationId/messages`
View conversation messages (includes deleted)
- **Query:** `?page=1&limit=50`
- **Returns:** All messages (including deleted)

#### 3. **GET** `/reports`
Get reported messages
- **Query:** `?status=PENDING&page=1&limit=20`
- **Returns:** Reports with details

#### 4. **POST** `/reports/:reportId/action`
Take action on report
- **Body:** `{ action, adminNotes, deleteMessage? }`
- **Actions:** MESSAGE_DELETED, USER_WARNED, USER_BLOCKED, NO_ACTION
- **Returns:** Updated report

#### 5. **DELETE** `/messages/:messageId`
Delete message as admin
- **Body:** `{ reason }`
- **Returns:** Success

#### 6. **POST** `/broadcast`
Send broadcast to users
- **Body:** `{ messageType, text, productId?, targetUsers, specificUserIds? }`
- **Targets:** ALL, ACTIVE_ORDERS, SPECIFIC
- **Returns:** Sent count

#### 7. **GET** `/analytics`
Get chat analytics
- **Query:** `?startDate=2024-11-01&endDate=2024-11-21`
- **Returns:** Statistics and insights

---

## 📝 Request Body Examples

### Send Text Message
```json
{
  "messageType": "TEXT",
  "text": "Hello! How are you?"
}
```

### Share Product
```json
{
  "messageType": "PRODUCT_SHARE",
  "productId": "6741a7f8e8c9d1234567890a",
  "text": "Check out this amazing product!"
}
```

### Share Order
```json
{
  "messageType": "ORDER_SHARE",
  "orderId": "6741a7f8e8c9d1234567890b",
  "text": "Here's my recent order"
}
```

### Create Individual Chat
```json
{
  "withUserId": "6741a7f8e8c9d1234567890c"
}
```

### Create Group Broadcast
```json
{
  "groupName": "My Team",
  "memberIds": ["user1_id", "user2_id", "user3_id"]
}
```

### Mark as Read
```json
{
  "messageIds": ["MSG-20241121-0001", "MSG-20241121-0002"]
}
```
or
```json
{
  "messageIds": []
}
```

### Edit Message
```json
{
  "text": "Updated message text"
}
```

### Delete Message
```json
{
  "reason": "Posted by mistake"
}
```

### Report Message
```json
{
  "reason": "SPAM",
  "description": "This message contains spam links and promotional content"
}
```

### Admin Take Action
```json
{
  "action": "MESSAGE_DELETED",
  "adminNotes": "Message violated community guidelines - contains spam",
  "deleteMessage": true
}
```

### Admin Broadcast
```json
{
  "messageType": "TEXT",
  "text": "Important system announcement: Scheduled maintenance tonight",
  "targetUsers": "ALL"
}
```

---

## ✅ Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## 🚦 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Server Error |

---

## 🔒 Rate Limits

| Endpoint | Limit |
|----------|-------|
| Send Message | 50 requests/minute |
| Create Conversation | 20 requests/5 minutes |
| Report Message | 10 requests/10 minutes |
| Poll Messages | 20 requests/minute |
| Other Endpoints | No limit |

---

## 📌 Important Notes

1. **Message IDs:** Format `MSG-YYYYMMDD-XXXX` (e.g., `MSG-20241121-0001`)
2. **Conversation IDs:** Format `CONV-YYYYMMDD-XXXX` (e.g., `CONV-20241121-0001`)
3. **Report IDs:** Format `REP-YYYYMMDD-XXXX` (e.g., `REP-20241121-0001`)
4. **Timestamps:** ISO 8601 format (e.g., `2024-11-21T10:30:00Z`)
5. **MongoDB IDs:** 24-character hex string (e.g., `6741a7f8e8c9d1234567890a`)

---

## 🧪 Postman Testing

Import this quick collection:

```json
{
  "info": {
    "name": "Chat API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "firebaseToken",
      "value": "your-firebase-token-here"
    }
  ]
}
```

Set your `firebaseToken` variable after login.

---

## 🎯 Testing Order

1. **GET** `/my-referrals` - Get list of people you can chat with
2. **POST** `/conversations/individual` - Start a chat
3. **POST** `/conversations/:id/messages` - Send a message
4. **GET** `/conversations/:id/messages` - View messages
5. **GET** `/poll` - Poll for new messages
6. **POST** `/conversations/:id/mark-read` - Mark as read

---

**All endpoints are ready to use!** 🚀
