# Chat System API Documentation - Flutter App Team

## Overview
The chat system enables referrers to communicate with their referred users through:
- **Individual 1-on-1 chats** between referrer and referred user
- **Group broadcasts** from referrer to all their referrals
- **Message types**: Text, Product sharing, Order sharing
- **Real-time features**: Polling for new messages, read receipts, delivery status

## Base URL
```
Production: https://api.epielio.com/api/chat
Development: http://localhost:3000/api/chat
```

## Authentication
All endpoints require Firebase authentication token in the Authorization header:
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

---

## 📱 FLUTTER APP ENDPOINTS

### 1. Get User's Conversations
**Endpoint:** `GET /conversations`

**Description:** Fetch all conversations for the logged-in user with pagination.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number for pagination |
| limit | number | No | 20 | Items per page (max 50) |
| type | string | No | null | Filter by type: 'INDIVIDUAL' or 'GROUP_BROADCAST' |

**Request Example:**
```dart
// Flutter HTTP request
final response = await http.get(
  Uri.parse('$baseUrl/conversations?page=1&limit=20'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "CONV-20250123-0001",
        "type": "INDIVIDUAL",
        "isActive": true,
        "isMuted": false,
        "unreadCount": 3,
        "otherUser": {
          "userId": "user123",
          "name": "John Doe",
          "avatar": "https://...",
          "isOnline": false
        },
        "lastMessage": {
          "text": "Hey, how are you?",
          "timestamp": "2025-01-23T10:30:00Z",
          "senderId": "user123",
          "messageType": "TEXT"
        },
        "createdAt": "2025-01-20T08:00:00Z",
        "updatedAt": "2025-01-23T10:30:00Z"
      },
      {
        "conversationId": "CONV-20250122-0015",
        "type": "GROUP_BROADCAST",
        "groupName": "My Referrals",
        "memberCount": 25,
        "isOwner": true,
        "unreadCount": 0,
        "lastMessage": {
          "text": "Check out this new product!",
          "timestamp": "2025-01-22T15:20:00Z",
          "senderId": "currentUserId",
          "messageType": "PRODUCT_SHARE"
        },
        "createdAt": "2025-01-15T09:00:00Z",
        "updatedAt": "2025-01-22T15:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalConversations": 12,
      "totalPages": 1
    },
    "totalUnreadCount": 3
  }
}
```

---

### 2. Get Messages from Conversation
**Endpoint:** `GET /conversations/:conversationId/messages`

**Description:** Fetch messages from a specific conversation with pagination support.

**Path Parameters:**
- `conversationId` (string, required): The conversation ID

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Messages per page (max 50) |
| beforeMessageId | string | No | null | Load messages before this ID (cursor pagination) |

**Request Example:**
```dart
final conversationId = 'CONV-20250123-0001';
final response = await http.get(
  Uri.parse('$baseUrl/conversations/$conversationId/messages?limit=20'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "conversationId": "CONV-20250123-0001",
      "type": "INDIVIDUAL",
      "participants": [
        {
          "_id": "user1",
          "name": "Alice",
          "profilePicture": "https://..."
        },
        {
          "_id": "user2",
          "name": "Bob",
          "profilePicture": "https://..."
        }
      ],
      "canSendMessage": true
    },
    "messages": [
      {
        "messageId": "MSG-20250123-0045",
        "conversationId": "CONV-20250123-0001",
        "senderId": "user1",
        "senderName": "Alice",
        "senderAvatar": "https://...",
        "messageType": "TEXT",
        "text": "Hello! How are you?",
        "isEdited": false,
        "createdAt": "2025-01-23T10:15:00Z",
        "deliveryStatus": "READ",
        "readAt": "2025-01-23T10:16:00Z"
      },
      {
        "messageId": "MSG-20250123-0046",
        "conversationId": "CONV-20250123-0001",
        "senderId": "user2",
        "senderName": "Bob",
        "senderAvatar": "https://...",
        "messageType": "PRODUCT_SHARE",
        "text": "Check out this product!",
        "sharedProduct": {
          "productId": "prod123",
          "productName": "Amazing Product",
          "productImage": "https://...",
          "productPrice": 299.99,
          "productUrl": "/products/prod123"
        },
        "createdAt": "2025-01-23T10:20:00Z",
        "deliveryStatus": "DELIVERED"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "hasMore": false,
      "oldestMessageId": "MSG-20250123-0045"
    }
  }
}
```

---

### 3. Send Message
**Endpoint:** `POST /conversations/:conversationId/messages`

**Description:** Send a message in a conversation.

