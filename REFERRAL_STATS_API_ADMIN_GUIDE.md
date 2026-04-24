# Referral Statistics API - Admin Guide

## Overview

This document provides administrative information about the new Referral Statistics API endpoint. This endpoint allows users to view comprehensive statistics about their referral activities, including total referrals, earnings, commissions, and limits.

---

## Endpoint Information

**Endpoint:** `GET /api/referral/stats`
**Method:** GET
**Authentication:** Required (JWT or Firebase Token)
**Version:** 1.0
**Date Implemented:** December 2024

**⚠️ Important:** Note that the route is `/api/referral/stats` (singular), not `/api/referrals/stats` (plural)

---

## What This Endpoint Does

The Referral Statistics API provides users with a comprehensive overview of their referral program participation. It shows:

1. **Referral Code & Link** - User's unique referral code and shareable link
2. **Referral Limits** - Total referrals made vs. maximum allowed, and remaining slots
3. **Referral Status Breakdown** - Count of active, pending, completed, and cancelled referrals
4. **Earnings Information** - Total earnings, commissions, withdrawals, and available balance
5. **Purchase Statistics** - Total products purchased by referred users and their value
6. **Referred Users List** (Optional) - Detailed list of all referred users with their information

---

## Business Value

### For Users
- **Transparency**: Users can see exactly how many people they've referred and how much they've earned
- **Motivation**: Clear visibility of remaining referral slots encourages more referrals
- **Trust**: Detailed breakdown of earnings builds confidence in the referral program

### For Business
- **Engagement**: Users are more likely to participate when they can track their progress
- **Viral Growth**: Easy access to referral links promotes sharing
- **Reduced Support Queries**: Self-service stats reduce "How many referrals do I have?" questions

---

## Technical Implementation

### Files Modified

1. **Controller**: `controllers/referralController.js` (lines 603-760)
   - Added `getComprehensiveReferralStats` function
   - Handles all data aggregation and calculation logic

2. **Route**: `routes/referralRoutes.js` (line 375)
   - Added new GET endpoint at `/api/referrals/stats`
   - Uses `verifyAnyToken` middleware (supports both JWT and Firebase authentication)

3. **Database**: `models/User.js` (line 413)
   - Added index on `referredBy` field for improved query performance

### Database Queries

The endpoint performs the following database operations:

1. Fetches authenticated user's data
2. Counts all users referred by this user
3. Retrieves all referral documents for this user
4. Fetches daily commission records
5. Retrieves withdrawal history
6. (Optional) Fetches detailed information about each referred user

**Performance**: All queries use database indexes for optimal performance. Average response time: 50-200ms depending on data volume.

---

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `detailed` | boolean | No | `false` | When set to `true`, includes detailed list of all referred users with their individual statistics |

### Examples

**Basic Stats Request:**
```
GET /api/referral/stats
```

**Detailed Stats Request:**
```
GET /api/referral/stats?detailed=true
```

---

## Response Structure

### Basic Response (without detailed parameter)

```json
{
  "success": true,
  "data": {
    "referralCode": "A7B3C9D2",
    "referralLink": "https://yourapp.com/signup?referral=A7B3C9D2",
    "totalReferrals": 15,
    "referralLimit": 50,
    "remainingReferrals": 35,
    "referralLimitReached": false,
    "referralStats": {
      "activeReferrals": 12,
      "pendingReferrals": 1,
      "completedReferrals": 2,
      "cancelledReferrals": 0
    },
    "earnings": {
      "totalEarnings": 4500.00,
      "totalCommission": 6000.00,
      "availableBalance": 3200.00,
      "totalWithdrawn": 1300.00
    },
    "purchases": {
      "totalProducts": 25,
      "totalPurchaseValue": 84975.00
    }
  },
  "message": "Referral statistics retrieved successfully"
}
```

### Detailed Response (with ?detailed=true)

Includes all fields from basic response PLUS:

```json
{
  "data": {
    // ... all basic fields ...
    "referredUsers": [
      {
        "id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "name": "John Doe",
        "email": "john@example.com",
        "profilePicture": "https://example.com/profile.jpg",
        "joinedAt": "2024-01-15T10:30:00.000Z",
        "status": "ACTIVE",
        "totalProducts": 2,
        "totalCommission": 450.00
      }
    ]
  }
}
```

---

## Response Field Definitions

