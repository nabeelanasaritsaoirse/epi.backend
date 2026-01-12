# Sales Team "My Team" API Documentation

## Overview

This documentation covers the **8 new APIs** for sales team members to view their own referral chain data. These APIs allow each logged-in sales person to see **only their own team** (users they referred) and users referred by their team.

---

## Authentication Flow

### Step 1: Login

```http
POST /api/admin-auth/login
Content-Type: application/json

{
  "email": "salesperson@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "64abc123def456...",
    "name": "John Sales",
    "email": "salesperson@example.com",
    "role": "sales_team",
    "isSuperAdmin": false,
    "isSalesTeam": true,
    "modules": ["sales-dashboard", "users"],
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Step 2: Use Token in All API Calls

```http
GET /api/sales/my-team
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Key Points
- Store `accessToken` in localStorage/sessionStorage
- Add `Authorization: Bearer {accessToken}` header to all API calls
- Token expires in 7 days
- Use `refreshToken` to get new access token when expired

---

## API Endpoints Summary

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | GET | `/api/sales/my-team` | My direct referrals (L1 team) |
| 2 | GET | `/api/sales/my-team/users` | All users in my chain (L1 + L2) |
| 3 | GET | `/api/sales/my-team/:userId` | Specific team member detail |
| 4 | GET | `/api/sales/my-stats` | Dashboard statistics |
| 5 | GET | `/api/sales/my-opportunities` | Hot leads (cart/wishlist users) |
| 6 | GET | `/api/sales/my-activity` | Activity feed |
| 7 | GET | `/api/sales/my-leaderboard` | Top performers |
| 8 | GET | `/api/sales/my-trends` | Chart data |

---

## API 1: Get My Team (L1 Members)

### Endpoint
```
GET /api/sales/my-team
```

### Description
Returns the logged-in user's direct referrals (Level 1 team members) with their stats.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | '' | Search by name, email, phone, or referralCode |
| `sortBy` | string | 'createdAt' | Sort field: 'createdAt', 'name' |
| `sortOrder` | string | 'desc' | Sort direction: 'asc' or 'desc' |

### Example Request
```http
GET /api/sales/my-team?page=1&limit=10&search=john&sortBy=createdAt&sortOrder=desc
Authorization: Bearer {accessToken}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "teamMembers": [
      {
        "_id": "64abc123def456789012345a",
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "+919876543210",
        "profilePicture": "https://storage.example.com/profile.jpg",
        "referralCode": "JOHN123",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "stats": {
          "level2Count": 8,
          "totalOrders": 5,
          "activeOrders": 2,
          "totalOrderValue": 25000,
          "totalPaidAmount": 12500
        }
      },
      {
        "_id": "64abc123def456789012345b",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phoneNumber": "+919876543211",
        "profilePicture": null,
        "referralCode": "JANE456",
        "createdAt": "2024-01-10T08:15:00.000Z",
        "stats": {
          "level2Count": 3,
          "totalOrders": 2,
          "activeOrders": 1,
          "totalOrderValue": 15000,
          "totalPaidAmount": 7500
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    },
    "summary": {
      "totalL1": 50,
      "totalL2": 120,
      "activeMembers": 35
    }
  }
}
```