**Path Parameters:**
- `conversationId` (string, required): The conversation ID

**Request Body:**
```json
{
  "messageType": "TEXT",
  "text": "Hello! This is my message",
  "replyToMessageId": "MSG-20250123-0045"
}
```

**Message Types & Required Fields:**

#### 3.1 TEXT Message
```json
{
  "messageType": "TEXT",
  "text": "Your message here (max 5000 chars)",
  "replyToMessageId": "MSG-xyz" // Optional: reply to a message
}
```

#### 3.2 PRODUCT_SHARE Message
```json
{
  "messageType": "PRODUCT_SHARE",
  "productId": "prod123",
  "text": "Optional description text"
}
```

#### 3.3 ORDER_SHARE Message
```json
{
  "messageType": "ORDER_SHARE",
  "orderId": "order123",
  "text": "Optional description text"
}
```

**Request Example (Flutter):**
```dart
final body = {
  'messageType': 'TEXT',
  'text': 'Hello! How are you doing?',
};

final response = await http.post(
  Uri.parse('$baseUrl/conversations/$conversationId/messages'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "MSG-20250123-0050",
    "conversationId": "CONV-20250123-0001",
    "senderId": "currentUserId",
    "messageType": "TEXT",
    "text": "Hello! How are you doing?",
    "deliveryStatus": "SENT",
    "createdAt": "2025-01-23T10:30:00Z"
  }
}
```

**Error Responses:**
```json
// 404 - Conversation not found
{
  "success": false,
  "message": "Conversation not found"
}

// 403 - User blocked
{
  "success": false,
  "message": "You are blocked by this user"
}

// 400 - Empty message
{
  "success": false,
  "message": "Text message cannot be empty"
}
```

---

### 4. Create Individual Conversation
**Endpoint:** `POST /conversations/individual`

**Description:** Create or get an existing 1-on-1 conversation with a referred user.

**Request Body:**
```json
{
  "withUserId": "user123"
}
```

**Request Example:**
```dart
final body = {
  'withUserId': 'user123',
};

final response = await http.post(
  Uri.parse('$baseUrl/conversations/individual'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (201 Created or 200 OK):**
```json
{
  "success": true,
  "data": {
    "conversationId": "CONV-20250123-0001",
    "type": "INDIVIDUAL",
    "participants": [
      {
        "_id": "currentUserId",
        "name": "Current User",
        "profilePicture": "https://..."
      },
      {
        "_id": "user123",
        "name": "John Doe",
        "profilePicture": "https://..."
      }
    ],
    "isNewConversation": true
  }
}
```

**Error Response:**
```json
// 403 - No referral relationship
{
  "success": false,
  "message": "No referral relationship exists between users"
}
```

---

### 5. Create Group Broadcast
**Endpoint:** `POST /conversations/group-broadcast`

**Description:** Create a group broadcast to send messages to multiple referrals at once.

**Request Body:**
```json
{
  "groupName": "My Team",
  "memberIds": ["user1", "user2", "user3"]
}
```

**Constraints:**
- Maximum 50 members per group
- All members must be direct referrals of the creator
- Group owner is the only one who can send messages

**Request Example:**
```dart
final body = {
  'groupName': 'My Premium Members',
  'memberIds': ['user1', 'user2', 'user3'],
};

final response = await http.post(
  Uri.parse('$baseUrl/conversations/group-broadcast'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "conversationId": "CONV-20250123-0020",
    "type": "GROUP_BROADCAST",
    "groupName": "My Premium Members",
    "memberCount": 3,
    "members": [
      {
        "userId": "user1",
        "name": "Alice",
        "avatar": "https://..."
      },
      {
        "userId": "user2",
        "name": "Bob",
        "avatar": "https://..."
      },
      {
        "userId": "user3",
        "name": "Charlie",
        "avatar": "https://..."
      }
    ]
  }
}
```

---

### 6. Mark Messages as Read
**Endpoint:** `POST /conversations/:conversationId/mark-read`

**Description:** Mark messages as read to update read receipts and clear unread count.

**Path Parameters:**
- `conversationId` (string, required): The conversation ID

**Request Body:**
```json
{
  "messageIds": ["MSG-001", "MSG-002"]
}
```
*Note: Leave `messageIds` empty array or omit it to mark ALL unread messages as read.*

**Request Example:**
```dart
final body = {
  'messageIds': [], // Empty to mark all as read
};

