# Chat System API Documentation - Admin Frontend Team

## Overview
The admin chat moderation system provides comprehensive tools for:
- **Monitoring all conversations** across the platform
- **Viewing message history** including deleted messages
- **Moderating reported messages** with action capabilities
- **Broadcasting system messages** to users
- **Analytics and insights** on chat activity

## Base URL
```
Production: https://api.epielio.com/api/admin/chat
Development: http://localhost:3000/api/admin/chat
```

## Authentication
All admin endpoints require:
1. Valid authentication token (JWT or Firebase)
2. Admin role verification

```javascript
// Headers for all requests
headers: {
  'Authorization': 'Bearer <ADMIN_TOKEN>',
  'Content-Type': 'application/json'
}
```

---

## 🛡️ ADMIN CHAT ENDPOINTS

### 1. Get All Conversations (Admin View)
**Endpoint:** `GET /admin/chat/conversations`

**Description:** View all conversations across the platform with admin privileges. Includes deleted conversations and additional metadata.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| search | string | No | null | Search by participant name |
| type | string | No | null | Filter: 'INDIVIDUAL' or 'GROUP_BROADCAST' |
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Results per page (max 100) |

**Request Example:**
```javascript
const response = await fetch(
  `${baseUrl}/admin/chat/conversations?search=john&page=1&limit=20`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
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
        "participants": [
          {
            "_id": "user1",
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "profilePicture": "https://...",
            "phoneNumber": "+1234567890"
          },
          {
            "_id": "user2",
            "name": "Bob Smith",
            "email": "bob@example.com",
            "profilePicture": "https://..."
          }
        ],
        "messageCount": 45,
        "lastMessageAt": "2025-01-23T10:30:00Z",
        "hasReports": true,
        "reportCount": 2,
        "isActive": true,
        "createdAt": "2025-01-20T08:00:00Z"
      },
      {
        "conversationId": "CONV-20250122-0015",
        "type": "GROUP_BROADCAST",
        "groupName": "Premium Members",
        "groupOwnerId": {
          "_id": "user3",
          "name": "Charlie Admin",
          "email": "charlie@example.com",
          "profilePicture": "https://..."
        },
        "groupMembers": [
          { "_id": "user4", "name": "Dave", "email": "dave@example.com" },
          { "_id": "user5", "name": "Eve", "email": "eve@example.com" }
        ],
        "messageCount": 12,
        "lastMessageAt": "2025-01-22T15:20:00Z",
        "hasReports": false,
        "reportCount": 0,
        "isActive": true,
        "createdAt": "2025-01-15T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalConversations": 156,
      "totalPages": 8
    }
  }
}
```

---

### 2. View Conversation Messages (Admin View)
**Endpoint:** `GET /admin/chat/conversations/:conversationId/messages`

**Description:** View all messages in a conversation including deleted ones (visible only to admins).

**Path Parameters:**
- `conversationId` (string, required): The conversation ID

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 50 | Messages per page (max 100) |