### Frontend Implementation
```javascript
// React/Next.js Example
const [teamMembers, setTeamMembers] = useState([]);
const [pagination, setPagination] = useState({});
const [summary, setSummary] = useState({});
const [loading, setLoading] = useState(false);

const fetchMyTeam = async (page = 1, search = '') => {
  setLoading(true);
  try {
    const response = await fetch(
      `${API_URL}/api/sales/my-team?page=${page}&limit=10&search=${search}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      }
    );
    const data = await response.json();

    if (data.success) {
      setTeamMembers(data.data.teamMembers);
      setPagination(data.data.pagination);
      setSummary(data.data.summary);
    }
  } catch (error) {
    console.error('Error fetching team:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## API 2: Get My Team Users (L1 + L2)

### Endpoint
```
GET /api/sales/my-team/users
```

### Description
Returns all users in the logged-in user's referral chain (both L1 and L2 combined).

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | '' | Search by name, email, phone |
| `level` | number | - | Filter by level: 1 or 2 |
| `referrerId` | string | - | Filter by specific L1 referrer ID |
| `hasOrders` | string | - | Filter: 'true' or 'false' |

### Example Requests
```http
# Get all users
GET /api/sales/my-team/users?page=1&limit=20

# Get only L1 users
GET /api/sales/my-team/users?level=1

# Get only L2 users
GET /api/sales/my-team/users?level=2

# Get L2 users referred by specific L1 member
GET /api/sales/my-team/users?level=2&referrerId=64abc123def456789012345a

# Get users with orders only
GET /api/sales/my-team/users?hasOrders=true

# Get users without orders
GET /api/sales/my-team/users?hasOrders=false
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "64abc123def456789012345c",
        "name": "User One",
        "email": "user1@example.com",
        "phoneNumber": "+919876543212",
        "profilePicture": null,
        "createdAt": "2024-02-01T09:00:00.000Z",
        "level": 1,
        "referredBy": {
          "_id": "64abc123def456789012345x",
          "name": "Sales Person",
          "referralCode": "SALES001"
        },
        "orderStats": {
          "totalOrders": 2,
          "activeOrders": 1,
          "totalPaid": 5000
        }
      },
      {
        "_id": "64abc123def456789012345d",
        "name": "User Two",
        "email": "user2@example.com",
        "phoneNumber": "+919876543213",
        "profilePicture": "https://storage.example.com/user2.jpg",
        "createdAt": "2024-02-05T14:30:00.000Z",
        "level": 2,
        "referredBy": {
          "_id": "64abc123def456789012345a",
          "name": "John Doe",
          "referralCode": "JOHN123"
        },
        "orderStats": {
          "totalOrders": 0,
          "activeOrders": 0,
          "totalPaid": 0
        }
      }
    ],
    "pagination": {
      "total": 170,
      "page": 1,
      "limit": 20,
      "totalPages": 9
    },
    "breakdown": {
      "level1Users": 50,
      "level2Users": 120,
      "usersWithOrders": 89
    }
  }
}
```

### Frontend Implementation
```javascript
// Filter tabs: All | L1 Only | L2 Only | With Orders | Without Orders
const [activeFilter, setActiveFilter] = useState('all');

const fetchTeamUsers = async (filter) => {
  let url = `${API_URL}/api/sales/my-team/users?page=1&limit=20`;

  switch (filter) {
    case 'l1':
      url += '&level=1';
      break;
    case 'l2':
      url += '&level=2';
      break;
    case 'withOrders':
      url += '&hasOrders=true';
      break;
    case 'withoutOrders':
      url += '&hasOrders=false';
      break;
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

---

## API 3: Get Team Member Detail

### Endpoint
```
GET /api/sales/my-team/:userId
```

### Description
Returns detailed information about a specific team member. **Security:** Returns 403 if the user is not in the logged-in user's L1 or L2 chain.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the team member |

### Example Request
```http
GET /api/sales/my-team/64abc123def456789012345a
Authorization: Bearer {accessToken}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64abc123def456789012345a",
      "name": "John Doe",
      "email": "john@example.com",
      "phoneNumber": "+919876543210",
      "profilePicture": "https://storage.example.com/john.jpg",
      "referralCode": "JOHN123",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "level": 1,
      "wallet": {
        "balance": 1500,
        "commissionEarned": 5000
      },
      "kycDetails": {
        "aadharVerified": true,
        "panVerified": false
      },
      "referredBy": {
        "_id": "64abc123def456789012345x",
        "name": "Sales Person",
        "email": "sales@example.com",
        "referralCode": "SALES001"
      }
    },
    "referralStats": {
      "level1Count": 8,
      "level2Count": 25
    },
    "level1Referrals": [
      {
        "_id": "64abc123def456789012345e",
        "name": "Referred User 1",
        "email": "ref1@example.com",
        "phoneNumber": "+919876543214",
        "profilePicture": null,
        "createdAt": "2024-02-01T09:00:00.000Z",
        "referralCode": "REF001",
        "level2Count": 3,
        "orderCount": 2
      }
    ],
    "recentOrders": [
      {
        "orderId": "ORD-2024-001234",
        "productName": "Premium Headphones",
        "status": "ACTIVE",
        "totalProductPrice": 5000,
        "totalPaidAmount": 2500,
        "createdAt": "2024-03-15T11:00:00.000Z"
      }
    ],
    "wishlist": [
      {
        "_id": "64abc123def456789012345f",
        "name": "Wireless Speaker",
        "price": 3000,
        "images": ["https://storage.example.com/speaker.jpg"],
        "brand": "Brand Name"
      }
    ],
    "cart": [
      {
        "productId": "64abc123def456789012345g",
        "quantity": 2,
        "productDetails": {
          "name": "USB Cable",
          "price": 500,
          "images": ["https://storage.example.com/cable.jpg"],
          "brand": "Brand Name",
          "stock": 100
        }
      }
    ]
  }
}
```

### Error Response (403 - Not in Chain)
```json
{
  "success": false,
  "message": "Access denied. User is not in your referral chain.",
  "code": "NOT_IN_CHAIN"
}
```

### Error Response (404 - Not Found)
```json
{
  "success": false,
  "message": "User not found"
}
```

### Frontend Implementation
```javascript
// User detail modal/page
const fetchUserDetail = async (userId) => {
  try {
    const response = await fetch(
      `${API_URL}/api/sales/my-team/${userId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const data = await response.json();

    if (data.success) {
      setUserDetail(data.data);
      openDetailModal();
    } else if (data.code === 'NOT_IN_CHAIN') {
      showError('You can only view users in your referral chain');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## API 4: Get My Stats (Dashboard)

### Endpoint
```
GET /api/sales/my-stats
```

### Description
Returns aggregated dashboard statistics for the logged-in user's team.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 'all' | Time period: 'today', 'week', 'month', 'year', 'all' |

### Example Requests
```http
# All time stats
GET /api/sales/my-stats

# This month's stats
GET /api/sales/my-stats?period=month

# This week's stats
GET /api/sales/my-stats?period=week

# Today's stats
GET /api/sales/my-stats?period=today
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64abc123def456789012345x",
      "name": "Sales Person",
      "referralCode": "SALES001",
      "referralLimit": 50,
      "remainingReferrals": 5
    },
    "teamStats": {
      "totalL1Members": 45,
      "totalL2Users": 120,
      "totalTeamSize": 165,
      "activeMembers": 89,
      "newThisPeriod": 12
    },
    "orderStats": {
      "totalOrders": 234,
      "activeOrders": 45,
      "completedOrders": 180,
      "cancelledOrders": 9,
      "totalOrderValue": 850000
    },
    "revenueStats": {
      "totalPaidAmount": 425000,
      "pendingAmount": 425000
    },
    "commissionStats": {
      "totalEarned": 42500,
      "fromL1": 25500,
      "fromL2": 17000,
      "pendingCommission": 0
    },
    "conversionRate": 53.94
  }
}
```

### Frontend Implementation (Dashboard Cards)
```javascript
// Dashboard component
const [stats, setStats] = useState(null);
const [period, setPeriod] = useState('all');