final response = await http.post(
  Uri.parse('$baseUrl/conversations/$conversationId/mark-read'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Messages marked as read",
  "data": {
    "markedCount": 5,
    "previousUnreadCount": 5,
    "updatedUnreadCount": 0
  }
}
```

---

### 7. Edit Message
**Endpoint:** `PATCH /messages/:messageId`

**Description:** Edit a previously sent TEXT message.

**Constraints:**
- Only TEXT messages can be edited
- Only within 15 minutes of sending
- Only the sender can edit their own messages
- Cannot edit deleted messages

**Path Parameters:**
- `messageId` (string, required): The message ID to edit

**Request Body:**
```json
{
  "text": "Updated message text"
}
```

**Request Example:**
```dart
final body = {
  'text': 'This is the corrected message',
};

final response = await http.patch(
  Uri.parse('$baseUrl/messages/$messageId'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "MSG-20250123-0050",
    "text": "This is the corrected message",
    "isEdited": true,
    "editedAt": "2025-01-23T10:35:00Z"
  }
}
```

**Error Responses:**
```json
// 400 - Too old to edit
{
  "success": false,
  "message": "Messages older than 15 minutes cannot be edited"
}

// 400 - Wrong message type
{
  "success": false,
  "message": "Only text messages can be edited"
}
```

---

### 8. Delete Message
**Endpoint:** `DELETE /messages/:messageId`

**Description:** Soft delete a message (marks as deleted, doesn't remove from database).

**Constraints:**
- Only the sender can delete their own messages
- Cannot delete already deleted messages

**Path Parameters:**
- `messageId` (string, required): The message ID to delete

**Request Body (Optional):**
```json
{
  "reason": "Sent by mistake"
}
```

**Request Example:**
```dart
final response = await http.delete(
  Uri.parse('$baseUrl/messages/$messageId'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

---

### 9. Report Message
**Endpoint:** `POST /messages/:messageId/report`

**Description:** Report a message for spam, abuse, or inappropriate content.

**Path Parameters:**
- `messageId` (string, required): The message ID to report

**Request Body:**
```json
{
  "reason": "SPAM",
  "description": "This user is sending unwanted promotional messages"
}
```

**Report Reasons:**
- `SPAM` - Unwanted promotional content
- `ABUSE` - Abusive or offensive language
- `HARASSMENT` - Harassment or bullying
- `INAPPROPRIATE` - Inappropriate content
- `OTHER` - Other reasons (description required)

**Request Example:**
```dart
final body = {
  'reason': 'SPAM',
  'description': 'Sending unwanted promotional messages repeatedly',
};

final response = await http.post(
  Uri.parse('$baseUrl/messages/$messageId/report'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode(body),
);
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Message reported successfully",
  "data": {
    "reportId": "REP-20250123-1234",
    "status": "PENDING"
  }
}
```

**Error Response:**
```json
// 400 - Already reported
{
  "success": false,
  "message": "You have already reported this message"
}

// 400 - Cannot report own message
{
  "success": false,
  "message": "You cannot report your own messages"
}
```

---

### 10. Get My Referrals for Chat
**Endpoint:** `GET /my-referrals`

**Description:** Get a list of all your referrals that you can chat with.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| search | string | No | null | Search referrals by name |

**Request Example:**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/my-referrals?search=john'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "userId": "user123",
        "name": "John Doe",
        "avatar": "https://...",
        "referredAt": "2025-01-15T10:00:00Z",
        "hasActiveConversation": true,
        "conversationId": "CONV-20250116-0005",
        "totalOrders": 5,
        "isBlocked": false
      },
      {
        "userId": "user456",
        "name": "Jane Smith",
        "avatar": "https://...",
        "referredAt": "2025-01-18T14:30:00Z",
        "hasActiveConversation": false,
        "conversationId": null,
        "totalOrders": 2,
        "isBlocked": false
      }
    ]
  }
}
```

---

### 11. Poll for New Messages
**Endpoint:** `GET /poll`

**Description:** Poll for new messages across all conversations or a specific one.

**Important:** Call this endpoint every 5-10 seconds to check for new messages. This is a lightweight endpoint designed for polling.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| lastPollTime | string (ISO date) | Yes | - | Last poll timestamp |
| conversationId | string | No | null | Specific conversation to poll |

**Request Example:**
```dart
final lastPoll = DateTime.now().subtract(Duration(seconds: 10)).toIso8601String();

final response = await http.get(
  Uri.parse('$baseUrl/poll?lastPollTime=$lastPoll'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "hasNewMessages": true,
    "newMessagesCount": 3,
    "totalUnreadCount": 8,
    "conversations": [
      {
        "conversationId": "CONV-20250123-0001",
        "newMessages": [
          {
            "messageId": "MSG-20250123-0051",
            "senderId": "user123",
            "senderName": "John Doe",
            "messageType": "TEXT",
            "text": "Hey! Are you there?",
            "createdAt": "2025-01-23T10:35:00Z"
          }
        ],
        "updatedUnreadCount": 3
      }
    ]
  }
}
```

**Polling Strategy (Flutter):**
```dart
Timer? _pollingTimer;