**Request Example:**
```javascript
const conversationId = 'CONV-20250123-0001';
const response = await fetch(
  `${baseUrl}/admin/chat/conversations/${conversationId}/messages?limit=50`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
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
          "name": "Alice Johnson",
          "email": "alice@example.com",
          "profilePicture": "https://..."
        },
        {
          "_id": "user2",
          "name": "Bob Smith",
          "email": "bob@example.com",
          "profilePicture": "https://..."
        }
      ]
    },
    "messages": [
      {
        "messageId": "MSG-20250123-0045",
        "conversationId": "CONV-20250123-0001",
        "senderId": "user1",
        "senderName": "Alice Johnson",
        "senderEmail": "alice@example.com",
        "senderAvatar": "https://...",
        "messageType": "TEXT",
        "text": "Hello! How are you?",
        "isDeleted": false,
        "isEdited": false,
        "createdAt": "2025-01-23T10:15:00Z",
        "deliveryStatus": [
          {
            "userId": "user2",
            "status": "READ",
            "deliveredAt": "2025-01-23T10:15:30Z",
            "readAt": "2025-01-23T10:16:00Z"
          }
        ]
      },
      {
        "messageId": "MSG-20250123-0046",
        "conversationId": "CONV-20250123-0001",
        "senderId": "user1",
        "senderName": "Alice Johnson",
        "senderEmail": "alice@example.com",
        "senderAvatar": "https://...",
        "messageType": "TEXT",
        "text": "This message contained spam",
        "isDeleted": true,
        "deletedAt": "2025-01-23T10:25:00Z",
        "deletedBy": "adminId123",
        "deleteReason": "Admin action: Spam content removed",
        "isEdited": false,
        "createdAt": "2025-01-23T10:20:00Z"
      },
      {
        "messageId": "MSG-20250123-0047",
        "conversationId": "CONV-20250123-0001",
        "senderId": "user2",
        "senderName": "Bob Smith",
        "senderEmail": "bob@example.com",
        "messageType": "PRODUCT_SHARE",
        "text": "Check out this product!",
        "sharedProduct": {
          "productId": "prod123",
          "productName": "Amazing Product",
          "productImage": "https://...",
          "productPrice": 299.99,
          "productUrl": "/products/prod123"
        },
        "isDeleted": false,
        "createdAt": "2025-01-23T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalMessages": 45,
      "totalPages": 1
    }
  }
}
```

**Admin-Only Features:**
- 🔍 **See deleted messages** with full text and deletion reason
- 👤 **View user email addresses** for all senders
- 📊 **Access delivery status** for all recipients
- 🗂️ **Full message history** without restrictions

---

### 3. Get Reported Messages
**Endpoint:** `GET /admin/chat/reports`

**Description:** View all reported messages with filtering options.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| status | string | No | null | Filter: 'PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED' |
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Results per page |

**Request Example:**
```javascript
const response = await fetch(
  `${baseUrl}/admin/chat/reports?status=PENDING&page=1`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "reportId": "REP-20250123-0001",
        "message": {
          "messageId": "MSG-20250123-0050",
          "text": "Spam message content here",
          "messageType": "TEXT",
          "senderId": "user123",
          "senderName": "Spammer User",
          "isDeleted": false
        },
        "reportedBy": {
          "userId": "user456",
          "name": "Reporter User",
          "email": "reporter@example.com",
          "avatar": "https://..."
        },
        "reportedUser": {
          "userId": "user123",
          "name": "Spammer User",
          "email": "spammer@example.com"
        },
        "reason": "SPAM",
        "description": "This user keeps sending promotional links",
        "status": "PENDING",
        "adminAction": null,
        "adminNotes": null,
        "reviewedBy": null,
        "reviewedAt": null,
        "createdAt": "2025-01-23T11:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalReports": 5,
      "totalPages": 1
    }
  }
}
```

**Report Statuses:**
- `PENDING` - Awaiting admin review
- `REVIEWED` - Admin has reviewed but not taken action
- `ACTIONED` - Admin has taken action (deleted message, warned user, etc.)
- `DISMISSED` - Report was reviewed but no action needed

**Report Reasons:**
- `SPAM` - Unwanted promotional content
- `ABUSE` - Abusive or offensive language
- `HARASSMENT` - Harassment or bullying
- `INAPPROPRIATE` - Inappropriate content
- `OTHER` - Other reasons

---

### 4. Take Action on Report
**Endpoint:** `POST /admin/chat/reports/:reportId/action`

**Description:** Take moderation action on a reported message.

**Path Parameters:**
- `reportId` (string, required): The report ID

**Request Body:**
```json
{
  "action": "MESSAGE_DELETED",
  "adminNotes": "Spam content removed per platform policy",
  "deleteMessage": true
}
```

**Action Types:**
- `MESSAGE_DELETED` - Delete the reported message
- `USER_WARNED` - Send warning to the user (implementation pending)
- `USER_BLOCKED` - Block the user from chat (implementation pending)
- `NO_ACTION` - Dismiss report, no action needed