const fetchStats = async (selectedPeriod) => {
  const response = await fetch(
    `${API_URL}/api/sales/my-stats?period=${selectedPeriod}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  if (data.success) {
    setStats(data.data);
  }
};

// Render dashboard cards
return (
  <div className="dashboard">
    {/* Period selector */}
    <select value={period} onChange={(e) => setPeriod(e.target.value)}>
      <option value="today">Today</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="year">This Year</option>
      <option value="all">All Time</option>
    </select>

    {/* Stats cards */}
    <div className="stats-grid">
      <Card title="Team Size" value={stats?.teamStats.totalTeamSize} />
      <Card title="L1 Members" value={stats?.teamStats.totalL1Members} />
      <Card title="L2 Users" value={stats?.teamStats.totalL2Users} />
      <Card title="Active Members" value={stats?.teamStats.activeMembers} />
      <Card title="Total Orders" value={stats?.orderStats.totalOrders} />
      <Card title="Active Orders" value={stats?.orderStats.activeOrders} />
      <Card title="Total Revenue" value={`₹${stats?.revenueStats.totalPaidAmount}`} />
      <Card title="Commission Earned" value={`₹${stats?.commissionStats.totalEarned}`} />
      <Card title="Conversion Rate" value={`${stats?.conversionRate}%`} />
    </div>
  </div>
);
```

---

## API 5: Get My Opportunities (Hot Leads)

### Endpoint
```
GET /api/sales/my-opportunities
```

### Description
Returns hot leads - users who can potentially be converted to orders.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `type` | string | - | Filter by type: 'cart', 'wishlist', 'inactive', 'new' |

### Opportunity Types

| Type | Description |
|------|-------------|
| `cart` | Users with items in cart but no orders |
| `wishlist` | Users with wishlist items but no orders |
| `inactive` | Users inactive for 30+ days |
| `new` | Users signed up in last 7 days but no orders |

### Example Requests
```http
# Get all opportunities
GET /api/sales/my-opportunities

# Get only cart opportunities (highest priority)
GET /api/sales/my-opportunities?type=cart

# Get inactive users
GET /api/sales/my-opportunities?type=inactive
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "opportunities": [
      {
        "_id": "64abc123def456789012345h",
        "name": "Hot Lead User",
        "email": "hotlead@example.com",
        "phoneNumber": "+919876543215",
        "profilePicture": null,
        "type": "cart",
        "level": 1,
        "referredBy": {
          "_id": "64abc123def456789012345a",
          "name": "John Doe"
        },
        "details": {
          "cartItems": 3,
          "cartValue": 15000,
          "lastActivity": "2024-03-10T14:30:00.000Z"
        }
      },
      {
        "_id": "64abc123def456789012345i",
        "name": "Wishlist User",
        "email": "wishlist@example.com",
        "phoneNumber": "+919876543216",
        "profilePicture": null,
        "type": "wishlist",
        "level": 2,
        "referredBy": {
          "_id": "64abc123def456789012345b",
          "name": "Jane Smith"
        },
        "details": {
          "wishlistItems": 5,
          "lastActivity": "2024-03-08T10:00:00.000Z"
        }
      },
      {
        "_id": "64abc123def456789012345j",
        "name": "Inactive User",
        "email": "inactive@example.com",
        "phoneNumber": "+919876543217",
        "profilePicture": null,
        "type": "inactive",
        "level": 1,
        "referredBy": {
          "_id": "64abc123def456789012345x",
          "name": "Sales Person"
        },
        "details": {
          "lastLogin": "2024-01-15T09:00:00.000Z",
          "daysSinceActivity": 60
        }
      },
      {
        "_id": "64abc123def456789012345k",
        "name": "New User",
        "email": "newuser@example.com",
        "phoneNumber": "+919876543218",
        "profilePicture": null,
        "type": "new",
        "level": 2,
        "referredBy": {
          "_id": "64abc123def456789012345c",
          "name": "User One"
        },
        "details": {
          "signupDate": "2024-03-12T08:00:00.000Z",
          "daysSinceSignup": 3
        }
      }
    ],
    "pagination": {
      "total": 112,
      "page": 1,
      "limit": 20,
      "totalPages": 6
    },
    "summary": {
      "withCart": 25,
      "withWishlist": 45,
      "inactive": 30,
      "newSignups": 12
    }
  }
}
```

### Frontend Implementation
```javascript
// Opportunities page with tabs
const [opportunities, setOpportunities] = useState([]);
const [activeTab, setActiveTab] = useState('all');
const [summary, setSummary] = useState({});

const tabs = [
  { key: 'all', label: 'All', count: null },
  { key: 'cart', label: 'Cart', count: summary.withCart, color: 'red' },
  { key: 'wishlist', label: 'Wishlist', count: summary.withWishlist, color: 'orange' },
  { key: 'new', label: 'New Signups', count: summary.newSignups, color: 'green' },
  { key: 'inactive', label: 'Inactive', count: summary.inactive, color: 'gray' }
];

const fetchOpportunities = async (type) => {
  let url = `${API_URL}/api/sales/my-opportunities?page=1&limit=20`;
  if (type && type !== 'all') {
    url += `&type=${type}`;
  }

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();

  if (data.success) {
    setOpportunities(data.data.opportunities);
    setSummary(data.data.summary);
  }
};

// Priority badge component
const PriorityBadge = ({ type }) => {
  const colors = {
    cart: 'bg-red-500',      // Highest priority
    wishlist: 'bg-orange-500',
    new: 'bg-green-500',
    inactive: 'bg-gray-500'
  };
  return <span className={`badge ${colors[type]}`}>{type}</span>;
};
```

---

## API 6: Get My Activity Feed

### Endpoint
```
GET /api/sales/my-activity
```

### Description
Returns recent activity feed from the logged-in user's team.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `type` | string | - | Filter: 'signup', 'order', 'payment', 'all' |

### Activity Types

| Type | Description |
|------|-------------|
| `signup` | New user registrations |
| `order` | New orders placed |
| `payment` | Installment payments made |

### Example Requests
```http
# Get all activities
GET /api/sales/my-activity

# Get only new signups
GET /api/sales/my-activity?type=signup

# Get only orders
GET /api/sales/my-activity?type=order

# Get only payments
GET /api/sales/my-activity?type=payment
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "type": "signup",
        "user": {
          "_id": "64abc123def456789012345l",
          "name": "New User",
          "email": "new@example.com",
          "profilePicture": null
        },
        "referredBy": {
          "_id": "64abc123def456789012345a",
          "name": "John Doe",
          "referralCode": "JOHN123"
        },
        "level": 1,
        "timestamp": "2024-03-15T14:30:00.000Z",
        "details": {}
      },
      {
        "type": "order",
        "user": {
          "_id": "64abc123def456789012345c",
          "name": "User One",
          "email": "user1@example.com",
          "profilePicture": null
        },
        "level": 1,
        "timestamp": "2024-03-15T12:00:00.000Z",
        "details": {
          "orderId": "ORD-2024-001235",
          "productName": "Wireless Headphones",
          "amount": 5000,
          "status": "ACTIVE"
        }
      },
      {
        "type": "payment",
        "user": {
          "_id": "64abc123def456789012345d",
          "name": "User Two",
          "email": "user2@example.com",
          "profilePicture": null
        },
        "level": 2,
        "timestamp": "2024-03-15T10:00:00.000Z",
        "details": {
          "orderId": "ORD-2024-001200",
          "amount": 100,
          "commission": 30
        }
      }
    ],
    "pagination": {
      "total": 500,
      "page": 1,
      "limit": 20,
      "totalPages": 25
    }
  }
}
```

### Frontend Implementation
```javascript
// Activity feed component
const ActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all');

  const getActivityIcon = (type) => {
    switch (type) {
      case 'signup': return '👤';
      case 'order': return '🛒';
      case 'payment': return '💰';
      default: return '📌';
    }
  };

  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'signup':
        return `${activity.user.name} joined via ${activity.referredBy?.name || 'direct'}`;
      case 'order':
        return `${activity.user.name} placed order for ${activity.details.productName}`;
      case 'payment':
        return `${activity.user.name} paid ₹${activity.details.amount}`;
      default:
        return '';
    }
  };

  return (
    <div className="activity-feed">
      {/* Filter tabs */}
      <div className="tabs">
        {['all', 'signup', 'order', 'payment'].map(type => (
          <button
            key={type}
            className={filter === type ? 'active' : ''}
            onClick={() => setFilter(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Activity list */}
      <div className="activities">
        {activities.map((activity, index) => (
          <div key={index} className="activity-item">
            <span className="icon">{getActivityIcon(activity.type)}</span>
            <div className="content">
              <p>{getActivityMessage(activity)}</p>
              <span className="time">
                {new Date(activity.timestamp).toLocaleString()}
              </span>
              <span className={`level level-${activity.level}`}>
                L{activity.level}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## API 7: Get My Leaderboard

### Endpoint
```
GET /api/sales/my-leaderboard
```

### Description
Returns top performers in the logged-in user's team (L1 members ranked).

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 'all' | Time period: 'week', 'month', 'all' |
| `metric` | string | 'revenue' | Ranking metric: 'orders', 'revenue', 'referrals', 'commission' |

### Example Requests
```http
# Top performers by revenue (all time)
GET /api/sales/my-leaderboard

# Top performers by orders this month
GET /api/sales/my-leaderboard?period=month&metric=orders

# Top performers by referrals this week
GET /api/sales/my-leaderboard?period=week&metric=referrals
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user": {
          "_id": "64abc123def456789012345a",
          "name": "John Doe",
          "email": "john@example.com",
          "profilePicture": "https://storage.example.com/john.jpg",
          "referralCode": "JOHN123"
        },
        "metrics": {
          "totalOrders": 25,
          "totalRevenue": 125000,
          "totalReferrals": 15,
          "commissionGenerated": 12500
        }
      },
      {
        "rank": 2,
        "user": {
          "_id": "64abc123def456789012345b",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "profilePicture": null,
          "referralCode": "JANE456"
        },
        "metrics": {
          "totalOrders": 18,
          "totalRevenue": 98000,
          "totalReferrals": 12,
          "commissionGenerated": 9800
        }
      },
      {
        "rank": 3,
        "user": {
          "_id": "64abc123def456789012345m",
          "name": "Bob Wilson",
          "email": "bob@example.com",
          "profilePicture": null,
          "referralCode": "BOB789"
        },
        "metrics": {
          "totalOrders": 15,
          "totalRevenue": 76000,
          "totalReferrals": 8,
          "commissionGenerated": 7600
        }
      }
    ],
    "period": "all",
    "metric": "revenue"
  }
}
```

### Frontend Implementation
```javascript
// Leaderboard component
const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState('all');
  const [metric, setMetric] = useState('revenue');

  const fetchLeaderboard = async () => {
    const response = await fetch(
      `${API_URL}/api/sales/my-leaderboard?period=${period}&metric=${metric}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    if (data.success) {
      setLeaderboard(data.data.leaderboard);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div className="leaderboard">
      {/* Filters */}
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>

        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="revenue">By Revenue</option>
          <option value="orders">By Orders</option>
          <option value="referrals">By Referrals</option>
          <option value="commission">By Commission</option>
        </select>
      </div>

      {/* Leaderboard table */}
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Member</th>
            <th>Orders</th>
            <th>Revenue</th>
            <th>Referrals</th>
            <th>Commission</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((item) => (
            <tr key={item.user._id}>
              <td>{getRankBadge(item.rank)}</td>
              <td>
                <img src={item.user.profilePicture || '/default-avatar.png'} />
                {item.user.name}
              </td>
              <td>{item.metrics.totalOrders}</td>
              <td>₹{item.metrics.totalRevenue.toLocaleString()}</td>
              <td>{item.metrics.totalReferrals}</td>
              <td>₹{item.metrics.commissionGenerated.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## API 8: Get My Trends (Chart Data)

### Endpoint
```
GET /api/sales/my-trends
```

### Description
Returns time-series data for charts and graphs.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | 'month' | Time period: 'week', 'month', 'year' |
| `metric` | string | 'orders' | Data metric: 'signups', 'orders', 'revenue', 'commission' |

### Example Requests
```http
# Orders trend for last month
GET /api/sales/my-trends?period=month&metric=orders

# Revenue trend for last week
GET /api/sales/my-trends?period=week&metric=revenue

# Signups trend for last year
GET /api/sales/my-trends?period=year&metric=signups

# Commission trend for last month
GET /api/sales/my-trends?period=month&metric=commission
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "period": "month",
    "metric": "orders",
    "labels": [
      "Feb 15", "Feb 16", "Feb 17", "Feb 18", "Feb 19", "Feb 20", "Feb 21",
      "Feb 22", "Feb 23", "Feb 24", "Feb 25", "Feb 26", "Feb 27", "Feb 28",
      "Mar 1", "Mar 2", "Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7",
      "Mar 8", "Mar 9", "Mar 10", "Mar 11", "Mar 12", "Mar 13", "Mar 14", "Mar 15"
    ],
    "data": [
      5, 8, 3, 12, 7, 9, 4, 6, 11, 8, 5, 7, 10, 6,
      8, 9, 5, 7, 12, 8, 6, 9, 7, 11, 8, 6, 10, 7, 9
    ],
    "summary": {
      "total": 234,
      "average": 8.07,
      "highest": 12,
      "lowest": 3
    }
  }
}
```

### Frontend Implementation (Chart.js)
```javascript
import { Line, Bar } from 'react-chartjs-2';