void startMessagePolling() {
  _pollingTimer = Timer.periodic(Duration(seconds: 10), (timer) {
    _pollForNewMessages();
  });
}

Future<void> _pollForNewMessages() async {
  final lastPollTime = _lastPollTime ?? DateTime.now().subtract(Duration(minutes: 1));

  try {
    final response = await chatService.pollMessages(lastPollTime);

    if (response['hasNewMessages']) {
      // Update UI with new messages
      _handleNewMessages(response['conversations']);

      // Update badge count
      _updateBadgeCount(response['totalUnreadCount']);
    }

    _lastPollTime = DateTime.now();
  } catch (e) {
    print('Polling error: $e');
  }
}

@override
void dispose() {
  _pollingTimer?.cancel();
  super.dispose();
}
```

---

### 12. Search Messages
**Endpoint:** `GET /search`

**Description:** Search for messages across all your conversations.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Search term (min 2 chars) |
| conversationId | string | No | null | Limit search to specific conversation |
| messageType | string | No | null | Filter by message type |

**Request Example:**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/search?query=product&messageType=PRODUCT_SHARE'),
  headers: {
    'Authorization': 'Bearer $firebaseToken',
    'Content-Type': 'application/json',
  },
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "messageId": "MSG-20250123-0030",
        "conversationId": "CONV-20250122-0010",
        "text": "Check out this amazing product!",
        "matchedText": "Check out this amazing <mark>product</mark>!",
        "sender": {
          "userId": "user123",
          "name": "John Doe",
          "avatar": "https://..."
        },
        "messageType": "PRODUCT_SHARE",
        "createdAt": "2025-01-22T14:20:00Z"
      }
    ]
  }
}
```

---

## 🔔 Rate Limits

The API implements rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Send Message | 50 requests | 1 minute |
| Create Conversation | 20 requests | 5 minutes |
| Report Message | 10 requests | 10 minutes |
| Poll Messages | 20 requests | 1 minute (every 3 seconds) |

**Rate Limit Response (429):**
```json
{
  "success": false,
  "message": "Too many messages sent. Please slow down."
}
```

---

## 🎯 Implementation Checklist for Flutter

### 1. Core Features
- [ ] Display conversation list with unread badges
- [ ] Real-time message polling (every 5-10 seconds)
- [ ] Send text messages
- [ ] Display messages with proper formatting
- [ ] Show message delivery status (SENT, DELIVERED, READ)
- [ ] Mark messages as read when viewing conversation
- [ ] Pull-to-refresh for conversations and messages
- [ ] Pagination for message history

### 2. Advanced Features
- [ ] Share products in chat
- [ ] Share orders in chat
- [ ] Edit messages (within 15 min)
- [ ] Delete messages
- [ ] Reply to messages
- [ ] Search messages
- [ ] Report inappropriate messages
- [ ] Create individual conversations with referrals
- [ ] Create group broadcasts (for referrers only)

### 3. UI/UX Enhancements
- [ ] Show typing indicators (can be added later)
- [ ] Show "edited" label on edited messages
- [ ] Show "[Message deleted]" for deleted messages
- [ ] Timestamp grouping (Today, Yesterday, etc.)
- [ ] Unread message divider
- [ ] Product/Order cards for shared items
- [ ] User avatars and online status
- [ ] Message bubbles (sent vs received)
- [ ] Error handling and retry mechanism

### 4. Notifications
- [ ] Local notifications for new messages (when app is in background)
- [ ] Badge count updates
- [ ] Silent notifications for polling updates

---

## 📝 Sample Flutter Models