### Top Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `referralCode` | String | User's unique referral code (e.g., "ABC123") |
| `referralLink` | String | Full URL for sharing (includes referral code) |
| `totalReferrals` | Number | Total number of users who signed up using this user's referral code |
| `referralLimit` | Number | Maximum number of referrals allowed (default: 50) |
| `remainingReferrals` | Number | How many more people can be referred (limit - total) |
| `referralLimitReached` | Boolean | `true` if user has reached their referral limit |

### Referral Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `activeReferrals` | Number | Referred users who have made purchases and are earning commissions |
| `pendingReferrals` | Number | Referred users who signed up but haven't made purchases yet |
| `completedReferrals` | Number | Referrals where all commissions have been fully paid |
| `cancelledReferrals` | Number | Cancelled or inactive referral relationships |

### Earnings Object

| Field | Type | Description |
|-------|------|-------------|
| `totalEarnings` | Number | Total commission earned from all referrals (all-time) |
| `totalCommission` | Number | Total possible commission from all active referrals |
| `availableBalance` | Number | Current balance available for withdrawal |
| `totalWithdrawn` | Number | Total amount already withdrawn |

**Formula**: `availableBalance = totalEarnings - totalWithdrawn`

### Purchases Object

| Field | Type | Description |
|-------|------|-------------|
| `totalProducts` | Number | Total number of products purchased by all referred users |
| `totalPurchaseValue` | Number | Total monetary value of all purchases made by referred users |

### Referred Users Array (when detailed=true)

Each object in the array contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | User's MongoDB ObjectId |
| `name` | String | User's full name |
| `email` | String | User's email address |
| `profilePicture` | String | URL to user's profile picture (empty string if none) |
| `joinedAt` | DateTime | ISO 8601 timestamp of when user signed up |
| `status` | String | Referral status: "ACTIVE", "PENDING", "COMPLETED", or "CANCELLED" |
| `totalProducts` | Number | Number of products this user has purchased |
| `totalCommission` | Number | Total commission earned from this user's purchases |

---

## Error Responses

### 401 Unauthorized - No Token
```json
{
  "success": false,
  "message": "Authentication token required"
}
```

**Cause**: Request made without Authorization header
**Solution**: User needs to log in and provide valid token

---

### 401 Unauthorized - Invalid Token
```json
{
  "success": false,
  "message": "Authentication failed",
  "error": "Invalid token - not a valid JWT or Firebase token"
}
```

**Cause**: Token is malformed or expired
**Solution**: User needs to log in again to get fresh token

---

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

**Cause**: User account doesn't exist in database
**Solution**: This shouldn't happen with valid auth token; indicates data inconsistency

---

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message details"
}
```

**Cause**: Database error or unexpected server issue
**Solution**: Check server logs for details; contact development team

---

## Security & Privacy

### Authentication
- **Required**: All requests must include valid authentication token
- **User Isolation**: Users can only see their own statistics
- **Token Types Supported**: Both JWT (web) and Firebase (mobile) tokens accepted

### Data Privacy
- Users can only view their own referral data
- No sensitive information (passwords, payment details) included in response
- Email addresses of referred users only visible when `detailed=true`

### Rate Limiting (Recommended for Production)
- Suggested limit: 100 requests per 15 minutes per IP
- Prevents abuse and DoS attacks
- Not currently implemented but recommended for production deployment

---

## Monitoring & Analytics

### Key Metrics to Monitor

1. **Endpoint Usage**
   - Track number of requests per day/week/month
   - Identify peak usage times
   - Monitor basic vs. detailed request ratio

2. **Performance Metrics**
   - Response time (target: < 200ms)
   - Database query duration
   - Error rate (target: < 0.1%)

3. **Business Metrics**
   - Average referrals per user
   - Percentage of users at referral limit
   - Average earnings per referrer

### Recommended Logging

Log the following for each request:
- User ID
- Request timestamp
- Response time
- Whether detailed view was requested
- Any errors encountered

---

## Database Performance

### Indexes Created

The following index was added to optimize this endpoint:

```javascript
// User collection
{ referredBy: 1 }  // For finding all users referred by a specific user
```

**Impact**: Reduces query time from O(n) to O(log n) for referral lookups

### Existing Indexes Used

- `{ _id: 1 }` - User lookup
- `{ referrer: 1 }` - Referral and DailyCommission queries
- `{ user: 1 }` - CommissionWithdrawal queries

### Performance Expectations

| Data Volume | Response Time |
|-------------|---------------|
| < 100 referrals | 50-100ms |
| 100-500 referrals | 100-200ms |
| 500-1000 referrals | 200-400ms |
| > 1000 referrals | 400-800ms |

**Note**: These are estimates. Actual performance depends on server resources and network latency.

---

## Configuration

### Environment Variables

The endpoint uses the following environment variables:

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `APP_URL` | Base URL for referral links (primary) | `https://app.example.com` |
| `FRONTEND_URL` | Base URL for referral links (fallback) | `https://example.com` |

