# Payment Intelligence API — Frontend Integration Guide

**Version:** 1.1
**Last Updated:** 2026-02-28
**Base URL (Production):** `https://api.epielio.com`
**Base URL (Development):** `http://localhost:5000`
**Prepared for:** Admin Panel Frontend Team
**Module:** Admin Panel — Payment Intelligence

> **v1.1 Changes:** Settlement list now uses `page`/`limit`/`from`/`to` params (replaced `count`/`skip`). Settlement detail recon now uses `reconPage`/`reconLimit` (replaced `reconCount`/`reconSkip`). Response shape changed to `pagination` object with `hasMore`/`nextPage`.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Standard Response Envelope](#2-standard-response-envelope)
3. [Error Handling](#3-error-handling)
4. [Endpoint Reference](#4-endpoint-reference)
   - [4.1 List Payments](#41-list-payments)
   - [4.2 Payment Detail](#42-payment-detail)
   - [4.3 Payment Analytics](#43-payment-analytics)
   - [4.4 Initiate Refund](#44-initiate-refund)
   - [4.5 List Settlements](#45-list-settlements)
   - [4.6 Settlement Detail](#46-settlement-detail)
5. [Data Model Reference](#5-data-model-reference)
   - [PaymentRecord Object](#paymentrecord-object)
   - [Card Details Object](#card-details-object)
   - [UPI Details Object](#upi-details-object)
   - [Netbanking Details Object](#netbanking-details-object)
   - [Wallet Details Object](#wallet-details-object)
   - [EMI Details Object](#emi-details-object)
   - [Acquirer Data Object](#acquirer-data-object)
   - [Refund Entry Object](#refund-entry-object)
   - [Settlement Object](#settlement-object)
6. [Enumerations](#6-enumerations)
7. [Unit Conventions](#7-unit-conventions)
8. [Admin Panel UI Guide](#8-admin-panel-ui-guide)
9. [Suggested API Call Flow](#9-suggested-api-call-flow)

---

## 1. Authentication

All payment intelligence endpoints require **admin-level JWT authentication**.

### How to Authenticate

Include the JWT token in every request header:

```
Authorization: Bearer <your_admin_jwt_token>
```

The token is obtained by logging in via the admin auth endpoint:

```
POST /api/admin-auth/login
```

If the token is missing, expired, or belongs to a non-admin user, the API will respond with an appropriate error (see [Error Handling](#3-error-handling)).

> **Note:** Only users with `role: "admin"` or `role: "super_admin"` can access these endpoints.

---

## 2. Standard Response Envelope

Every successful response is wrapped in the following structure:

```json
{
  "success": true,
  "message": "Human-readable description of result",
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

The actual payload you work with is always inside `data`.

---

## 3. Error Handling

All error responses follow a consistent structure:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "Optional technical error detail"
}
```

### HTTP Status Codes

| Status Code | Meaning |
|-------------|---------|
| `200` | Success |
| `400` | Bad Request — invalid input, wrong parameter format, or business rule violation |
| `401` | Unauthorized — missing or invalid JWT token |
| `403` | Forbidden — user does not have admin role |
| `404` | Not Found — payment record or settlement does not exist |
| `502` | Bad Gateway — Razorpay API call failed (downstream error) |
| `500` | Internal Server Error — unexpected server-side error |

### Example Error Response (400)

```json
{
  "success": false,
  "message": "amount must be a positive integer in paise (e.g. 10000 for ₹100)."
}
```

### Example Error Response (404)

```json
{
  "success": false,
  "message": "Payment record not found"
}
```

---

## 4. Endpoint Reference

---

### 4.1 List Payments

Fetch a paginated, filterable list of all payment records. Includes a summary row with financial totals for the filtered set — useful for the table footer.

**Endpoint**

```
GET /api/admin/payments/list
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | `number` | No | Page number. Default: `1` |
| `limit` | `number` | No | Records per page. Default: `20`, Max: `100` |
| `startDate` | `string` | No | Filter payments created on/after this date. Format: ISO 8601 (e.g. `2025-01-01` or `2025-01-01T00:00:00.000Z`) |
| `endDate` | `string` | No | Filter payments created on/before this date. Format: ISO 8601 |
| `method` | `string` | No | Filter by payment method. Allowed: `card`, `upi`, `netbanking`, `wallet`, `emi` |
| `status` | `string` | No | Filter by payment status. Allowed: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`, `CANCELLED` |
| `search` | `string` | No | Full-text search across customer email, customer phone number, and user name |
| `sortBy` | `string` | No | Sort order. Allowed: `createdAt` (oldest first), `-createdAt` (newest first, default), `amount` (lowest first), `-amount` (highest first) |

**Example Request**

```
GET /api/admin/payments/list?page=1&limit=20&method=upi&status=COMPLETED&startDate=2025-01-01&endDate=2025-01-31&sortBy=-createdAt
Authorization: Bearer <token>
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Payment records fetched successfully",
  "data": {
    "payments": [
      {
        "_id": "64f1b2c3d4e5f6a7b8c9d0e1",
        "paymentId": "PAY-1705301234567",
        "amount": 500,
        "installmentNumber": 3,
        "paymentMethod": "RAZORPAY",
        "status": "COMPLETED",
        "razorpayOrderId": "order_OdFWCjrXFsQ0pO",
        "razorpayPaymentId": "pay_OdFWXjrYFsQ0pQ",
        "razorpayVerified": true,
        "razorpayAmount": 50000,
        "razorpayCurrency": "INR",
        "razorpayStatus": "captured",
        "razorpayMethod": "upi",
        "razorpayFee": 590,
        "razorpayTax": 90,
        "razorpayEmail": "customer@example.com",
        "razorpayContact": "+919876543210",
        "upiDetails": {
          "vpa": "customer@okicici",
          "username": "customer",
          "handle": "okicici"
        },
        "acquirerData": {
          "rrn": "512345678901",
          "upiTransactionId": "316522221949"
        },
        "completedAt": "2025-01-15T10:30:00.000Z",
        "createdAt": "2025-01-15T10:29:45.000Z",
        "user": {
          "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
          "name": "Rahul Sharma",
          "email": "customer@example.com",
          "phoneNumber": "+919876543210"
        },
        "order": {
          "_id": "64f1c2d3e4f5a6b7c8d9e0f1",
          "orderId": "ORD-1705291234"
        }
      }
    ],
    "summary": {
      "totalAmount": 250000,
      "totalFees": 29500,
      "totalTax": 4500,
      "totalRefunded": 5000
    },
    "totalCount": 143,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  },
  "meta": {
    "timestamp": "2025-01-15T10:35:00.000Z"
  }
}
```

**Summary Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `totalAmount` | `number` | Sum of `amount` (in rupees, your app unit) for all records matching the filter |
| `totalFees` | `number` | Sum of `razorpayFee` (in paise) for all records matching the filter |
| `totalTax` | `number` | Sum of `razorpayTax` (in paise) for all records matching the filter |
| `totalRefunded` | `number` | Sum of `razorpayAmountRefunded` (in paise) for all records matching the filter |

> `totalAmount` is in **rupees** (app unit). `totalFees`, `totalTax`, `totalRefunded` are in **paise**. To display fees in rupees: divide by 100.

---

### 4.2 Payment Detail

Fetch the complete record for a single payment, including all Razorpay data (card number mask, UPI handle, bank references, error codes, refund history, etc.).

**Endpoint**

```
GET /api/admin/payments/:paymentId
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentId` | `string` | The internal `paymentId` field (e.g. `PAY-1705301234567`) **or** the MongoDB `_id` of the record |

**Example Request**

```
GET /api/admin/payments/PAY-1705301234567
Authorization: Bearer <token>
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Payment detail fetched successfully",
  "data": {
    "payment": {
      "_id": "64f1b2c3d4e5f6a7b8c9d0e1",
      "paymentId": "PAY-1705301234567",
      "amount": 500,
      "installmentNumber": 3,
      "paymentMethod": "RAZORPAY",
      "status": "COMPLETED",

      "razorpayOrderId": "order_OdFWCjrXFsQ0pO",
      "razorpayPaymentId": "pay_OdFWXjrYFsQ0pQ",
      "razorpaySignature": "abc123...",
      "razorpayVerified": true,

      "razorpayAmount": 50000,
      "razorpayCurrency": "INR",
      "razorpayStatus": "captured",
      "razorpayMethod": "card",
      "razorpayCaptured": true,
      "razorpayFee": 1180,
      "razorpayTax": 180,
      "razorpayEmail": "customer@example.com",
      "razorpayContact": "+919876543210",
      "razorpayInternational": false,
      "razorpayNotes": {},
      "razorpayCreatedAt": "2025-01-15T10:29:45.000Z",
      "razorpayAmountRefunded": 0,
      "razorpayRefundStatus": null,

      "cardDetails": {
        "cardId": "card_OdFW1234ABCD",
        "name": "Rahul Sharma",
        "last4": "4242",
        "network": "Visa",
        "type": "debit",
        "issuer": "HDFC",
        "international": false,
        "subType": "consumer",
        "iin": "424242"
      },

      "upiDetails": null,
      "netbankingDetails": null,
      "walletDetails": null,
      "emiDetails": null,

      "acquirerData": {
        "rrn": "512345678901",
        "authCode": "983421",
        "bankTransactionId": "TXN20250115103000",
        "upiTransactionId": null,
        "arn": "74491631025928000000000"
      },

      "errorCode": null,
      "errorDescription": null,
      "errorSource": null,
      "errorStep": null,
      "errorReason": null,

      "refunds": [],

      "commissionAmount": 50,
      "commissionPercentage": 10,
      "commissionCreditedToReferrer": true,

      "adminMarked": false,
      "adminNote": null,

      "completedAt": "2025-01-15T10:30:00.000Z",
      "createdAt": "2025-01-15T10:29:45.000Z",
      "updatedAt": "2025-01-15T10:30:05.000Z",

      "user": {
        "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "name": "Rahul Sharma",
        "email": "customer@example.com",
        "phoneNumber": "+919876543210"
      },
      "order": {
        "_id": "64f1c2d3e4f5a6b7c8d9e0f1",
        "orderId": "ORD-1705291234",
        "productName": "iPhone 15 Pro",
        "productPrice": 150000,
        "totalDays": 30,
        "status": "ACTIVE",
        "deliveryStatus": "DELIVERED"
      },
      "markedBy": null,
      "cancelledBy": null
    }
  },
  "meta": {
    "timestamp": "2025-01-15T10:35:00.000Z"
  }
}
```

**Error Response `404`**

```json
{
  "success": false,
  "message": "Payment record not found"
}
```

---

### 4.3 Payment Analytics

Aggregated financial statistics for the admin dashboard. Use this to populate summary cards, charts, and failure analysis tables.

**Endpoint**

```
GET /api/admin/payments/analytics
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | `string` | No | Start of the analytics window. Format: ISO 8601. If omitted, all historical data is included. |
| `endDate` | `string` | No | End of the analytics window. Format: ISO 8601 |

**Example Request**

```
GET /api/admin/payments/analytics?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Analytics fetched successfully",
  "data": {
    "totalCollected": 1250000,
    "totalFees": 14750,
    "totalTax": 2250,
    "totalRefunded": 25000,
    "completedCount": 2500,

    "methodBreakdown": {
      "upi": {
        "count": 1800,
        "amount": 900000
      },
      "card": {
        "count": 500,
        "amount": 250000
      },
      "netbanking": {
        "count": 150,
        "amount": 75000
      },
      "wallet": {
        "count": 50,
        "amount": 25000
      }
    },

    "statusBreakdown": {
      "COMPLETED": 2500,
      "FAILED": 120,
      "REFUNDED": 30,
      "PENDING": 15,
      "CANCELLED": 5
    },

    "failedReasons": [
      {
        "errorCode": "BAD_REQUEST_ERROR",
        "count": 55,
        "description": "Payment failed due to incorrect OTP"
      },
      {
        "errorCode": "GATEWAY_ERROR",
        "count": 30,
        "description": "Your payment failed due to a temporary issue at the bank"
      },
      {
        "errorCode": "INSUFFICIENT_BALANCE",
        "count": 20,
        "description": "Payment failed due to insufficient balance in the bank account"
      },
      {
        "errorCode": "CARD_DECLINED",
        "count": 10,
        "description": "Card declined by the issuing bank"
      },
      {
        "errorCode": "AUTHENTICATION_FAILED",
        "count": 5,
        "description": "Authentication failed for the payment"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-01-31T23:59:59.000Z"
  }
}
```

**Analytics Fields Reference**

| Field | Unit | Description |
|-------|------|-------------|
| `totalCollected` | Rupees (app unit) | Sum of `amount` for all COMPLETED payments in the date range |
| `totalFees` | Paise | Sum of Razorpay fees charged. Divide by 100 to display in ₹ |
| `totalTax` | Paise | Sum of GST/tax on fees. Divide by 100 to display in ₹ |
| `totalRefunded` | Paise | Sum of all refunded amounts. Divide by 100 to display in ₹ |
| `completedCount` | Count | Number of COMPLETED payments |
| `methodBreakdown` | Object | Key: payment method. Value: `{ count, amount }` — amount in rupees |
| `statusBreakdown` | Object | Key: status string. Value: count of payments in that status |
| `failedReasons` | Array | Top 5 failure error codes with count and description |

---

### 4.4 Initiate Refund

Initiate a full or partial refund for a COMPLETED Razorpay payment. The refund is processed directly via Razorpay's API and the result is stored in the payment record.

> **Important:** Only payments made via Razorpay (`paymentMethod: "RAZORPAY"`) can be refunded through this endpoint. Wallet payments must be handled separately.

**Endpoint**

```
POST /api/admin/payments/:paymentId/refund
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentId` | `string` | The internal `paymentId` (e.g. `PAY-1705301234567`) or MongoDB `_id` |

**Request Body**

`Content-Type: application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | `number` | No | Amount to refund **in paise** (e.g. `10000` = ₹100). If omitted, the full remaining amount is refunded. |
| `reason` | `string` | No | Reason for the refund. Shown in Razorpay dashboard. Max 255 characters. |
| `speed` | `string` | No | Refund processing speed. `"normal"` (default, 5–7 business days) or `"optimum"` (instant where available) |

**Example Request — Full Refund**

```json
POST /api/admin/payments/PAY-1705301234567/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer requested cancellation",
  "speed": "normal"
}
```

**Example Request — Partial Refund**

```json
POST /api/admin/payments/PAY-1705301234567/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 25000,
  "reason": "Partial refund for delayed delivery",
  "speed": "optimum"
}
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Refund of ₹250.00 initiated successfully",
  "data": {
    "refund": {
      "id": "rfnd_OdFW5678EFGH",
      "entity": "refund",
      "amount": 25000,
      "currency": "INR",
      "payment_id": "pay_OdFWXjrYFsQ0pQ",
      "status": "pending",
      "speed_requested": "optimum",
      "receipt": null,
      "created_at": 1705301234
    },
    "paymentRecord": {
      "_id": "64f1b2c3d4e5f6a7b8c9d0e1",
      "paymentId": "PAY-1705301234567",
      "status": "COMPLETED",
      "razorpayAmountRefunded": 25000,
      "razorpayRefundStatus": "partial",
      "refunds": [
        {
          "razorpayRefundId": "rfnd_OdFW5678EFGH",
          "amount": 25000,
          "status": "pending",
          "speedProcessed": "optimum",
          "arn": null,
          "reason": "Partial refund for delayed delivery",
          "initiatedByAdminEmail": "admin@epielio.com",
          "createdAt": "2025-01-15T11:00:00.000Z"
        }
      ]
    }
  },
  "meta": {
    "timestamp": "2025-01-15T11:00:00.000Z"
  }
}
```

**Error Responses**

| Status | `message` | Cause |
|--------|-----------|-------|
| `400` | `Cannot refund a payment with status: PENDING. Only COMPLETED payments can be refunded.` | Payment is not in COMPLETED state |
| `400` | `This payment has no Razorpay payment ID — it may be a wallet payment.` | Wallet payment cannot be refunded here |
| `400` | `Refund amount (60000 paise) exceeds the remaining refundable amount (50000 paise).` | Requested amount exceeds what can be refunded |
| `400` | `This payment has already been fully refunded.` | No remaining amount to refund |
| `400` | `amount must be a positive integer in paise (e.g. 10000 for ₹100).` | Invalid amount format |
| `502` | `Razorpay refund failed` | Razorpay API returned an error |

---

### 4.5 List Settlements

Fetch the settlement history — these are the periodic bank transfers Razorpay makes to your registered bank account.

> Settlements are fetched **live from Razorpay's API**, not from the local database.
>
> **Important — No Total Count:** Razorpay's Settlements API does not return a grand total. The response uses a **`hasMore` cursor pattern** instead of `totalPages`. If `hasMore` is `true`, there is at least one more page. If `false`, you are on the last page.

**Endpoint**

```
GET /api/admin/payments/settlements
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | `number` | No | Page number (1-based). Default: `1` |
| `limit` | `number` | No | Records per page. Default: `10`, Max: `100` |
| `from` | `string` | No | Show settlements created on/after this date. Format: ISO 8601 (e.g. `2025-01-01`) |
| `to` | `string` | No | Show settlements created on/before this date. Format: ISO 8601 |

**Example Request — Page 2, 10 per page, January 2025**

```
GET /api/admin/payments/settlements?page=2&limit=10&from=2025-01-01&to=2025-01-31
Authorization: Bearer <token>
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Settlements fetched successfully",
  "data": {
    "settlements": [
      {
        "id": "setl_OdFW9012IJKL",
        "amount": 485000,
        "amountInRs": "4850.00",
        "status": "processed",
        "fees": 5700,
        "tax": 870,
        "utr": "HDFC0000012345678",
        "createdAt": "2025-01-15T00:00:00.000Z"
      },
      {
        "id": "setl_OdFW3456MNOP",
        "amount": 320000,
        "amountInRs": "3200.00",
        "status": "processed",
        "fees": 3760,
        "tax": 574,
        "utr": "HDFC0000012345123",
        "createdAt": "2025-01-14T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 2,
      "limit": 10,
      "count": 2,
      "hasMore": false,
      "nextPage": null
    }
  },
  "meta": {
    "timestamp": "2025-01-15T12:00:00.000Z"
  }
}
```

**`pagination` Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `page` | `number` | Current page number |
| `limit` | `number` | Records requested per page |
| `count` | `number` | Records returned on this page (≤ `limit`) |
| `hasMore` | `boolean` | `true` if more records exist beyond this page. Use this to show/hide a "Next" button. |
| `nextPage` | `number \| null` | Next page number if `hasMore` is `true`, otherwise `null` |

**How to implement "Load More" or pagination controls:**
```js
// Next page exists?
if (data.pagination.hasMore) {
  nextPageNum = data.pagination.nextPage; // pass as ?page=nextPageNum
}

// "Previous" button: simply use page - 1 (disable when page === 1)
```

**Settlement Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Razorpay settlement ID |
| `amount` | `number` | Amount settled in **paise** |
| `amountInRs` | `string` | Amount in rupees (pre-formatted string, ready for display) |
| `status` | `string` | `processed`, `pending`, or `reversed` |
| `fees` | `number` | Razorpay transaction fees deducted in **paise** |
| `tax` | `number` | GST on fees in **paise** |
| `utr` | `string` | Unique Transaction Reference number for bank reconciliation |
| `createdAt` | `string` | ISO 8601 timestamp of when the settlement was created |

---

### 4.6 Settlement Detail

Fetch complete information about a single settlement, including its reconciliation items (a list of individual payment and refund transactions that make up the settlement amount).

**Endpoint**

```
GET /api/admin/payments/settlements/:settlementId
```

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `settlementId` | `string` | Razorpay settlement ID (e.g. `setl_OdFW9012IJKL`) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reconPage` | `number` | No | Page number for recon items (1-based). Default: `1` |
| `reconLimit` | `number` | No | Recon items per page. Default: `20`, Max: `100` |

> **Important — No Total Count for Recon Items:** The reconciliation API also uses a **`hasMore` cursor pattern**. If `recon.pagination.hasMore` is `true`, there are more recon items on the next page.

**Example Request**

```
GET /api/admin/payments/settlements/setl_OdFW9012IJKL?reconPage=1&reconLimit=20
Authorization: Bearer <token>
```

**Success Response `200`**

```json
{
  "success": true,
  "message": "Settlement detail fetched successfully",
  "data": {
    "settlement": {
      "id": "setl_OdFW9012IJKL",
      "amount": 485000,
      "amountInRs": "4850.00",
      "status": "processed",
      "fees": 5700,
      "tax": 870,
      "utr": "HDFC0000012345678",
      "createdAt": "2025-01-15T00:00:00.000Z"
    },
    "recon": {
      "items": [
        {
          "type": "payment",
          "amount": 50000,
          "fee": 590,
          "tax": 90,
          "on_hold": false,
          "settled_at": 1705276800,
          "payment_id": "pay_OdFWXjrYFsQ0pQ",
          "settlement_utr": "HDFC0000012345678",
          "entity_id": "pay_OdFWXjrYFsQ0pQ"
        },
        {
          "type": "refund",
          "amount": -25000,
          "fee": -295,
          "tax": -45,
          "refund_id": "rfnd_OdFW5678EFGH",
          "payment_id": "pay_OdFWXjrYFsQ0pQ",
          "settlement_utr": "HDFC0000012345678",
          "entity_id": "rfnd_OdFW5678EFGH"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "count": 2,
        "hasMore": false,
        "nextPage": null
      }
    }
  },
  "meta": {
    "timestamp": "2025-01-15T12:05:00.000Z"
  }
}
```

**`recon.pagination` Object Fields**

| Field | Type | Description |
|-------|------|-------------|
| `page` | `number` | Current page of recon items |
| `limit` | `number` | Items requested per page |
| `count` | `number` | Items returned on this page (≤ `limit`) |
| `hasMore` | `boolean` | `true` if more recon items exist. Use this to show a "Load More" button. |
| `nextPage` | `number \| null` | Next page number if `hasMore` is `true`, otherwise `null` |

> **Note:** `recon.items` may be an empty array `[]` if your Razorpay plan does not include the reconciliation API, or if no items are available for the given page.

---

## 5. Data Model Reference

### PaymentRecord Object

The full payment record returned by endpoints [4.1](#41-list-payments) and [4.2](#42-payment-detail).

#### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | MongoDB document ID |
| `paymentId` | `string` | Internal auto-generated payment identifier (e.g. `PAY-1705301234567`) |
| `amount` | `number` | Payment amount in **rupees** (app unit) |
| `installmentNumber` | `number` | Which installment number this payment is for (1-indexed) |
| `paymentMethod` | `string` | App-level method. See [Enumerations](#6-enumerations) |
| `status` | `string` | Payment status. See [Enumerations](#6-enumerations) |
| `createdAt` | `string` | ISO 8601 timestamp when the record was created |
| `completedAt` | `string \| null` | When the payment was successfully completed |
| `failedAt` | `string \| null` | When the payment failed |
| `cancelledAt` | `string \| null` | When the payment was cancelled |

#### Razorpay Enriched Fields (populated after webhook)

| Field | Type | Description |
|-------|------|-------------|
| `razorpayOrderId` | `string \| null` | Razorpay order ID (e.g. `order_OdFW...`) |
| `razorpayPaymentId` | `string \| null` | Razorpay payment ID (e.g. `pay_OdFW...`) |
| `razorpayVerified` | `boolean` | Whether signature was server-side verified |
| `razorpayAmount` | `number \| null` | Amount in **paise** as confirmed by Razorpay |
| `razorpayCurrency` | `string \| null` | Currency code, typically `"INR"` |
| `razorpayStatus` | `string \| null` | Razorpay's own status. See [Enumerations](#6-enumerations) |
| `razorpayMethod` | `string \| null` | Payment method as reported by Razorpay. See [Enumerations](#6-enumerations) |
| `razorpayCaptured` | `boolean \| null` | Whether payment amount was captured |
| `razorpayFee` | `number \| null` | Razorpay fee in **paise** |
| `razorpayTax` | `number \| null` | GST on fee in **paise** |
| `razorpayEmail` | `string \| null` | Customer email as submitted to Razorpay |
| `razorpayContact` | `string \| null` | Customer phone number as submitted to Razorpay |
| `razorpayInternational` | `boolean` | `true` if payment originated from outside India |
| `razorpayNotes` | `object` | Custom key-value notes passed during order creation |
| `razorpayCreatedAt` | `string \| null` | ISO 8601 timestamp of Razorpay payment creation |
| `razorpayAmountRefunded` | `number` | Total amount refunded so far in **paise** |
| `razorpayRefundStatus` | `string \| null` | `"full"`, `"partial"`, or `null` |

#### Error Fields (populated only for FAILED payments)

| Field | Type | Description |
|-------|------|-------------|
| `errorCode` | `string \| null` | Razorpay error code (e.g. `BAD_REQUEST_ERROR`) |
| `errorDescription` | `string \| null` | Human-readable error message |
| `errorSource` | `string \| null` | Where error originated: `"customer"`, `"bank"`, `"gateway"`, `"business"` |
| `errorStep` | `string \| null` | Stage where error occurred: `"otp_verification"`, `"authorization"`, etc. |
| `errorReason` | `string \| null` | Specific reason: `"authentication_failed"`, `"insufficient_funds"`, etc. |

#### Admin Tracking Fields

| Field | Type | Description |
|-------|------|-------------|
| `adminMarked` | `boolean` | Whether payment was manually marked by admin |
| `markedBy` | `object \| null` | Admin user who marked it (`{ name, email }`) |
| `markedByEmail` | `string \| null` | Email of admin who marked it |
| `adminNote` | `string \| null` | Note left by admin when marking |

#### Commission Fields

| Field | Type | Description |
|-------|------|-------------|
| `commissionCalculated` | `boolean` | Whether referral commission was calculated for this payment |
| `commissionAmount` | `number` | Commission amount in rupees |
| `commissionPercentage` | `number` | Commission rate applied (%) |
| `commissionCreditedToReferrer` | `boolean` | Whether commission was paid to the referrer |

---

### Card Details Object

Present when `razorpayMethod === "card"`. `null` otherwise.

| Field | Type | Description |
|-------|------|-------------|
| `cardId` | `string \| null` | Razorpay card token ID |
| `name` | `string \| null` | Cardholder name |
| `last4` | `string \| null` | Last 4 digits of card (e.g. `"4242"`) |
| `network` | `string \| null` | Card network: `"Visa"`, `"Mastercard"`, `"RuPay"`, `"American Express"` |
| `type` | `string \| null` | Card type: `"credit"` or `"debit"` |
| `issuer` | `string \| null` | Issuing bank code (e.g. `"HDFC"`, `"ICIC"`, `"SBIN"`) |
| `international` | `boolean` | `true` if the card is issued outside India |
| `subType` | `string \| null` | `"consumer"` or `"commercial"` |
| `iin` | `string \| null` | Issuer Identification Number (first 6 digits of card) |

---

### UPI Details Object

Present when `razorpayMethod === "upi"`. `null` otherwise.

| Field | Type | Description |
|-------|------|-------------|
| `vpa` | `string \| null` | Full Virtual Payment Address (e.g. `"rahul.sharma@okicici"`) |
| `username` | `string \| null` | Username part of VPA (before `@`) |
| `handle` | `string \| null` | UPI app handle (after `@`): `"okicici"`, `"oksbi"`, `"okhdfcbank"`, `"ybl"` |

---

### Netbanking Details Object

Present when `razorpayMethod === "netbanking"`. `null` otherwise.

| Field | Type | Description |
|-------|------|-------------|
| `bank` | `string \| null` | 4-character bank code (e.g. `"HDFC"`, `"ICIC"`, `"UTIB"`) |
| `bankName` | `string \| null` | Full bank name (e.g. `"HDFC Bank"`) |

---

### Wallet Details Object

Present when `razorpayMethod === "wallet"`. `null` otherwise.

| Field | Type | Description |
|-------|------|-------------|
| `wallet` | `string \| null` | Wallet provider code: `"olamoney"`, `"mobikwik"`, `"freecharge"`, `"paypal"` |

---

### EMI Details Object

Present when `razorpayMethod === "emi"`. `null` otherwise.

| Field | Type | Description |
|-------|------|-------------|
| `issuer` | `string \| null` | Issuing bank code for EMI |
| `rate` | `number \| null` | Interest rate as a percentage (e.g. `12` = 12% per annum) |
| `duration` | `number \| null` | Tenure in months (e.g. `6`, `12`, `24`) |
| `monthlyAmount` | `number \| null` | Monthly EMI amount in **paise** |

---

### Acquirer Data Object

Bank-level transaction reference numbers. Present on all payment methods but fields may be `null` depending on the bank and method.

| Field | Type | Description |
|-------|------|-------------|
| `rrn` | `string \| null` | Retrieval Reference Number — unique bank reference (12–16 digits). Used for bank disputes. |
| `authCode` | `string \| null` | Authorization code from the acquiring bank |
| `bankTransactionId` | `string \| null` | Transaction ID from the acquiring bank |
| `upiTransactionId` | `string \| null` | UPI-specific transaction reference ID |
| `arn` | `string \| null` | Acquirer Reference Number — used by Visa/Mastercard for dispute resolution |

---

### Refund Entry Object

Each entry in the `refunds` array on a PaymentRecord.

| Field | Type | Description |
|-------|------|-------------|
| `razorpayRefundId` | `string` | Razorpay refund ID (e.g. `rfnd_OdFW5678EFGH`) |
| `amount` | `number` | Refunded amount in **paise** |
| `status` | `string` | `"pending"`, `"processed"`, or `"failed"` |
| `speedProcessed` | `string \| null` | Actual processing speed: `"normal"` or `"optimum"` |
| `arn` | `string \| null` | Acquirer Reference Number for the refund (available after processing) |
| `reason` | `string \| null` | Admin-provided reason for the refund |
| `initiatedByAdminEmail` | `string \| null` | Email of admin who initiated the refund |
| `createdAt` | `string` | ISO 8601 timestamp when the refund was created |

---

### Settlement Object

Returned by endpoints [4.5](#45-list-settlements) and [4.6](#46-settlement-detail).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Razorpay settlement ID (e.g. `setl_OdFW9012IJKL`) |
| `amount` | `number` | Settlement amount in **paise** |
| `amountInRs` | `string` | Settlement amount in ₹ — pre-formatted decimal string (e.g. `"4850.00"`) |
| `status` | `string` | `"processed"`, `"pending"`, or `"reversed"` |
| `fees` | `number` | Fees deducted in **paise** |
| `tax` | `number` | GST on fees in **paise** |
| `utr` | `string` | Unique Transaction Reference — use this to verify the bank credit in your bank statement |
| `createdAt` | `string` | ISO 8601 timestamp |

---

## 6. Enumerations

### `paymentMethod` (App-Level)

| Value | Description |
|-------|-------------|
| `RAZORPAY` | Payment made via Razorpay. Covers both the normal client-side verify path and the server-side webhook safety net — both are stored as `RAZORPAY` so the value is consistent for users. |
| `WALLET` | Payment deducted from in-app wallet balance |
| `ADMIN_MARKED` | Manually marked as paid by an admin |
| `CASH` | Cash payment recorded offline |
| `UPI` | UPI payment recorded manually (not via Razorpay) |
| `BANK_TRANSFER` | Bank transfer recorded manually |
| `OTHER` | Any other payment method |

> **Note:** Payments captured via the Razorpay server-to-server webhook (the crash-safe guarantee path) are stored as `RAZORPAY` — identical to the normal client path. The audit trail for which path confirmed the payment is in the internal `WebhookEvent` collection, not the `paymentMethod` field.

### `status` (Payment Status)

| Value | Description |
|-------|-------------|
| `PENDING` | Payment initiated but not yet processed |
| `PROCESSING` | Payment is being processed |
| `COMPLETED` | Payment successfully collected |
| `FAILED` | Payment attempt failed |
| `REFUNDED` | Payment has been refunded (fully or partially) |
| `CANCELLED` | Payment was cancelled |

### `razorpayMethod` (Razorpay-Reported Method)

| Value | Description |
|-------|-------------|
| `card` | Credit or debit card |
| `upi` | UPI (Google Pay, PhonePe, Paytm, etc.) |
| `netbanking` | Internet banking |
| `wallet` | Third-party wallets (Paytm, MobiKwik, etc.) |
| `emi` | EMI via bank |

### `razorpayStatus` (Razorpay Payment Status)

| Value | Description |
|-------|-------------|
| `created` | Payment attempt created but not submitted by customer |
| `authorized` | Payment authorized but not captured (auto-capture handles this) |
| `captured` | Payment successfully captured — money collected |
| `refunded` | Payment refunded |
| `failed` | Payment attempt failed |

### Settlement `status`

| Value | Description |
|-------|-------------|
| `processed` | Settlement has been transferred to your bank account |
| `pending` | Settlement is being processed |
| `reversed` | Settlement was reversed |

---

## 7. Unit Conventions

This API uses **two different units** for money. Always check which one applies:

| Unit | Fields That Use It | How to Display |
|------|--------------------|----------------|
| **Rupees** (app unit) | `amount`, `commissionAmount`, analytics `totalCollected`, analytics method `amount` | Display directly: `₹500` |
| **Paise** (Razorpay unit) | `razorpayAmount`, `razorpayFee`, `razorpayTax`, `razorpayAmountRefunded`, refund `amount`, settlement `amount`, settlement `fees`, settlement `tax` | Divide by 100 before display: `50000 paise → ₹500.00` |

**Conversion formula:**
```
displayAmount = paiseValue / 100
formattedDisplay = `₹${displayAmount.toFixed(2)}`
```

**Example:**
- `razorpayFee: 590` → display as `₹5.90`
- `razorpayAmount: 50000` → display as `₹500.00`

---

## 8. Admin Panel UI Guide

### Dashboard Summary Cards

Use `GET /api/admin/payments/analytics` to power the top-level summary cards:

| Card | Field | Unit | Display Example |
|------|-------|------|-----------------|
| Total Collected | `totalCollected` | Rupees | `₹12,50,000` |
| Razorpay Fees Paid | `totalFees ÷ 100` | Rupees | `₹1,475.00` |
| GST on Fees | `totalTax ÷ 100` | Rupees | `₹225.00` |
| Total Refunded | `totalRefunded ÷ 100` | Rupees | `₹250.00` |
| Successful Payments | `completedCount` | Count | `2,500` |

### Method Breakdown Chart (Pie / Donut)

Use `methodBreakdown` from analytics. Each key is a method label, each value has `count` and `amount`.

```
UPI      → 1800 payments, ₹9,00,000
Card     → 500 payments,  ₹2,50,000
Netbank  → 150 payments,  ₹75,000
Wallet   → 50 payments,   ₹25,000
```

### Payment Table Columns (List View)

| Column Header | Field | Notes |
|---------------|-------|-------|
| Payment ID | `paymentId` | Clickable to open detail view |
| Date & Time | `createdAt` | Format: `DD MMM YYYY, HH:MM` |
| Customer | `user.name` + `user.phoneNumber` | |
| Order | `order.orderId` | Clickable to open order view |
| Amount | `amount` | Display in ₹ |
| Method | `razorpayMethod` + badge (UPI/Card/etc.) | Show `paymentMethod` if `razorpayMethod` is null |
| Status | `status` | Color-coded chip: green=COMPLETED, red=FAILED, orange=REFUNDED |
| Razorpay Fee | `razorpayFee ÷ 100` | Display in ₹ |

### Payment Detail — Method-Specific Display

**UPI Payments** — show `upiDetails.vpa` prominently
**Card Payments** — show `cardDetails.network` + `•••• •••• •••• ` + `cardDetails.last4`
**Netbanking** — show `netbankingDetails.bankName`
**EMI** — show `emiDetails.duration` months at `emiDetails.rate`% per annum

### Failed Payment Error Display

```
Error Code:    BAD_REQUEST_ERROR
Description:   Payment failed due to incorrect OTP
Source:        customer
Stage:         otp_verification
Reason:        authentication_failed
```

### Refund Button Logic

Show the "Initiate Refund" button **only** when:
- `status === "COMPLETED"`
- `paymentMethod === "RAZORPAY"`
- `razorpayAmountRefunded < razorpayAmount` (i.e., not fully refunded)

Remaining refundable amount:
```
remaining = (razorpayAmount - razorpayAmountRefunded) / 100
// Display: `Up to ₹${remaining.toFixed(2)} can be refunded`
```

---

## 9. Suggested API Call Flow

### Opening the Payment Dashboard

```
1. GET /api/admin/payments/analytics?startDate=...&endDate=...
   → Populate summary cards and charts

2. GET /api/admin/payments/list?page=1&limit=20
   → Populate the payments table
```

### User Searches or Filters

```
3. GET /api/admin/payments/list?search=rahul&method=upi&status=COMPLETED&page=1
   → Re-fetch table with applied filters
```

### Admin Clicks a Payment Row

```
4. GET /api/admin/payments/:paymentId
   → Open detail drawer/modal with all Razorpay fields
```

### Admin Initiates a Refund from Detail View

```
5. POST /api/admin/payments/:paymentId/refund
   Body: { amount: 25000, reason: "...", speed: "normal" }

6. On success → refresh the payment detail
   GET /api/admin/payments/:paymentId
```

### Opening Settlements Tab

```
7. GET /api/admin/payments/settlements?page=1&limit=10&from=2025-01-01&to=2025-01-31
   → Populate settlements table (first page)
   → Check pagination.hasMore to show/hide "Next" button

7b. Next page (if pagination.hasMore === true):
    GET /api/admin/payments/settlements?page=2&limit=10&from=2025-01-01&to=2025-01-31

8. Admin clicks a settlement row:
   GET /api/admin/payments/settlements/:settlementId?reconPage=1&reconLimit=20
   → Show settlement detail + first page of recon items
   → Check recon.pagination.hasMore to show "Load More" for recon items
```

---

*This document was generated from the backend source code. For questions or discrepancies, contact the backend team.*