**Request Example:**
```javascript
const body = {
  action: 'MESSAGE_DELETED',
  adminNotes: 'Contains spam links and promotional content',
  deleteMessage: true
};

const response = await fetch(
  `${baseUrl}/admin/chat/reports/${reportId}/action`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Action taken successfully",
  "data": {
    "reportId": "REP-20250123-0001",
    "status": "ACTIONED",
    "action": "MESSAGE_DELETED"
  }
}
```

---

### 5. Delete Message (Admin)
**Endpoint:** `DELETE /admin/chat/messages/:messageId`

**Description:** Delete any message as an admin, regardless of sender.

**Path Parameters:**
- `messageId` (string, required): The message ID to delete

**Request Body:**
```json
{
  "reason": "Violation of community guidelines - spam content"
}
```

**Request Example:**
```javascript
const body = {
  reason: 'Contains inappropriate content'
};

const response = await fetch(
  `${baseUrl}/admin/chat/messages/${messageId}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Message deleted by admin"
}
```

**Error Responses:**
```json
// 404 - Message not found
{
  "success": false,
  "message": "Message not found"
}

// 400 - Already deleted
{
  "success": false,
  "message": "Message already deleted"
}
```

---

### 6. Send Broadcast Message
**Endpoint:** `POST /admin/chat/broadcast`

**Description:** Send system broadcast messages to users.

**Request Body:**
```json
{
  "messageType": "TEXT",
  "text": "Important system announcement: Maintenance scheduled for tonight",
  "targetUsers": "ALL",
  "specificUserIds": []
}
```

**Target User Options:**
- `ALL` - Send to all active users
- `ACTIVE_ORDERS` - Send to users with active/pending orders
- `SPECIFIC` - Send to specific user IDs (provide `specificUserIds` array)

**Message Types:**
- `TEXT` - Plain text message
- `PRODUCT_SHARE` - Share a product (requires `productId`)

**Request Examples:**

#### Broadcast to All Users
```javascript
const body = {
  messageType: 'TEXT',
  text: 'System maintenance scheduled for tonight at 10 PM',
  targetUsers: 'ALL'
};

const response = await fetch(
  `${baseUrl}/admin/chat/broadcast`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
);
```

#### Broadcast Product to Active Orders
```javascript
const body = {
  messageType: 'PRODUCT_SHARE',
  text: 'Check out our new arrivals!',
  productId: 'prod123',
  targetUsers: 'ACTIVE_ORDERS'
};

const response = await fetch(
  `${baseUrl}/admin/chat/broadcast`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
);
```

#### Broadcast to Specific Users
```javascript
const body = {
  messageType: 'TEXT',
  text: 'Your order is ready for pickup',
  targetUsers: 'SPECIFIC',
  specificUserIds: ['user1', 'user2', 'user3']
};

const response = await fetch(
  `${baseUrl}/admin/chat/broadcast`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Broadcast sent successfully",
  "data": {
    "sentTo": 1247,
    "failedTo": 3,
    "totalTargeted": 1250
  }
}
```

---

### 7. Get Chat Analytics
**Endpoint:** `GET /admin/chat/analytics`

**Description:** Get comprehensive chat analytics and statistics.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startDate | string (ISO) | No | null | Start date for analytics |
| endDate | string (ISO) | No | null | End date for analytics |

**Request Example:**
```javascript
const startDate = '2025-01-01T00:00:00Z';
const endDate = '2025-01-31T23:59:59Z';