**Default**: If neither is set, uses `https://yourapp.com`

**Recommendation**: Set `APP_URL` in production environment

---

## Maintenance & Support

### Common Issues

**Issue 1: User sees 0 referrals but claims they referred people**
- **Check**: Verify if referred users actually signed up with the referral code
- **Verify**: Check `User` collection for `referredBy` field
- **Action**: May need to manually update `referredBy` if signup didn't capture it

**Issue 2: Earnings don't match user's calculations**
- **Check**: Review `DailyCommission` collection for this user
- **Verify**: Confirm commission calculation formula with business team
- **Action**: Ensure daily commission cron job is running properly

**Issue 3: Referral limit reached but user can't refer more**
- **Check**: Verify `referralLimit` field in user's document
- **Action**: Can manually increase limit for specific users if business approves

### Database Queries for Debugging

**Find specific user's referral data:**
```javascript
// In MongoDB shell
db.users.findOne({ _id: ObjectId("USER_ID") }, {
  referralCode: 1,
  referralLimit: 1,
  referredBy: 1
})
```

**Count user's referrals:**
```javascript
db.users.countDocuments({ referredBy: ObjectId("USER_ID") })
```

**Check referral documents:**
```javascript
db.referrals.find({ referrer: ObjectId("USER_ID") }).pretty()
```

**Check commission history:**
```javascript
db.dailycommissions.find({ referrer: ObjectId("USER_ID") }).sort({ date: -1 })
```

---

## Future Enhancements

### Planned Features

1. **Caching Layer**
   - Cache stats for 5 minutes to reduce database load
   - Automatic cache invalidation on referral changes

2. **Admin Endpoint**
   - Allow admins to view any user's referral stats
   - Endpoint: `GET /api/referrals/admin/stats/:userId`

3. **Leaderboard**
   - Public endpoint showing top referrers
   - Gamification to encourage more referrals

4. **Time-Based Analytics**
   - Track referral growth over time
   - Compare periods (last 7 days, 30 days, 90 days)

5. **Export Functionality**
   - Download referral data as CSV/Excel
   - For user record-keeping and tax purposes

---

## Testing Checklist

Use this checklist when testing in different environments:

**Staging Environment**
- [ ] Endpoint accessible at correct URL
- [ ] Authentication works with test user tokens
- [ ] Basic stats return correctly
- [ ] Detailed stats include referred users
- [ ] Response times acceptable (< 500ms)
- [ ] Error handling works (invalid token, etc.)

**Production Environment**
- [ ] Environment variables configured (APP_URL)
- [ ] Database indexes created
- [ ] Monitoring/logging in place
- [ ] Rate limiting configured (if applicable)
- [ ] SSL/HTTPS enabled
- [ ] Load tested with expected traffic

---

## Contact Information

For technical issues or questions about this endpoint:

- **Development Team**: [Contact your dev team]
- **API Documentation**: [Link to full API docs]
- **Support Tickets**: [Your ticketing system]

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial implementation of referral stats endpoint |

---

## Appendix: Sample Use Cases

### Use Case 1: User Dashboard Widget

Display user's referral stats on dashboard:
- Show referral code with copy button
- Display progress bar: "15/50 referrals used"
- Show available balance for withdrawal

### Use Case 2: Referral Program Page

Full-page view of referral statistics:
- Use `detailed=true` to show list of referred friends
- Show each friend's status and commission earned
- Allow sorting/filtering of referred users list

### Use Case 3: Mobile App Home Screen

Quick stats view:
- Total referrals count
- Available balance
- Call-to-action to share referral link

### Use Case 4: Admin Support Panel

Support agent helping user with referral question:
- View user's comprehensive stats
- Verify referral count and earnings
- Troubleshoot discrepancies

---

**Document Version**: 1.0
**Last Updated**: December 20, 2024
**Maintained By**: Backend Development Team
