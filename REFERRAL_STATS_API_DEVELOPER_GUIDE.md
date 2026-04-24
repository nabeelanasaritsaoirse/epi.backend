# Referral Statistics API - Developer Integration Guide

## Quick Start

This guide helps you integrate the Referral Statistics API into your web or mobile application.

**Endpoint:** `GET /api/referral/stats`
**Base URL:** `https://api.epielio.com` (Production) or `http://localhost:5000` (Development)
**Authentication:** Required

**⚠️ Important:** Note that the route is `/api/referral/stats` (singular), not `/api/referral/stats` (plural)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Making Requests](#making-requests)
3. [Response Format](#response-format)
4. [Code Examples](#code-examples)
5. [Error Handling](#error-handling)
6. [UI Implementation Ideas](#ui-implementation-ideas)
7. [Best Practices](#best-practices)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Authentication

### Headers Required

```http
Authorization: Bearer YOUR_TOKEN_HERE
```

### Supported Token Types

1. **JWT Token** (Web applications)
   - Obtained from login endpoint
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

2. **Firebase Token** (Mobile applications)
   - Obtained from Firebase Authentication
   - Example: Firebase ID token from `user.getIdToken()`

Both token types work with this endpoint - no need to use different endpoints for web vs. mobile!

---

## Making Requests

### Basic Request

Fetch basic statistics without the list of referred users:

```http
GET /api/referral/stats
Authorization: Bearer YOUR_TOKEN
```

### Detailed Request

Fetch statistics WITH the list of all referred users:

```http
GET /api/referral/stats?detailed=true
Authorization: Bearer YOUR_TOKEN
```

**Recommendation**: Use basic request for dashboard widgets, detailed request for full referral pages.

---

## Response Format

### Success Response Structure

```json
{
  "success": true,
  "data": {
    // All statistics here
  },
  "message": "Referral statistics retrieved successfully"
}
```

### Data Object Fields

```typescript
interface ReferralStatsResponse {
  success: boolean;
  data: {
    referralCode: string;              // e.g., "A7B3C9D2"
    referralLink: string;              // e.g., "https://app.com/signup?referral=A7B3C9D2"
    totalReferrals: number;            // e.g., 15
    referralLimit: number;             // e.g., 50
    remainingReferrals: number;        // e.g., 35
    referralLimitReached: boolean;     // e.g., false

    referralStats: {
      activeReferrals: number;         // Users who purchased
      pendingReferrals: number;        // Users who signed up but didn't purchase
      completedReferrals: number;      // Fully paid referrals
      cancelledReferrals: number;      // Cancelled referrals
    };

    earnings: {
      totalEarnings: number;           // Total earned (e.g., 4500.00)
      totalCommission: number;         // Total possible (e.g., 6000.00)
      availableBalance: number;        // Can withdraw (e.g., 3200.00)
      totalWithdrawn: number;          // Already withdrawn (e.g., 1300.00)
    };

    purchases: {
      totalProducts: number;           // Products bought by referred users
      totalPurchaseValue: number;      // Total value of purchases
    };

    referredUsers?: Array<{            // Only present when ?detailed=true
      id: string;
      name: string;
      email: string;
      profilePicture: string;
      joinedAt: string;                // ISO 8601 date
      status: "ACTIVE" | "PENDING" | "COMPLETED" | "CANCELLED";
      totalProducts: number;
      totalCommission: number;
    }>;
  };
  message: string;
}
```

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

#### Basic Request

```javascript
async function fetchReferralStats() {
  try {
    const token = localStorage.getItem('authToken'); // or however you store it

    const response = await fetch('https://api.epielio.com/api/referral/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      console.log('Referral Code:', data.data.referralCode);
      console.log('Total Referrals:', data.data.totalReferrals);
      console.log('Available Balance:', data.data.earnings.availableBalance);
      return data.data;
    } else {
      console.error('API returned error:', data.error);
    }
  } catch (error) {
    console.error('Failed to fetch referral stats:', error);
    throw error;
  }
}

// Usage
fetchReferralStats().then(stats => {
  // Update your UI with stats
  document.getElementById('referral-code').textContent = stats.referralCode;
  document.getElementById('total-referrals').textContent = stats.totalReferrals;
});
```

#### Detailed Request with Async/Await

```javascript
async function fetchDetailedReferralStats() {
  const token = localStorage.getItem('authToken');

  const response = await fetch(
    'https://api.epielio.com/api/referral/stats?detailed=true',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const result = await response.json();
  return result.data;
}

// Usage
const stats = await fetchDetailedReferralStats();
stats.referredUsers.forEach(user => {
  console.log(`${user.name} - ${user.status} - ₹${user.totalCommission}`);
});
```

---

### React (with Hooks)

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function ReferralDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');

        const response = await axios.get(
          'https://api.epielio.com/api/referral/stats',
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.data.success) {
          setStats(response.data.data);
        } else {
          setError('Failed to load stats');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div>Loading referral stats...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return null;

  return (
    <div className="referral-dashboard">
      <h2>Your Referral Statistics</h2>

      <div className="stat-card">
        <h3>Referral Code</h3>
        <p className="code">{stats.referralCode}</p>
        <button onClick={() => navigator.clipboard.writeText(stats.referralLink)}>
          Copy Link
        </button>
      </div>

      <div className="stat-card">
        <h3>Referrals</h3>
        <p>{stats.totalReferrals} / {stats.referralLimit}</p>
        <progress
          value={stats.totalReferrals}
          max={stats.referralLimit}
        />
        <p>{stats.remainingReferrals} slots remaining</p>
      </div>

      <div className="stat-card">
        <h3>Earnings</h3>
        <p className="amount">₹{stats.earnings.availableBalance.toFixed(2)}</p>
        <small>Available Balance</small>
      </div>

      <div className="stat-card">
        <h3>Status Breakdown</h3>
        <ul>
          <li>Active: {stats.referralStats.activeReferrals}</li>
          <li>Pending: {stats.referralStats.pendingReferrals}</li>
          <li>Completed: {stats.referralStats.completedReferrals}</li>
        </ul>
      </div>
    </div>
  );
}

export default ReferralDashboard;
```

---

### React Native (Mobile)

```jsx
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';

function ReferralScreen() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferralStats = async () => {
      try {
        // Get Firebase ID token
        const token = await auth().currentUser.getIdToken();

        const response = await fetch(
          'https://api.epielio.com/api/referral/stats',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }
        );

        const result = await response.json();

        if (result.success) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReferralStats();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Referral Statistics</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Your Referral Code</Text>
        <Text style={styles.code}>{stats?.referralCode}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Total Referrals</Text>
        <Text style={styles.value}>
          {stats?.totalReferrals} / {stats?.referralLimit}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Available Balance</Text>
        <Text style={styles.amount}>
          ₹{stats?.earnings.availableBalance.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 12, borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  code: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },
  value: { fontSize: 18, fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' }
});

export default ReferralScreen;
```

---

### Flutter (Mobile)

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';

class ReferralStatsScreen extends StatefulWidget {
  @override
  _ReferralStatsScreenState createState() => _ReferralStatsScreenState();
}

class _ReferralStatsScreenState extends State<ReferralStatsScreen> {
  Map<String, dynamic>? stats;
  bool isLoading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    fetchReferralStats();
  }

  Future<void> fetchReferralStats() async {
    try {
      // Get Firebase token
      User? user = FirebaseAuth.instance.currentUser;
      String? token = await user?.getIdToken();

      final response = await http.get(
        Uri.parse('https://api.epielio.com/api/referral/stats'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success']) {
          setState(() {
            stats = data['data'];
            isLoading = false;
          });
        }
      } else {
        setState(() {
          error = 'Failed to load stats';
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (error != null) {
      return Scaffold(
        body: Center(child: Text('Error: $error')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text('Referral Stats')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Referral Code', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    SizedBox(height: 8),
                    Text(
                      stats?['referralCode'] ?? '',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 16),
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Referrals', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    SizedBox(height: 8),
                    Text(
                      '${stats?['totalReferrals']} / ${stats?['referralLimit']}',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
                    ),
                    SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: (stats?['totalReferrals'] ?? 0) / (stats?['referralLimit'] ?? 1),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 16),
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Available Balance', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    SizedBox(height: 8),
                    Text(
                      '₹${stats?['earnings']?['availableBalance']?.toStringAsFixed(2) ?? '0.00'}',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

### Axios (Advanced)

```javascript
import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'https://your-api.com/api',
  timeout: 10000,
});

// Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Referral stats service
const referralService = {
  // Get basic stats
  getStats: async () => {
    const response = await api.get('/referrals/stats');
    return response.data.data;
  },

  // Get detailed stats with referred users
  getDetailedStats: async () => {
    const response = await api.get('/referrals/stats?detailed=true');
    return response.data.data;
  },
};

// Usage
async function displayReferralInfo() {
  try {
    const stats = await referralService.getStats();
    console.log('Referral Code:', stats.referralCode);
    console.log('Total Referrals:', stats.totalReferrals);
    console.log('Available Balance:', stats.earnings.availableBalance);
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('User not authenticated');
      // Redirect to login
    } else {
      console.error('Error:', error.message);
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process the response data |
| 401 | Unauthorized | Redirect to login, token expired/invalid |
| 404 | Not Found | User doesn't exist (rare, contact support) |
| 500 | Server Error | Show error message, retry later |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE"  // Optional
}
```

### Example Error Handler

```javascript
async function fetchStatsWithErrorHandling() {
  try {
    const response = await fetch('https://api.epielio.com/api/referral/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle HTTP errors
      if (response.status === 401) {
        // Token expired or invalid
        console.error('Please log in again');
        redirectToLogin();
      } else if (response.status === 500) {
        console.error('Server error, please try again later');
      }
      throw new Error(data.error || 'Request failed');
    }

    if (!data.success) {
      // Handle API-level errors
      throw new Error(data.error || 'Unknown error');
    }

    return data.data;

  } catch (error) {
    console.error('Failed to fetch stats:', error);

    // Show user-friendly error message
    showErrorToast('Unable to load referral statistics. Please try again.');

    throw error;
  }
}
```

---

## UI Implementation Ideas

### 1. Dashboard Card

```jsx
function ReferralCard({ stats }) {
  const percentage = (stats.totalReferrals / stats.referralLimit) * 100;

  return (
    <div className="referral-card">
      <div className="header">
        <h3>Referral Program</h3>
        <span className="badge">{stats.totalReferrals} friends</span>
      </div>

      <div className="referral-code-section">
        <label>Your Referral Code</label>
        <div className="code-display">
          <code>{stats.referralCode}</code>
          <button onClick={() => copyToClipboard(stats.referralLink)}>
            📋 Copy Link
          </button>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-header">
          <span>{stats.totalReferrals} of {stats.referralLimit} used</span>
          <span>{stats.remainingReferrals} remaining</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="earnings-section">
        <div className="earning-item">
          <span className="label">Available Balance</span>
          <span className="amount">₹{stats.earnings.availableBalance}</span>
        </div>
        <div className="earning-item">
          <span className="label">Total Earned</span>
          <span className="amount">₹{stats.earnings.totalEarnings}</span>
        </div>
      </div>

      {stats.referralLimitReached && (
        <div className="alert">
          ⚠️ You've reached your referral limit!
        </div>
      )}
    </div>
  );
}
```

### 2. Referred Users List

```jsx
function ReferredUsersList({ users }) {
  const statusColors = {
    ACTIVE: '#4CAF50',
    PENDING: '#FF9800',
    COMPLETED: '#2196F3',
    CANCELLED: '#F44336'
  };

  return (
    <div className="referred-users-list">
      <h3>Your Referred Friends ({users.length})</h3>

      {users.map(user => (
        <div key={user.id} className="user-item">
          <img
            src={user.profilePicture || '/default-avatar.png'}
            alt={user.name}
            className="avatar"
          />

          <div className="user-info">
            <h4>{user.name}</h4>
            <p className="email">{user.email}</p>
            <p className="join-date">
              Joined {new Date(user.joinedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="user-stats">
            <span
              className="status-badge"
              style={{ backgroundColor: statusColors[user.status] }}
            >
              {user.status}
            </span>
            <div className="stats-row">
              <span>Products: {user.totalProducts}</span>
              <span>Earned: ₹{user.totalCommission}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3. Earnings Chart

```jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

function EarningsChart({ stats }) {
  const data = [
    { name: 'Available', value: stats.earnings.availableBalance },
    { name: 'Withdrawn', value: stats.earnings.totalWithdrawn },
    { name: 'Pending', value: stats.earnings.totalCommission - stats.earnings.totalEarnings }
  ];

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800'];

  return (
    <div className="earnings-chart">
      <h3>Earnings Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ₹${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 4. Share Component

```jsx
function ShareReferralLink({ referralLink, referralCode }) {
  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(
      `Join our app using my referral code: ${referralCode}\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(`Join using my referral code: ${referralCode}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${referralLink}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="share-section">
      <h3>Share Your Referral Link</h3>

      <div className="link-display">
        <input type="text" value={referralLink} readOnly />
        <button onClick={copyLink}>Copy</button>
      </div>

      <div className="share-buttons">
        <button onClick={shareViaWhatsApp} className="whatsapp-btn">
          📱 WhatsApp
        </button>
        <button onClick={shareViaTwitter} className="twitter-btn">
          🐦 Twitter
        </button>
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Caching

Cache the stats locally to reduce API calls:

```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class ReferralStatsCache {
  constructor() {
    this.cache = null;
    this.timestamp = null;
  }

  async get(fetchFn) {
    const now = Date.now();

    // Return cached data if still valid
    if (this.cache && this.timestamp && (now - this.timestamp < CACHE_DURATION)) {
      return this.cache;
    }

    // Fetch fresh data
    this.cache = await fetchFn();
    this.timestamp = now;

    return this.cache;
  }

  invalidate() {
    this.cache = null;
    this.timestamp = null;
  }
}

const statsCache = new ReferralStatsCache();

// Usage
const stats = await statsCache.get(() => fetchReferralStats());
```

### 2. Loading States

Always show loading indicators:

```jsx
function ReferralStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="loading-skeleton">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    );
  }

  return <ReferralDashboard stats={stats} />;
}
```

### 3. Refresh Mechanism

Allow users to manually refresh:

```jsx
function ReferralDashboard() {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  return (
    <div>
      <button onClick={refresh} disabled={refreshing}>
        {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
      </button>
      {/* Rest of component */}
    </div>
  );
}
```

### 4. Pull-to-Refresh (Mobile)

```jsx
import { RefreshControl, ScrollView } from 'react-native';

function ReferralScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReferralStats();
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Your content */}
    </ScrollView>
  );
}
```

### 5. Optimistic Updates

When user performs an action that affects stats, update UI immediately:

```javascript
async function shareReferralCode() {
  // Optimistically update UI
  setStats(prev => ({
    ...prev,
    // Update what you expect to change
  }));

  try {
    await api.post('/share');

    // Refresh stats to get accurate data
    await fetchStats();
  } catch (error) {
    // Revert on error
    await fetchStats();
  }
}
```

---

## Testing

### 1. Test with Mock Data

```javascript
// mockData.js
export const mockReferralStats = {
  success: true,
  data: {
    referralCode: "TEST123",
    referralLink: "https://app.com/signup?referral=TEST123",
    totalReferrals: 5,
    referralLimit: 50,
    remainingReferrals: 45,
    referralLimitReached: false,
    referralStats: {
      activeReferrals: 3,
      pendingReferrals: 2,
      completedReferrals: 0,
      cancelledReferrals: 0
    },
    earnings: {
      totalEarnings: 1500.00,
      totalCommission: 2000.00,
      availableBalance: 1200.00,
      totalWithdrawn: 300.00
    },
    purchases: {
      totalProducts: 8,
      totalPurchaseValue: 25000.00
    }
  },
  message: "Referral statistics retrieved successfully"
};

// Use in development
const stats = process.env.NODE_ENV === 'development'
  ? mockReferralStats.data
  : await fetchReferralStats();
```

### 2. Test Error Cases

```javascript
// Test 401 Unauthorized
localStorage.removeItem('authToken');
await fetchStats(); // Should redirect to login

// Test 500 Error
// Mock the API to return 500
// Should show error message

// Test network failure
// Disconnect network
// Should show "Check your connection" message
```

### 3. Test Different States

- User with 0 referrals
- User with max referrals (limit reached)
- User with pending referrals (no purchases yet)
- User with high earnings
- User with 0 earnings

---

## Troubleshooting

### Problem: "401 Unauthorized" Error

**Causes:**
- Token expired
- Token not included in request
- Invalid token format

**Solutions:**
```javascript
// Check token exists
const token = localStorage.getItem('authToken');
if (!token) {
  redirectToLogin();
  return;
}

// Check token format
console.log('Token:', token.substring(0, 20) + '...');

// Try refreshing token
const newToken = await refreshAuthToken();
```

---

### Problem: Stats Show 0 Referrals But User Has Referred People

**Causes:**
- Referred users didn't use the referral code during signup
- Database sync issue

**Solutions:**
- Verify the referred user's `referredBy` field in database
- Contact backend team if data is missing

---

### Problem: Slow Response Time

**Causes:**
- Large number of referred users with `detailed=true`
- Network latency
- Server load

**Solutions:**
```javascript
// Use basic endpoint for quick display
const basicStats = await fetch('/api/referral/stats');

// Load detailed view only when needed (lazy loading)
button.onclick = async () => {
  const detailedStats = await fetch('/api/referral/stats?detailed=true');
};

// Implement pagination if you have many referred users
// (Note: Not currently supported, request feature from backend team)
```

---

### Problem: Numbers Don't Match User Expectations

**Causes:**
- User confusion about what each number means
- Timing of commission processing (daily cron)

**Solutions:**
- Add tooltips explaining each metric
- Show "Last Updated" timestamp
- Add FAQ section

```jsx
<Tooltip content="This is the amount currently available for withdrawal">
  <span>Available Balance: ₹{stats.earnings.availableBalance}</span>
</Tooltip>
```

---

## Performance Tips

1. **Use Basic Endpoint by Default**
   - Only use `?detailed=true` when showing full referral list
   - Saves bandwidth and reduces response time

2. **Implement Pagination** (Future Feature)
   - Request this from backend team if you have users with 100+ referrals
   - Example: `?page=1&limit=20&detailed=true`

3. **Cache Aggressively**
   - Stats don't change frequently
   - 5-minute cache is reasonable
   - Invalidate cache after user actions (share, withdraw)

4. **Show Progressive Loading**
   ```jsx
   // Load basic info first
   const basicStats = await fetchBasicStats();
   setStats(basicStats);

   // Then load detailed info
   const detailedStats = await fetchDetailedStats();
   setStats(detailedStats);
   ```

5. **Debounce Refresh**
   ```javascript
   let lastRefresh = 0;
   const DEBOUNCE_TIME = 2000; // 2 seconds

   function refresh() {
     const now = Date.now();
     if (now - lastRefresh < DEBOUNCE_TIME) {
       return; // Ignore rapid refresh attempts
     }
     lastRefresh = now;
     fetchStats();
   }
   ```

---

## Feature Requests

If you need any of these features, contact the backend team:

- [ ] Pagination for referred users list
- [ ] Filter/sort referred users by status
- [ ] Export stats as PDF/CSV
- [ ] Historical data (time-based analytics)
- [ ] Webhook notifications when referral limits change
- [ ] Bulk operations (e.g., cancel multiple referrals)

---

## Support

### Resources

- **API Base URL**: `https://your-api-domain.com`
- **API Documentation**: [Link to Swagger/Postman docs]
- **Backend Team**: [Contact info]
- **Slack Channel**: #api-support

### Reporting Issues

When reporting issues, include:

1. Request URL and headers (remove sensitive tokens!)
2. Response received
3. Expected behavior
4. Screenshots if UI-related
5. Device/browser information

**Example:**
```
Request: GET /api/referral/stats
Headers: Authorization: Bearer eyJ... (first 20 chars)
Response: 401 Unauthorized
Expected: 200 with stats data
Browser: Chrome 120.0 on Windows
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial release of referral stats endpoint |

---

**Happy Coding! 🚀**

For questions or feedback, reach out to the backend team.