const response = await fetch(
  `${baseUrl}/admin/chat/analytics?startDate=${startDate}&endDate=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalConversations": 1250,
    "totalMessages": 45678,
    "activeConversations": 856,
    "averageMessagesPerConversation": 37,
    "messagesByType": {
      "TEXT": 42000,
      "PRODUCT_SHARE": 2500,
      "ORDER_SHARE": 1178,
      "SYSTEM": 0
    },
    "reportStats": {
      "totalReports": 45,
      "pendingReports": 5,
      "actionedReports": 40
    },
    "topActiveUsers": [
      {
        "userId": "user123",
        "name": "John Doe",
        "email": "john@example.com",
        "messageCount": 523
      },
      {
        "userId": "user456",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "messageCount": 487
      }
    ]
  }
}
```

**Analytics Breakdown:**

1. **Overall Statistics:**
   - Total conversations created
   - Total messages sent
   - Active conversations (with messages in date range)
   - Average messages per conversation

2. **Message Distribution:**
   - Breakdown by message type (TEXT, PRODUCT_SHARE, ORDER_SHARE, SYSTEM)

3. **Moderation Stats:**
   - Total reports received
   - Pending reports awaiting action
   - Actioned/dismissed reports

4. **Top Users:**
   - List of most active users by message count
   - Limited to top 10

---

## 🎨 Admin Dashboard UI Components

### Recommended Dashboard Sections

#### 1. **Overview Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│  Chat System Overview                                    │
├─────────────────────────────────────────────────────────┤
│  📊 Total Conversations: 1,250                          │
│  💬 Total Messages: 45,678                              │
│  ⚡ Active Today: 156                                   │
│  ⚠️  Pending Reports: 5                                 │
└─────────────────────────────────────────────────────────┘
```

#### 2. **Conversations Table**
| Conversation ID | Type | Participants | Messages | Last Activity | Reports | Actions |
|----------------|------|--------------|----------|---------------|---------|---------|
| CONV-20250123-0001 | Individual | Alice ↔ Bob | 45 | 2 hours ago | 2 | [View] [Delete] |
| CONV-20250122-0015 | Group | Charlie + 25 | 12 | 1 day ago | 0 | [View] [Delete] |

**Features:**
- Search by participant name
- Filter by type (Individual/Group)
- Sort by last activity, message count, or reports
- Click to view full conversation
- Quick actions (view, delete)

#### 3. **Reports Queue**
| Report ID | Message | Reporter | Reason | Status | Created | Actions |
|-----------|---------|----------|--------|--------|---------|---------|
| REP-20250123-0001 | "Spam message..." | John Doe | SPAM | PENDING | 1 hour ago | [View] [Take Action] |
| REP-20250123-0002 | "Abusive text..." | Jane Smith | ABUSE | PENDING | 3 hours ago | [View] [Take Action] |

**Features:**
- Filter by status (Pending, Reviewed, Actioned, Dismissed)
- Filter by reason type
- Priority sorting (oldest pending first)
- Quick action buttons
- Batch actions for multiple reports

#### 4. **Message Viewer (Modal/Drawer)**
```
┌───────────────────────────────────────────────────────────┐
│  Conversation: Alice ↔ Bob (CONV-20250123-0001)         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Alice Johnson                           10:15 AM         │
│  ┌─────────────────────────────────┐                    │
│  │ Hello! How are you?              │                    │
│  └─────────────────────────────────┘                    │
│                                                           │
│                              Bob Smith    10:16 AM        │
│                    ┌─────────────────────────────────┐   │
│                    │ I'm good, thanks!                │   │
│                    └─────────────────────────────────┘   │
│                                                           │
│  [DELETED by admin]                      10:20 AM         │
│  ┌─────────────────────────────────┐                    │
│  │ [Message deleted]                │  [View Original]   │
│  │ Reason: Spam content             │                    │
│  └─────────────────────────────────┘                    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Features:**
- Show deleted messages with "View Original" button
- Display edit history
- Show delivery/read status
- Product/Order previews for shared items
- Quick delete button for each message
- Export conversation as PDF/CSV

#### 5. **Broadcast Center**
```
┌───────────────────────────────────────────────────────────┐
│  Send Broadcast Message                                   │
├───────────────────────────────────────────────────────────┤
│  Message Type: [TEXT ▼]                                   │
│                                                           │
│  Target Audience:                                         │
│  ○ All Users (1,250 users)                               │
│  ○ Users with Active Orders (345 users)                  │
│  ● Specific Users                                         │
│    [user1, user2, user3] [Add Users]                     │
│                                                           │
│  Message:                                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Type your broadcast message here...                  │ │
│  │                                                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  [Cancel]  [Preview]  [Send Broadcast]                   │
└───────────────────────────────────────────────────────────┘
```

#### 6. **Analytics Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│  Chat Analytics (January 2025)                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Messages by Type:                                      │
│  ██████████████████████ TEXT (42,000)                  │
│  ███ PRODUCT_SHARE (2,500)                             │
│  ██ ORDER_SHARE (1,178)                                │
│                                                         │
│  Top Active Users:                                      │
│  1. John Doe - 523 messages                            │
│  2. Jane Smith - 487 messages                          │
│  3. Bob Johnson - 412 messages                         │
│                                                         │
│  Report Statistics:                                     │
│  Total: 45 | Pending: 5 | Actioned: 40                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Permissions

### Admin Role Verification
All endpoints verify:
1. Valid authentication token
2. User has admin role (`role === 'admin'`)
3. Request comes from authorized origin

### Audit Logging
The following actions should be logged for audit:
- ✅ Viewing conversations
- ✅ Deleting messages
- ✅ Taking action on reports
- ✅ Sending broadcast messages
- ✅ Viewing user details

### Data Privacy
When displaying user information:
- 🔒 **Email addresses** - Only visible to admins
- 🔒 **Phone numbers** - Only visible to admins
- 🔒 **Full message content** - Including deleted messages
- 🔒 **Deletion reasons** - Admin notes visible

---

## 📊 Implementation Checklist for Admin Frontend

### Core Features
- [ ] Display conversations list with search/filter
- [ ] View full conversation with all messages
- [ ] View deleted messages (admin-only)
- [ ] Reports queue with filtering
- [ ] Take action on reports (delete, dismiss, warn)
- [ ] Delete individual messages
- [ ] Send broadcast messages
- [ ] View chat analytics dashboard

### Advanced Features
- [ ] Real-time updates for new reports
- [ ] Batch actions for multiple reports
- [ ] Export conversations (PDF/CSV)
- [ ] User blocking/warning system
- [ ] Advanced analytics with charts
- [ ] Custom date range filtering
- [ ] Audit log viewer
- [ ] Admin activity tracking

### UI/UX Features
- [ ] Conversation search with autocomplete
- [ ] Message highlighting for reports
- [ ] Quick action buttons
- [ ] Keyboard shortcuts for common actions
- [ ] Confirmation dialogs for destructive actions
- [ ] Toast notifications for success/errors
- [ ] Loading states and skeletons
- [ ] Pagination for large datasets
- [ ] Responsive design for mobile/tablet

---

## 💡 Sample React Components

### Conversations Table Component
```javascript
import React, { useState, useEffect } from 'react';

function ConversationsTable() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    page: 1,
    limit: 20
  });

  useEffect(() => {
    loadConversations();
  }, [filters]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await fetch(
        `${API_BASE}/admin/chat/conversations?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${getAdminToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setConversations(data.data.conversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchTerm) => {
    setFilters({ ...filters, search: searchTerm, page: 1 });
  };

  const handleTypeFilter = (type) => {
    setFilters({ ...filters, type, page: 1 });
  };

  return (
    <div className="conversations-table">
      <div className="filters">
        <input
          type="text"
          placeholder="Search participants..."
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select onChange={(e) => handleTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="INDIVIDUAL">Individual</option>
          <option value="GROUP_BROADCAST">Group Broadcast</option>
        </select>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Conversation ID</th>
              <th>Type</th>
              <th>Participants</th>
              <th>Messages</th>
              <th>Last Activity</th>
              <th>Reports</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map(conv => (
              <tr key={conv.conversationId}>
                <td>{conv.conversationId}</td>
                <td>
                  <span className={`badge ${conv.type}`}>
                    {conv.type}
                  </span>
                </td>
                <td>
                  {conv.type === 'INDIVIDUAL' ?
                    conv.participants.map(p => p.name).join(' ↔ ') :
                    `${conv.groupName} (${conv.groupMembers.length} members)`
                  }
                </td>
                <td>{conv.messageCount}</td>
                <td>{formatDate(conv.lastMessageAt)}</td>
                <td>
                  {conv.hasReports && (
                    <span className="badge-danger">{conv.reportCount}</span>
                  )}
                </td>
                <td>
                  <button onClick={() => viewConversation(conv.conversationId)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### Reports Queue Component
```javascript
function ReportsQueue() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const loadReports = async () => {
    const response = await fetch(
      `${API_BASE}/admin/chat/reports?status=${statusFilter}`,
      {
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    if (data.success) {
      setReports(data.data.reports);
    }
  };

  const takeAction = async (reportId, action, notes) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this report?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_BASE}/admin/chat/reports/${reportId}/action`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAdminToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            adminNotes: notes,
            deleteMessage: action === 'MESSAGE_DELETED'
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('Action taken successfully');
        loadReports(); // Reload reports
      }
    } catch (error) {
      console.error('Error taking action:', error);
      alert('Failed to take action');
    }
  };

  return (
    <div className="reports-queue">
      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIONED">Actioned</option>
          <option value="DISMISSED">Dismissed</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Report ID</th>
            <th>Message</th>
            <th>Reporter</th>
            <th>Reason</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(report => (
            <tr key={report.reportId}>
              <td>{report.reportId}</td>
              <td>
                <div className="message-preview">
                  {report.message?.text.substring(0, 50)}...
                </div>
              </td>
              <td>{report.reportedBy.name}</td>
              <td>
                <span className={`badge reason-${report.reason}`}>
                  {report.reason}
                </span>
              </td>
              <td>{formatDate(report.createdAt)}</td>
              <td>
                <span className={`badge status-${report.status}`}>
                  {report.status}
                </span>
              </td>
              <td>
                {report.status === 'PENDING' && (
                  <div className="action-buttons">
                    <button
                      onClick={() => takeAction(
                        report.reportId,
                        'MESSAGE_DELETED',
                        'Violates community guidelines'
                      )}
                      className="btn-danger"
                    >
                      Delete Message
                    </button>
                    <button
                      onClick={() => takeAction(
                        report.reportId,
                        'NO_ACTION',
                        'Report reviewed, no violation found'
                      )}
                      className="btn-secondary"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## ⚠️ Important Notes for Admin Team

### 1. **Data Privacy & Compliance**
- Admin access logs should be maintained
- Deleted messages remain in database for audit purposes
- User emails/phone numbers are sensitive - handle with care
- Follow GDPR/privacy regulations when exporting data

### 2. **Moderation Best Practices**
- Always provide clear admin notes when taking action
- Review context before deleting messages
- Use warnings before blocking users
- Document reasoning for actions

### 3. **Performance Considerations**
- Implement pagination for large datasets
- Cache analytics data (refresh every 5 minutes)
- Use debouncing for search inputs
- Lazy load conversation messages

### 4. **Error Handling**
Always handle:
- 401 Unauthorized (refresh admin token)
- 403 Forbidden (insufficient permissions)
- 404 Not Found (conversation/message deleted)
- 500 Server Error (show retry option)

---

## 🔧 Troubleshooting

### Common Issues

**1. Reports not loading**
```javascript
// Check admin permissions
// Verify token is valid and role is 'admin'
console.log('Admin token:', getAdminToken());
console.log('User role:', getUserRole());
```

**2. Broadcast failed to send**
```javascript
// Check response for detailed error
const response = await sendBroadcast(data);
if (!response.success) {
  console.error('Broadcast error:', response.message);
  console.log('Failed users:', response.data.failedTo);
}
```

**3. Cannot view deleted messages**
```javascript
// Ensure you're using admin endpoint
// Wrong: /api/chat/conversations/:id/messages
// Correct: /api/admin/chat/conversations/:id/messages
```

---

## 📞 Support & Contact

For technical issues or questions about the admin chat system:
- Backend Team Lead: [Contact Info]
- API Documentation: [Link to main docs]
- Slack Channel: #chat-system-dev

---

## 🚀 Future Enhancements

Planned features for future releases:
- Real-time chat monitoring with WebSocket
- Advanced user blocking system
- Automated spam detection
- Message sentiment analysis
- Conversation export in multiple formats
- Advanced reporting with custom date ranges
- User reputation scoring
- Automated moderation rules