const TrendsChart = () => {
  const [chartData, setChartData] = useState(null);
  const [period, setPeriod] = useState('month');
  const [metric, setMetric] = useState('orders');

  const fetchTrends = async () => {
    const response = await fetch(
      `${API_URL}/api/sales/my-trends?period=${period}&metric=${metric}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();

    if (data.success) {
      setChartData({
        labels: data.data.labels,
        datasets: [{
          label: metric.charAt(0).toUpperCase() + metric.slice(1),
          data: data.data.data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      });
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `${metric} Trends` }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return (
    <div className="trends-chart">
      {/* Filters */}
      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="year">Last 12 Months</option>
        </select>

        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="signups">Signups</option>
          <option value="orders">Orders</option>
          <option value="revenue">Revenue</option>
          <option value="commission">Commission</option>
        </select>
      </div>

      {/* Chart */}
      {chartData && <Line data={chartData} options={chartOptions} />}

      {/* Summary cards */}
      {chartData && (
        <div className="summary-cards">
          <Card title="Total" value={summary.total} />
          <Card title="Average" value={summary.average} />
          <Card title="Highest" value={summary.highest} />
          <Card title="Lowest" value={summary.lowest} />
        </div>
      )}
    </div>
  );
};
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "message": "Authentication required",
  "code": "NOT_AUTHENTICATED"
}
```

**403 Forbidden**
```json
{
  "success": false,
  "message": "Access denied. Sales team role required.",
  "code": "SALES_TEAM_REQUIRED"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Failed to fetch data",
  "error": "Error message details"
}
```

### Frontend Error Handling
```javascript
const apiCall = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return;
    }

    const data = await response.json();

    if (!data.success) {
      showError(data.message);
      return null;
    }

    return data;
  } catch (error) {
    showError('Network error. Please try again.');
    return null;
  }
};
```

---

## Complete Dashboard Layout Example

```jsx
// pages/sales-dashboard.jsx
import { useState, useEffect } from 'react';

const SalesDashboard = () => {
  const [stats, setStats] = useState(null);
  const [team, setTeam] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    // Fetch all dashboard data on mount
    Promise.all([
      fetchStats(),
      fetchTeam(),
      fetchOpportunities(),
      fetchActivities()
    ]);
  }, []);

  return (
    <div className="sales-dashboard">
      {/* Header with user info */}
      <header>
        <h1>My Sales Dashboard</h1>
        <div className="user-info">
          <span>Referral Code: {stats?.user.referralCode}</span>
          <span>Remaining Referrals: {stats?.user.remainingReferrals}</span>
        </div>
      </header>

      {/* Stats Overview */}
      <section className="stats-section">
        <h2>Overview</h2>
        <StatsCards stats={stats} />
      </section>

      {/* Charts Row */}
      <section className="charts-section">
        <div className="chart">
          <TrendsChart metric="orders" />
        </div>
        <div className="chart">
          <TrendsChart metric="revenue" />
        </div>
      </section>

      {/* Main Content */}
      <div className="content-grid">
        {/* Team List */}
        <section className="team-section">
          <h2>My Team ({stats?.teamStats.totalL1Members})</h2>
          <TeamList team={team} />
        </section>

        {/* Hot Leads */}
        <section className="opportunities-section">
          <h2>Hot Leads</h2>
          <OpportunitiesList opportunities={opportunities} />
        </section>

        {/* Activity Feed */}
        <section className="activity-section">
          <h2>Recent Activity</h2>
          <ActivityFeed activities={activities} />
        </section>

        {/* Leaderboard */}
        <section className="leaderboard-section">
          <h2>Top Performers</h2>
          <Leaderboard />
        </section>
      </div>
    </div>
  );
};

export default SalesDashboard;
```

---

## API Comparison: My Team vs Global APIs

| My Team API | Global API | Difference |
|-------------|------------|------------|
| `/api/sales/my-team` | `/api/sales/users` | My Team shows only MY referrals, Global shows ALL users |
| `/api/sales/my-team/:id` | `/api/sales/users/:id` | My Team has security check (must be in chain) |
| `/api/sales/my-stats` | `/api/sales/dashboard-stats` | My Stats shows only MY team's data |

---

## Best Practices

1. **Always include Authorization header** in all API calls
2. **Handle token expiration** gracefully - redirect to login
3. **Use pagination** for large data sets
4. **Cache stats data** to reduce API calls (refresh on user action)
5. **Show loading states** while fetching data
6. **Handle empty states** when user has no team/data yet

---

## Testing Checklist

- [ ] Login as sales_team user
- [ ] Verify `/my-team` returns only direct referrals
- [ ] Verify `/my-team/users` returns L1 + L2 correctly
- [ ] Verify `/my-team/:userId` returns 403 for users not in chain
- [ ] Verify `/my-stats` period filter works
- [ ] Verify `/my-opportunities` type filter works
- [ ] Verify `/my-activity` shows correct activity types
- [ ] Verify `/my-leaderboard` sorting works
- [ ] Verify `/my-trends` returns chart data correctly
