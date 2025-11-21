# 🚀 Chat System - Quick Start Guide

## For Frontend Developers

This guide will help you integrate the messaging system into your Flutter app in **15 minutes**.

---

## 📋 Prerequisites

1. Firebase authentication token from your existing auth system
2. User must be logged in
3. Base API URL: `https://your-api-domain.com`

---

## 🎯 Core Integration Flow

### Step 1: Get User's Conversations (Chat List)

```dart
Future<List<Conversation>> getConversations() async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/chat/conversations?page=1&limit=20'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['data']['conversations'] as List)
        .map((c) => Conversation.fromJson(c))
        .toList();
  }
  throw Exception('Failed to load conversations');
}
```

**Response Preview:**
```json
{
  "conversations": [{
    "conversationId": "CONV-20241121-0001",
    "type": "INDIVIDUAL",
    "otherUser": {
      "userId": "xxx",
      "name": "John Doe",
      "avatar": "url"
    },
    "lastMessage": {
      "text": "Hey!",
      "timestamp": "2024-11-21T10:30:00Z"
    },
    "unreadCount": 5
  }]
}
```

---

### Step 2: Start a Chat with a Referral

```dart
Future<String> startChatWithReferral(String referralUserId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/chat/conversations/individual'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'withUserId': referralUserId,
    }),
  );

  if (response.statusCode == 200 || response.statusCode == 201) {
    final data = json.decode(response.body);
    return data['data']['conversationId']; // "CONV-20241121-0001"
  }
  throw Exception('Failed to create conversation');
}
```

---

### Step 3: Load Messages

```dart
Future<List<Message>> getMessages(String conversationId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.get(
    Uri.parse('$baseUrl/api/chat/conversations/$conversationId/messages?page=1&limit=50'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['data']['messages'] as List)
        .map((m) => Message.fromJson(m))
        .toList();
  }
  throw Exception('Failed to load messages');
}
```

---

### Step 4: Send a Text Message

```dart
Future<void> sendMessage(String conversationId, String text) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  final response = await http.post(
    Uri.parse('$baseUrl/api/chat/conversations/$conversationId/messages'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'messageType': 'TEXT',
      'text': text,
    }),
  );

  if (response.statusCode != 201) {
    throw Exception('Failed to send message');
  }
}
```

---

### Step 5: Poll for New Messages

```dart
Timer? _pollTimer;

void startPolling(String conversationId) {
  DateTime lastPollTime = DateTime.now();

  _pollTimer = Timer.periodic(Duration(seconds: 5), (timer) async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();

    final response = await http.get(
      Uri.parse(
        '$baseUrl/api/chat/poll'
        '?lastPollTime=${lastPollTime.toIso8601String()}'
        '&conversationId=$conversationId'
      ),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['data']['hasNewMessages'] == true) {
        // Update UI with new messages
        final newMessages = data['data']['conversations'][0]['newMessages'];
        updateChatUI(newMessages);
      }
      lastPollTime = DateTime.now();
    }
  });
}

@override
void dispose() {
  _pollTimer?.cancel();
  super.dispose();
}
```

---

### Step 6: Mark Messages as Read

```dart
Future<void> markMessagesAsRead(String conversationId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.post(
    Uri.parse('$baseUrl/api/chat/conversations/$conversationId/mark-read'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'messageIds': [], // Empty array marks all as read
    }),
  );
}
```

---

## 🎨 Advanced Features

### Share a Product

```dart
Future<void> shareProduct(String conversationId, String productId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.post(
    Uri.parse('$baseUrl/api/chat/conversations/$conversationId/messages'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'messageType': 'PRODUCT_SHARE',
      'productId': productId,
      'text': 'Check out this product!',
    }),
  );
}
```

### Share an Order

```dart
Future<void> shareOrder(String conversationId, String orderId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.post(
    Uri.parse('$baseUrl/api/chat/conversations/$conversationId/messages'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'messageType': 'ORDER_SHARE',
      'orderId': orderId,
      'text': 'Here is my order',
    }),
  );
}
```

### Edit a Message

```dart
Future<void> editMessage(String messageId, String newText) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.patch(
    Uri.parse('$baseUrl/api/chat/messages/$messageId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'text': newText,
    }),
  );
}
```

### Delete a Message

```dart
Future<void> deleteMessage(String messageId) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.delete(
    Uri.parse('$baseUrl/api/chat/messages/$messageId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'reason': 'Posted by mistake',
    }),
  );
}
```

### Report a Message

```dart
Future<void> reportMessage(String messageId, String reason, String description) async {
  final token = await FirebaseAuth.instance.currentUser?.getIdToken();

  await http.post(
    Uri.parse('$baseUrl/api/chat/messages/$messageId/report'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'reason': reason, // 'SPAM', 'ABUSE', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER'
      'description': description,
    }),
  );
}
```

---

## 📱 Data Models (Dart)