```dart
// Conversation Model
class Conversation {
  final String conversationId;
  final ConversationType type;
  final bool isActive;
  final bool isMuted;
  final int unreadCount;
  final User? otherUser; // For individual chats
  final String? groupName; // For group broadcasts
  final int? memberCount;
  final bool? isOwner;
  final Message? lastMessage;
  final DateTime createdAt;
  final DateTime updatedAt;

  Conversation({
    required this.conversationId,
    required this.type,
    required this.isActive,
    required this.isMuted,
    required this.unreadCount,
    this.otherUser,
    this.groupName,
    this.memberCount,
    this.isOwner,
    this.lastMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      conversationId: json['conversationId'],
      type: ConversationType.values.firstWhere(
        (e) => e.toString().split('.').last == json['type'],
      ),
      isActive: json['isActive'],
      isMuted: json['isMuted'],
      unreadCount: json['unreadCount'],
      otherUser: json['otherUser'] != null
        ? User.fromJson(json['otherUser'])
        : null,
      groupName: json['groupName'],
      memberCount: json['memberCount'],
      isOwner: json['isOwner'],
      lastMessage: json['lastMessage'] != null
        ? Message.fromJson(json['lastMessage'])
        : null,
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}

enum ConversationType { INDIVIDUAL, GROUP_BROADCAST }

// Message Model
class Message {
  final String messageId;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String senderAvatar;
  final MessageType messageType;
  final String text;
  final bool isEdited;
  final DateTime? editedAt;
  final DateTime createdAt;
  final DeliveryStatus? deliveryStatus;
  final DateTime? readAt;
  final SharedProduct? sharedProduct;
  final SharedOrder? sharedOrder;
  final ReplyTo? replyTo;
  final bool isDeleted;

  Message({
    required this.messageId,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.senderAvatar,
    required this.messageType,
    required this.text,
    required this.isEdited,
    this.editedAt,
    required this.createdAt,
    this.deliveryStatus,
    this.readAt,
    this.sharedProduct,
    this.sharedOrder,
    this.replyTo,
    this.isDeleted = false,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      messageId: json['messageId'],
      conversationId: json['conversationId'],
      senderId: json['senderId'],
      senderName: json['senderName'],
      senderAvatar: json['senderAvatar'] ?? '',
      messageType: MessageType.values.firstWhere(
        (e) => e.toString().split('.').last == json['messageType'],
      ),
      text: json['text'],
      isEdited: json['isEdited'] ?? false,
      editedAt: json['editedAt'] != null
        ? DateTime.parse(json['editedAt'])
        : null,
      createdAt: DateTime.parse(json['createdAt']),
      deliveryStatus: json['deliveryStatus'] != null
        ? DeliveryStatus.values.firstWhere(
            (e) => e.toString().split('.').last == json['deliveryStatus'],
          )
        : null,
      readAt: json['readAt'] != null
        ? DateTime.parse(json['readAt'])
        : null,
      sharedProduct: json['sharedProduct'] != null
        ? SharedProduct.fromJson(json['sharedProduct'])
        : null,
      sharedOrder: json['sharedOrder'] != null
        ? SharedOrder.fromJson(json['sharedOrder'])
        : null,
      replyTo: json['replyTo'] != null
        ? ReplyTo.fromJson(json['replyTo'])
        : null,
      isDeleted: json['isDeleted'] ?? false,
    );
  }
}

enum MessageType { TEXT, PRODUCT_SHARE, ORDER_SHARE, SYSTEM }
enum DeliveryStatus { SENT, DELIVERED, READ }
```

---

## ⚠️ Important Notes

1. **Referral Relationship Required:** Users can only chat with people they have a referral relationship with (either as referrer or referred user).

2. **Group Broadcast Restrictions:** Only the group owner (referrer) can send messages in group broadcasts. Members can only read.

3. **Message Sanitization:** All text messages are automatically sanitized to prevent XSS attacks. Some HTML tags are allowed (b, i, u, strong, em).

4. **Message Length:** Maximum 5000 characters per message.

5. **Polling Strategy:** Poll every 5-10 seconds for new messages. The API is optimized for this frequency.

6. **Deleted Messages:** Deleted messages show as "[Message deleted]" to all users. They cannot be recovered.

7. **Edit Window:** Messages can only be edited within 15 minutes of sending, and only TEXT messages can be edited.

---

## 🐛 Error Handling

Always handle these common errors in your Flutter app:

```dart
try {
  final response = await chatService.sendMessage(conversationId, messageData);
  // Handle success
} catch (e) {
  if (e is ApiException) {
    switch (e.statusCode) {
      case 400:
        // Bad request - show error to user
        showError(e.message);
        break;
      case 401:
        // Unauthorized - refresh token
        await refreshAuthToken();
        break;
      case 403:
        // Forbidden - user might be blocked
        showError('You cannot send messages to this user');
        break;
      case 404:
        // Not found
        showError('Conversation not found');
        break;
      case 429:
        // Rate limited
        showError('You are sending messages too quickly. Please wait.');
        break;
      case 500:
        // Server error
        showError('Server error. Please try again later.');
        break;
    }
  }
}
```

---

## 📞 Support

For technical issues or questions, contact the backend team or refer to the main API documentation.