```dart
class Conversation {
  final String conversationId;
  final String type; // 'INDIVIDUAL' or 'GROUP_BROADCAST'
  final User? otherUser;
  final LastMessage? lastMessage;
  final int unreadCount;
  final bool isMuted;

  Conversation({
    required this.conversationId,
    required this.type,
    this.otherUser,
    this.lastMessage,
    required this.unreadCount,
    required this.isMuted,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      conversationId: json['conversationId'],
      type: json['type'],
      otherUser: json['otherUser'] != null
          ? User.fromJson(json['otherUser'])
          : null,
      lastMessage: json['lastMessage'] != null
          ? LastMessage.fromJson(json['lastMessage'])
          : null,
      unreadCount: json['unreadCount'] ?? 0,
      isMuted: json['isMuted'] ?? false,
    );
  }
}

class Message {
  final String messageId;
  final String senderId;
  final String senderName;
  final String senderAvatar;
  final String messageType;
  final String text;
  final ProductShare? sharedProduct;
  final OrderShare? sharedOrder;
  final String deliveryStatus;
  final bool isEdited;
  final bool isDeleted;
  final DateTime createdAt;

  Message({
    required this.messageId,
    required this.senderId,
    required this.senderName,
    required this.senderAvatar,
    required this.messageType,
    required this.text,
    this.sharedProduct,
    this.sharedOrder,
    required this.deliveryStatus,
    required this.isEdited,
    required this.isDeleted,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      messageId: json['messageId'],
      senderId: json['senderId'],
      senderName: json['senderName'],
      senderAvatar: json['senderAvatar'] ?? '',
      messageType: json['messageType'],
      text: json['text'] ?? '',
      sharedProduct: json['sharedProduct'] != null
          ? ProductShare.fromJson(json['sharedProduct'])
          : null,
      sharedOrder: json['sharedOrder'] != null
          ? OrderShare.fromJson(json['sharedOrder'])
          : null,
      deliveryStatus: json['deliveryStatus'] ?? 'SENT',
      isEdited: json['isEdited'] ?? false,
      isDeleted: json['isDeleted'] ?? false,
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

class ProductShare {
  final String productId;
  final String productName;
  final String productImage;
  final double productPrice;
  final String productUrl;

  ProductShare({
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.productPrice,
    required this.productUrl,
  });

  factory ProductShare.fromJson(Map<String, dynamic> json) {
    return ProductShare(
      productId: json['productId'],
      productName: json['productName'],
      productImage: json['productImage'],
      productPrice: (json['productPrice'] ?? 0).toDouble(),
      productUrl: json['productUrl'],
    );
  }
}
```

---

## 🎯 UI Flow Recommendations

### 1. Chat List Screen
- Show conversation list with last message preview
- Display unread badge count
- Pull to refresh conversations
- Tap to open individual chat

### 2. Individual Chat Screen
- Load messages on open
- Start polling for new messages
- Show typing indicator when user is typing
- Mark as read when user scrolls to bottom
- Long press for edit/delete/report options

### 3. Referrals Screen
- Show list of user's referrals
- Each referral has "Chat" button
- Tapping "Chat" creates conversation and navigates to chat screen

### 4. Product Detail Screen
- Add "Share" button
- Show list of conversations
- Select conversation to share to

---

## ⚠️ Important Notes

1. **Polling Frequency**: Call poll endpoint every **5-10 seconds** (not faster, rate limited)
2. **Authentication**: Always include Firebase token in Authorization header
3. **Error Handling**: Check for 401 (token expired) and refresh token
4. **Rate Limits**:
   - 50 messages per minute
   - 20 conversation creations per 5 minutes
5. **Message Editing**: Only allowed within **15 minutes** of sending
6. **Message Types**: TEXT, PRODUCT_SHARE, ORDER_SHARE, SYSTEM

---

## 🐛 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 403 - No referral relationship | Not a direct referral | Check referral status |
| 403 - You are blocked | User blocked you | Show error message |
| 429 - Too many requests | Rate limit hit | Slow down requests |
| 401 - Invalid token | Token expired | Refresh Firebase token |
| 400 - Message too old | > 15 min | Cannot edit |

---

## ✅ Testing Checklist

- [ ] Display conversation list
- [ ] Start new chat with referral
- [ ] Send text message
- [ ] Receive messages (polling works)
- [ ] Mark as read (unread count updates)
- [ ] Share product in chat
- [ ] Share order in chat
- [ ] Edit message (within 15 min)
- [ ] Delete message
- [ ] Report inappropriate message
- [ ] Handle rate limiting gracefully
- [ ] Handle offline scenario

---

## 📞 Support

If you encounter issues:
1. Check the full documentation: `MESSAGING_SYSTEM_DOCUMENTATION.md`
2. Verify Firebase token is valid
3. Check API response error messages
4. Test with Postman first

---

**Ready to integrate?** Start with the conversation list (Step 1) and build from there! 🚀
