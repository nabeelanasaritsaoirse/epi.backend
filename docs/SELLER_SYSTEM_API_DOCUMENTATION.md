# EPI Multi-Seller Marketplace — Technical API Documentation

**Audience:** Admin Panel Frontend Team · App / Mobile Team · QA Team
**Version:** 1.1 — Added Admin-Mgmt Seller Endpoints; enhanced admin product filter
**Base URL:** `https://api.epi.com` (replace with your environment URL)
**Last Updated:** 2026-03-03

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Authentication Reference](#2-authentication-reference)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Seller Lifecycle](#4-seller-lifecycle)
5. [Product Listing Lifecycle](#5-product-listing-lifecycle)
6. [Order Routing & Fulfillment Lifecycle](#6-order-routing--fulfillment-lifecycle)
7. [Seller APIs — `/api/seller/*`](#7-seller-apis)
8. [Admin APIs — Seller Management](#8-admin-apis--seller-management)
9. [Admin-Mgmt APIs — Seller Overview (NEW)](#9-admin-mgmt-apis--seller-overview)
10. [Public APIs — Visibility Rules](#10-public-apis--visibility-rules)
11. [Data Models Reference](#11-data-models-reference)
12. [Commission & Wallet Flow](#12-commission--wallet-flow)
13. [Error Codes Reference](#13-error-codes-reference)
14. [QA Test Scenarios](#14-qa-test-scenarios)

---

## 1. System Overview

EPI operates as a **multi-seller marketplace** (similar to Flipkart Seller Hub or Meesho Supplier). The flow is:

```
Admin promotes a User → role: "seller"
  │
  ▼
Seller creates a product listing
  │  listingStatus: "pending_approval"
  ▼
Admin reviews the product
  ├── Approves → listingStatus: "published"  (visible to buyers)
  └── Rejects  → listingStatus: "rejected"   (seller notified via push)
  │
  ▼
Buyer places an order on a published product
  │  order.sellerId = product.sellerId  (auto-routed)
  │  order.sellerFulfillmentStatus = "pending"
  ▼
Seller confirms → packs → ships
  │
  ▼
Admin marks delivered
  │  sellerFulfillmentStatus = "delivered"
  ▼
Platform credits seller wallet
  sellerEarning = orderTotal × (1 - platformCommission%)
```

**Key design principles:**
- Admin-created products bypass the approval queue (`listingStatus: "published"` by default).
- All existing orders and products are backward-compatible — new seller fields are additive only.
- Seller can only see **their own** products and orders.
- Public product APIs only return `listingStatus: "published"` products.

---

## 2. Authentication Reference

All protected endpoints require a JWT bearer token in the `Authorization` header.

```
Authorization: Bearer <jwt_token>
```

| Role | How to obtain token | Who creates |
|---|---|---|
| `user` | Firebase sign-in | Self-registered |
| `seller` | Firebase sign-in (same as user) | Admin promotes user to seller |
| `admin` / `super_admin` | Password-based admin login | Super admin |

---

## 3. User Roles & Permissions

| Role | Value | Can Access |
|---|---|---|
| User | `user` | Public APIs, own orders |
| Seller | `seller` | `/api/seller/*` (own products + orders only) |
| Admin | `admin` | `/api/admin/*`, product approval, order management |
| Super Admin | `super_admin` | All admin endpoints + role management |
| Sales Team | `sales_team` | Sales-specific admin APIs |

### How Admin Promotes a User to Seller

Use the existing admin user management endpoint to update the role:

```http
PUT /api/admin/users/:userId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "seller"
}
```

After role change, the seller should call `PUT /api/seller/profile` to fill in their store name before they can create products.

---

## 4. Seller Lifecycle

```
User (role: "user")
    │
    │  Admin sets role: "seller"
    ▼
Seller (role: "seller")
    │  sellerProfile.storeName = null (incomplete)
    │
    │  Seller calls PUT /api/seller/profile with storeName
    ▼
Seller (profile complete)
    │  sellerProfile.storeName = "My Store"
    │  Can now create product listings
    │
    │  Admin sets sellerProfile.isVerified = true (optional)
    ▼
Verified Seller
    │  badge shown to buyers; unlocks certain product categories
```

**Important:** A seller **cannot create products** unless `sellerProfile.storeName` is set.

---

## 5. Product Listing Lifecycle

```
Seller creates product
    │  POST /api/seller/products
    │  listingStatus = "draft"     (if body has isDraft: true)
    │  listingStatus = "pending_approval"  (normal creation)
    ▼
Admin review queue
    │  GET /api/admin/products?listingStatus=pending_approval
    │
    ├── Admin approves:
    │   PATCH /api/products/:id/listing-status { action: "approve" }
    │   listingStatus = "published"
    │   → Push notification sent to seller
    │   → Product NOW visible in public APIs
    │
    └── Admin rejects:
        PATCH /api/products/:id/listing-status { action: "reject", reason: "..." }
        listingStatus = "rejected"
        → Push notification sent to seller with reason
        → Product NOT visible in public APIs

Seller edits a PUBLISHED product
    │  PUT /api/seller/products/:productId
    │  listingStatus auto-resets to "pending_approval"
    │  Product goes OFFLINE until admin re-approves
    ▼
Admin review queue again

Seller archives a product
    │  PUT /api/seller/products/:productId  { status: "archived" }
    │  or set listingStatus to "archived" (via updateProduct)
    ▼
Product no longer visible; can be deleted

Seller deletes a product
    │  DELETE /api/seller/products/:productId
    │  Requirement: listingStatus must NOT be "published"
    │  (archive first, then delete)
```

---

## 6. Order Routing & Fulfillment Lifecycle

```
Buyer places order
    │  POST /api/installment-orders
    │  system reads product.sellerId
    │  order.sellerId = product.sellerId
    │  order.sellerFulfillmentStatus = "pending"   (seller product)
    │  order.sellerFulfillmentStatus = "not_applicable" (admin product)
    │  order.sellerCommissionPercentage = resolved rate
    ▼
Seller dashboard shows new order
    │  GET /api/seller/orders?fulfillmentStatus=pending
    ▼
Seller confirms order
    │  PATCH /api/seller/orders/:orderId/fulfillment  { status: "confirmed" }
    │  → Push notification sent to buyer: "Order Confirmed"
    ▼
Seller packs order
    │  PATCH /api/seller/orders/:orderId/fulfillment  { status: "packed" }
    │  → Push notification sent to buyer: "Order Packed"
    ▼
Seller ships order
    │  PATCH /api/seller/orders/:orderId/fulfillment  { status: "shipped" }
    │  order.sellerFulfilledAt = now
    │  → Push notification sent to buyer: "Order Shipped"
    ▼
Admin marks delivered
    │  PUT /api/admin/installment-orders/:orderId/delivery-status  { status: "DELIVERED" }
    │  order.sellerFulfillmentStatus = "delivered"
    ▼
System credits seller wallet (automatic, idempotent)
    sellerEarning = order.totalProductPrice × (1 − commissionRate / 100)
    WalletTransaction type = "seller_earning" created
    seller.wallet.balance += sellerEarning
    seller.sellerProfile.totalRevenue += sellerEarning
    seller.sellerProfile.totalSales += 1
```

**Fulfillment state machine (seller-controlled):**

| Current Status | Allowed Transitions |
|---|---|
| `pending` | `confirmed` |
| `confirmed` | `packed` |
| `packed` | `shipped` |
| `shipped` | _(none — admin sets `delivered`)_ |
| `delivered` | _(terminal state)_ |
| `not_applicable` | _(platform product — no seller transition)_ |

---

## 7. Seller APIs

**Base path:** `/api/seller`
**Auth required:** `verifyToken + isSeller` on every endpoint

---

### 7.1 GET /api/seller/profile

Get the seller's account and store information.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "64abc...",
    "name": "Ramesh Kumar",
    "email": "ramesh@example.com",
    "phoneNumber": "+919876543210",
    "role": "seller",
    "sellerProfile": {
      "storeName": "Ramesh Electronics",
      "storeDescription": "Quality electronics at best prices",
      "storeImage": "https://cdn.epi.com/stores/ramesh.jpg",
      "gstNumber": "27AAAPG0727E1Z5",
      "panNumber": "AAAPG0727E",
      "commissionRate": null,
      "isVerified": true,
      "verifiedAt": "2025-12-01T10:00:00.000Z",
      "totalProducts": 12,
      "totalSales": 45,
      "totalRevenue": 85400.00,
      "rating": 4.3,
      "ratingCount": 38
    },
    "wallet": {
      "balance": 12500.00
    },
    "createdAt": "2025-10-15T08:30:00.000Z"
  }
}
```

---

### 7.2 PUT /api/seller/profile

Update store profile (name, description, image, tax IDs).

**Request body (all fields optional):**
```json
{
  "storeName": "Ramesh Electronics",
  "storeDescription": "Quality electronics at best prices",
  "storeImage": "https://cdn.epi.com/stores/ramesh.jpg",
  "gstNumber": "27AAAPG0727E1Z5",
  "panNumber": "AAAPG0727E"
}
```

**Fields that CANNOT be updated via this endpoint:**
`commissionRate`, `isVerified`, `totalSales`, `totalRevenue`, `rating`, `ratingCount`, `totalProducts`

**Response 200:**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "name": "Ramesh Kumar",
    "email": "ramesh@example.com",
    "sellerProfile": { ... }
  }
}
```

**Error — no updatable fields sent:**
```json
{
  "success": false,
  "message": "No updatable fields provided",
  "code": "NO_FIELDS"
}
```

---

### 7.3 GET /api/seller/dashboard

Aggregated KPIs for the seller's home screen.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "products": {
      "total": 12,
      "pendingApproval": 2,
      "published": 8,
      "rejected": 2
    },
    "orders": {
      "total": 45,
      "pending": 5,
      "confirmed": 3,
      "shipped": 2
    },
    "revenue": {
      "totalRevenue": 85400.00,
      "totalSales": 45,
      "walletBalance": 12500.00
    },
    "rating": {
      "average": 4.3,
      "count": 38
    }
  }
}
```

---

### 7.4 GET /api/seller/products

List the seller's own products with optional filters.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `listingStatus` | string | Filter by status: `draft`, `pending_approval`, `published`, `rejected`, `archived` |
| `search` | string | Search product name or description |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "productId": "PROD123456789",
        "name": "Samsung Galaxy S24",
        "pricing": {
          "regularPrice": 79999,
          "salePrice": 74999,
          "finalPrice": 74999,
          "currency": "INR"
        },
        "availability": {
          "stockStatus": "in_stock",
          "stockQuantity": 25
        },
        "listingStatus": "published",
        "listingRejectionReason": null,
        "images": [...],
        "hasVariants": false,
        "createdAt": "2025-12-01T10:00:00.000Z",
        "updatedAt": "2025-12-15T14:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "pages": 1
    }
  }
}
```

---

### 7.5 POST /api/seller/products

Create a new product listing. Product is submitted to admin for approval.

**Prerequisites:**
- `sellerProfile.storeName` must be set (complete your profile first)
- `pricing.regularPrice` must be > 0

**Request body:**
```json
{
  "name": "Samsung Galaxy S24",
  "description": {
    "short": "Latest Samsung flagship with AI features",
    "long": "Full detailed description...",
    "features": ["108MP camera", "5000mAh battery"]
  },
  "brand": "Samsung",
  "category": {
    "mainCategoryId": "64abc123...",
    "mainCategoryName": "Electronics",
    "subCategoryId": "64abc456...",
    "subCategoryName": "Smartphones"
  },
  "pricing": {
    "regularPrice": 79999,
    "salePrice": 74999,
    "currency": "INR"
  },
  "availability": {
    "stockQuantity": 25,
    "stockStatus": "in_stock"
  },
  "images": [
    { "url": "https://cdn.epi.com/products/s24-front.jpg", "isPrimary": true, "alt": "Front view" }
  ],
  "condition": "new",
  "taxInfo": {
    "hsnCode": "851712",
    "gstRate": 18
  },
  "tags": ["smartphone", "android", "samsung"],
  "isDraft": false
}
```

**Fields automatically set by server (never trust client):**
- `sellerId` — always set to `req.user._id`
- `sellerInfo` — snapshot from `sellerProfile`
- `listingStatus` — forced to `"pending_approval"` (or `"draft"` if `isDraft: true`)
- `productId` — auto-generated if not provided
- `createdByEmail` — from token

**Response 201:**
```json
{
  "success": true,
  "message": "Product submitted for admin approval",
  "data": {
    "productId": "PROD987654321",
    "listingStatus": "pending_approval",
    "name": "Samsung Galaxy S24"
  }
}
```

**Error — profile incomplete:**
```json
{
  "success": false,
  "message": "Please complete your seller profile (storeName is required) before listing products",
  "code": "INCOMPLETE_SELLER_PROFILE"
}
```

**Error — price missing:**
```json
{
  "success": false,
  "message": "pricing.regularPrice is required and must be greater than 0",
  "code": "PRICE_REQUIRED"
}
```

**Error — sale price invalid:**
```json
{
  "success": false,
  "message": "Sale price (74999) must be less than regular price (79999)",
  "code": "INVALID_PRICE"
}
```

---

### 7.6 PUT /api/seller/products/:productId

Update seller's own product.

**Notes:**
- If the product is currently `published`, editing it **resets `listingStatus` to `pending_approval`** — the product goes offline until admin re-approves.
- `listingStatus`, `sellerId`, `sellerInfo` are blocked — they cannot be changed via this endpoint.

**Request body (updatable fields):**
```json
{
  "name": "Samsung Galaxy S24 Ultra",
  "description": { "short": "Updated description" },
  "pricing": { "regularPrice": 89999, "salePrice": 84999 },
  "availability": { "stockQuantity": 30 },
  "images": [...],
  "tags": ["smartphone", "premium"],
  "condition": "new",
  "taxInfo": { "hsnCode": "851712", "gstRate": 18 },
  "status": "archived"
}
```

**Response 200 (was published, now pending re-review):**
```json
{
  "success": true,
  "message": "Product updated and re-submitted for approval",
  "data": {
    "productId": "PROD987654321",
    "listingStatus": "pending_approval"
  }
}
```

**Error — product not owned by this seller:**
```json
{
  "success": false,
  "message": "You do not have permission to access this product",
  "code": "FORBIDDEN"
}
```

---

### 7.7 DELETE /api/seller/products/:productId

Soft-delete a seller's own product.

**Rules:**
- Product must NOT be in `published` state.
- To delete a published product: first set `status` to `"archived"` via `PUT /api/seller/products/:productId`, then delete.

**Response 200:**
```json
{
  "success": true,
  "message": "Product deleted"
}
```

**Error — cannot delete published product:**
```json
{
  "success": false,
  "message": "Cannot delete a published product. Archive it first by setting listingStatus to 'archived'.",
  "code": "CANNOT_DELETE_PUBLISHED"
}
```

---

### 7.8 GET /api/seller/orders

List orders for this seller's products.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `fulfillmentStatus` | string | Filter: `pending`, `confirmed`, `packed`, `shipped`, `delivered`, `not_applicable` |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "ORD-20251201-001",
        "user": {
          "name": "Priya Sharma",
          "email": "priya@example.com",
          "phoneNumber": "+919123456789"
        },
        "productName": "Samsung Galaxy S24",
        "quantity": 1,
        "pricePerUnit": 74999,
        "totalProductPrice": 74999,
        "sellerFulfillmentStatus": "pending",
        "sellerNotes": "",
        "sellerFulfilledAt": null,
        "deliveryStatus": "PENDING",
        "variantDetails": null,
        "createdAt": "2025-12-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

### 7.9 GET /api/seller/orders/:orderId

Get full detail of a single order. Returns 404 if the order doesn't exist **or** belongs to another seller (security by design — doesn't reveal existence of other sellers' orders).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-20251201-001",
    "user": {
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "phoneNumber": "+919123456789",
      "addresses": [...]
    },
    "product": {
      "productId": "PROD987654321",
      "name": "Samsung Galaxy S24",
      "images": [...],
      "pricing": { ... }
    },
    "productName": "Samsung Galaxy S24",
    "quantity": 1,
    "pricePerUnit": 74999,
    "totalProductPrice": 74999,
    "sellerFulfillmentStatus": "pending",
    "sellerCommissionPercentage": 15,
    "sellerNotes": "",
    "sellerFulfilledAt": null,
    "deliveryAddress": { ... },
    "deliveryStatus": "PENDING",
    "status": "ACTIVE",
    "createdAt": "2025-12-20T10:00:00.000Z"
  }
}
```

---

### 7.10 PATCH /api/seller/orders/:orderId/fulfillment

Update the fulfillment status of an order. Only forward transitions are allowed.

**Valid transitions:**

```
pending → confirmed → packed → shipped
```

`"delivered"` is set by admin only and cannot be set by the seller.

**Request body:**
```json
{
  "status": "confirmed",
  "notes": "Order verified, processing"
}
```

| Field | Required | Description |
|---|---|---|
| `status` | YES | One of: `confirmed`, `packed`, `shipped` |
| `notes` | NO | Internal note (max 500 chars) |

**Response 200:**
```json
{
  "success": true,
  "message": "Order status updated to 'confirmed'",
  "data": {
    "orderId": "ORD-20251201-001",
    "sellerFulfillmentStatus": "confirmed",
    "sellerFulfilledAt": null
  }
}
```

**Error — invalid transition:**
```json
{
  "success": false,
  "message": "Cannot transition from 'pending' to 'shipped'. Allowed next statuses: confirmed",
  "code": "INVALID_STATUS_TRANSITION"
}
```

**Note:** Push notifications are sent to the buyer automatically on `confirmed`, `packed`, and `shipped`.

---

## 8. Admin APIs — Seller Management

---

### 8.1 Approve or Reject a Seller Product

```http
PATCH /api/products/:productId/listing-status
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body:**
```json
{
  "action": "approve"
}
```

Or to reject:
```json
{
  "action": "reject",
  "reason": "Product images are blurry. Please upload high quality images (min 800×800px)."
}
```

| Field | Required | Values |
|---|---|---|
| `action` | YES | `"approve"` or `"reject"` |
| `reason` | YES if rejecting | Rejection message shown to seller |

**Valid state transitions:**
- `approve`: `pending_approval` or `rejected` → `published`
- `reject`: `pending_approval` or `published` → `rejected`

**Response 200:**
```json
{
  "success": true,
  "message": "Product approved and is now published",
  "data": {
    "productId": "PROD987654321",
    "listingStatus": "published",
    "listingReviewedAt": "2025-12-21T09:00:00.000Z",
    "listingReviewedBy": "64admin..."
  }
}
```

**Behaviour:** A push notification is automatically sent to the seller's device on both approval and rejection.

**Error — action not applicable:**
```json
{
  "success": false,
  "message": "Product is already published",
  "code": "INVALID_TRANSITION"
}
```

**Error — platform product (no sellerId):**
```json
{
  "success": false,
  "message": "This product is not a seller listing and does not require approval",
  "code": "NOT_A_SELLER_PRODUCT"
}
```

---

### 8.2 View Pending Approval Queue

Use the existing product admin endpoint with a filter:

```http
GET /api/admin/products?listingStatus=pending_approval
Authorization: Bearer <admin_token>
```

This returns all seller products awaiting admin review. Standard pagination, search, and sort parameters apply.

---

### 8.3 Mark Order as Delivered (triggers seller payout)

```http
PUT /api/admin/installment-orders/:orderId/delivery-status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "DELIVERED"
}
```

When status is set to `DELIVERED`, the system automatically:
1. Sets `order.sellerFulfillmentStatus = "delivered"`
2. Calculates `sellerEarning = totalProductPrice × (1 - commissionRate/100)`
3. Creates a `WalletTransaction` of type `"seller_earning"`
4. Credits the seller's `wallet.balance`
5. Increments `sellerProfile.totalSales` and `sellerProfile.totalRevenue`

This operation is **idempotent** — if called twice on the same order, the second call is a no-op.

---

### 8.4 View Seller Details (Admin Panel)

To view a seller's full profile from the admin panel, use the existing user detail endpoint:

```http
GET /api/admin/users/:userId
Authorization: Bearer <admin_token>
```

The response includes the `sellerProfile` subdocument with all stats.

---

### 8.5 Set Seller Commission Rate Override

If a seller should have a different commission rate than the category default, update via:

```http
PUT /api/admin/users/:userId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "sellerProfile.commissionRate": 12
}
```

Setting to `null` means "inherit from category". This rate is captured at order creation time and stored immutably on each order.

---

## 9. Admin-Mgmt APIs — Seller Overview

**Base path:** `/api/admin-mgmt/sellers`
**Auth required:** Super Admin token on all endpoints (`requireSuperAdmin`)

These endpoints give the admin panel a dedicated seller management dashboard — list all sellers, view a seller's full profile + stats, and browse their products filtered by listing status.

---

### 9.1 GET /api/admin-mgmt/sellers

List all sellers with live product counts and revenue stats.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `search` | string | Search by seller name, email, or store name |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc...",
      "name": "Ramesh Kumar",
      "email": "ramesh@example.com",
      "phone": "+919876543210",
      "joinedAt": "2025-10-15T08:30:00.000Z",
      "storeName": "Ramesh Electronics",
      "isVerified": true,
      "commissionRate": null,
      "totalRevenue": 85400.00,
      "totalSales": 45,
      "rating": 4.3,
      "walletBalance": 12500.00,
      "products": {
        "total": 12,
        "published": 8,
        "pendingApproval": 2,
        "rejected": 2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 35,
    "pages": 2
  }
}
```

---

### 9.2 GET /api/admin-mgmt/sellers/:sellerId

Full profile for a single seller including all product and order stats.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "_id": "64abc...",
    "name": "Ramesh Kumar",
    "email": "ramesh@example.com",
    "phone": "+919876543210",
    "joinedAt": "2025-10-15T08:30:00.000Z",
    "sellerProfile": {
      "storeName": "Ramesh Electronics",
      "storeDescription": "Quality electronics",
      "gstNumber": "27AAAPG0727E1Z5",
      "commissionRate": null,
      "isVerified": true,
      "totalRevenue": 85400.00,
      "totalSales": 45,
      "rating": 4.3
    },
    "walletBalance": 12500.00,
    "products": {
      "total": 12,
      "published": 8,
      "pendingApproval": 2,
      "rejected": 1,
      "draft": 0,
      "archived": 1
    },
    "orders": {
      "total": 45,
      "pending": 5,
      "confirmed": 3,
      "shipped": 2,
      "delivered": 35
    }
  }
}
```

**Error — invalid ID format:**

```json
{ "success": false, "message": "Invalid seller ID" }
```

**Error — not found:**

```json
{ "success": false, "message": "Seller not found" }
```

---

### 9.3 GET /api/admin-mgmt/sellers/:sellerId/products

All products for a specific seller, with optional `listingStatus` filter.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `listingStatus` | string | Optional: `draft`, `pending_approval`, `published`, `rejected`, `archived` |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "productId": "PROD123456",
      "name": "Samsung Galaxy S24",
      "listingStatus": "published",
      "status": "published",
      "pricing": { "regularPrice": 79999, "salePrice": 74999 },
      "availability": { "stockQuantity": 25 },
      "category": {
        "mainCategoryName": "Electronics",
        "subCategoryName": "Smartphones"
      },
      "listingRejectionReason": null,
      "createdAt": "2025-12-01T10:00:00.000Z",
      "updatedAt": "2025-12-15T14:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 },
  "appliedFilters": { "listingStatus": "all" }
}
```

**Error — invalid listingStatus:**

```json
{
  "success": false,
  "message": "Invalid listingStatus. Must be one of: draft, pending_approval, published, rejected, archived"
}
```

---

### 9.4 Admin Panel — Seller Management Quick Reference

| Task | Method | Endpoint |
|---|---|---|
| List all sellers | GET | `/api/admin-mgmt/sellers` |
| Search sellers | GET | `/api/admin-mgmt/sellers?search=ramesh` |
| View seller detail + stats | GET | `/api/admin-mgmt/sellers/:sellerId` |
| View seller's products | GET | `/api/admin-mgmt/sellers/:sellerId/products` |
| Filter seller's pending products | GET | `/api/admin-mgmt/sellers/:sellerId/products?listingStatus=pending_approval` |

---

## 10. Public APIs — Visibility Rules

> **Critical rule:** All public product-listing endpoints only return products with `listingStatus: "published"`. Seller products in `pending_approval`, `rejected`, `draft`, or `archived` state are **never** returned to public/app users.

### Endpoints that apply the `listingStatus: "published"` filter

| Endpoint | Notes |
|---|---|
| `GET /api/products` | Main product list |
| `GET /api/products/:productId` | Single product detail |
| `GET /api/products/category/:categoryId` | Products by category |
| `GET /api/products/search` | Full-text search |
| `GET /api/products/categoryId/:categoryId` | By MongoDB category ID |
| `GET /api/products/region/:region` | By regional availability |
| `GET /api/products/project/:projectId` | By project |
| `GET /api/products/low-stock` | Low stock (admin use) |
| `GET /api/products/:productId/variants` | Product variants |
| `GET /api/products/:productId/variants/:variantId` | Single variant |

### Admin endpoints (no listingStatus filter)

Admin endpoints at `/api/admin/products` return **all** products regardless of `listingStatus`. Admins use these for review and moderation.

---

## 11. Data Models Reference

### 11.1 User — `sellerProfile` subdocument

Only populated when `role === "seller"`.

| Field | Type | Description |
|---|---|---|
| `storeName` | String | Store display name. **Required before creating products.** |
| `storeDescription` | String | Short store bio |
| `storeImage` | String | URL to store logo/banner |
| `gstNumber` | String | 15-character GST registration number |
| `panNumber` | String | 10-character PAN number |
| `commissionRate` | Number (0–100) | Override commission rate. `null` = inherit from category |
| `isVerified` | Boolean | Platform-verified badge |
| `verifiedAt` | Date | When verification was granted |
| `verifiedBy` | ObjectId → User | Admin who verified |
| `totalProducts` | Number | Auto-maintained product count |
| `totalSales` | Number | Total orders fulfilled |
| `totalRevenue` | Number | Cumulative earnings (after commission) |
| `rating` | Number (0–5) | Average buyer rating |
| `ratingCount` | Number | Number of ratings |

---

### 11.2 Product — Seller Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `sellerId` | ObjectId → User | `null` | Owner seller. `null` = platform product |
| `sellerInfo.storeName` | String | `null` | Denormalized for fast reads |
| `sellerInfo.rating` | Number | `null` | Denormalized seller rating |
| `sellerInfo.isVerified` | Boolean | `false` | Denormalized verification badge |
| `listingStatus` | String | `"published"` | See enum below |
| `listingRejectionReason` | String | `null` | Set by admin on rejection |
| `listingReviewedBy` | ObjectId → User | `null` | Admin who reviewed |
| `listingReviewedAt` | Date | `null` | Review timestamp |

**`listingStatus` enum:**

| Value | Meaning | Visible to public |
|---|---|---|
| `draft` | Seller saved but not submitted | NO |
| `pending_approval` | Awaiting admin review | NO |
| `published` | Approved and live | YES |
| `rejected` | Admin rejected with reason | NO |
| `archived` | Seller/admin archived | NO |

---

### 11.3 InstallmentOrder — Seller Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `sellerId` | ObjectId → User | `null` | Seller who owns this order |
| `sellerCommissionPercentage` | Number (0–100) | `0` | Platform commission captured at order time |
| `sellerFulfillmentStatus` | String | `"not_applicable"` | See enum below |
| `sellerFulfilledAt` | Date | `null` | Set when seller marks as `shipped` |
| `sellerNotes` | String | `""` | Seller's internal notes |

**`sellerFulfillmentStatus` enum:**

| Value | Set by | Description |
|---|---|---|
| `not_applicable` | System | Platform product (no seller) |
| `pending` | System | Order placed, awaiting seller action |
| `confirmed` | Seller | Seller confirmed the order |
| `packed` | Seller | Order packed and ready to ship |
| `shipped` | Seller | Order shipped to buyer |
| `delivered` | System/Admin | Delivery confirmed, wallet credited |

---

### 11.4 WalletTransaction — Seller Type

When a seller is paid for a delivered order, a transaction is created with:

| Field | Value |
|---|---|
| `type` | `"seller_earning"` |
| `user` | seller's `_id` |
| `amount` | `totalProductPrice × (1 - commissionRate/100)` |
| `status` | `"completed"` |
| `meta.commissionRate` | The platform's commission % |
| `meta.grossOrderValue` | Full order value before commission |

---

## 12. Commission & Wallet Flow

### Commission Resolution (at order creation time)

The platform commission rate is resolved using this priority chain and stored immutably on the order:

```
1. seller.sellerProfile.commissionRate   (set explicitly — seller override)
        ↓ null → inherit
2. category.commissionRate               (set at category level)
        ↓ null/zero → fallback
3. Platform default: 15%
```

**Example:**
- Category Electronics has `commissionRate: 18`
- Seller Ramesh has `sellerProfile.commissionRate: null` (inherit)
- Result: `sellerCommissionPercentage = 18` stored on order
- Order total: ₹74,999
- Seller earns: ₹74,999 × (1 − 0.18) = ₹61,499.18
- Platform keeps: ₹74,999 × 0.18 = ₹13,499.82

### Seller Payout

- Earnings are credited automatically when admin marks an order as `DELIVERED`.
- Seller can withdraw from their wallet using the existing withdrawal system (`POST /api/wallet/withdraw`).
- No separate payout system is needed.

---

## 13. Error Codes Reference

### Seller System Error Codes

| Code | HTTP | When it occurs |
|---|---|---|
| `SELLER_REQUIRED` | 403 | Non-seller trying to access `/api/seller/*` |
| `INCOMPLETE_SELLER_PROFILE` | 400 | Creating product before setting `storeName` |
| `PRICE_REQUIRED` | 400 | Product created with `regularPrice` missing or ≤ 0 |
| `INVALID_PRICE` | 400 | `salePrice >= regularPrice` |
| `VARIANTS_REQUIRED` | 400 | `hasVariants: true` but no `variants` array |
| `VARIANT_PRICE_REQUIRED` | 400 | A variant is missing `price` field |
| `VARIANT_SALE_PRICE_INVALID` | 400 | Variant `salePrice >= price` |
| `DUPLICATE_VARIANT` | 400 | Two variants with identical attribute combination |
| `PRODUCT_NOT_FOUND` | 404 | Product doesn't exist or is deleted |
| `FORBIDDEN` | 403 | Seller trying to access another seller's product |
| `CANNOT_DELETE_PUBLISHED` | 409 | Attempting to delete a published product |
| `STATUS_REQUIRED` | 400 | `PATCH /fulfillment` sent without `status` field |
| `INVALID_STATUS_TRANSITION` | 409 | Invalid fulfillment state transition attempted |
| `ORDER_NOT_FOUND` | 404 | Order not found or belongs to another seller |
| `INVALID_FILTER` | 400 | Unknown value passed to filter query param |

### Product Listing Status Error Codes (Admin)

| Code | HTTP | When it occurs |
|---|---|---|
| `NOT_A_SELLER_PRODUCT` | 400 | Trying to approve a platform product |
| `REASON_REQUIRED` | 400 | Rejecting without providing a reason |
| `INVALID_TRANSITION` | 409 | Approval state transition not valid |

### General Error Codes

| Code | HTTP | When it occurs |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Mongoose schema validation failure |
| `CAST_ERROR` | 400 | Invalid MongoDB ObjectId format |
| `DUPLICATE_KEY` | 409 | Duplicate SKU, productId, or other unique field |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 14. QA Test Scenarios

### 14.1 Seller Identity Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| S1 | Unauthenticated access to seller API | `GET /api/seller/dashboard` — no token | 401 Unauthorized |
| S2 | User (not seller) accessing seller API | `GET /api/seller/dashboard` with user token | 403 `SELLER_REQUIRED` |
| S3 | Admin accessing seller API | `GET /api/seller/dashboard` with admin token | 403 `SELLER_REQUIRED` |
| S4 | Seller with complete profile | `GET /api/seller/profile` | 200 with `sellerProfile.storeName` set |
| S5 | Seller updating disallowed field | `PUT /api/seller/profile` with `{ "isVerified": true }` | 200, `isVerified` unchanged (field ignored) |

### 14.2 Product Creation & Approval Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| P1 | Seller creates product — no storeName | `POST /api/seller/products` before setting storeName | 400 `INCOMPLETE_SELLER_PROFILE` |
| P2 | Seller creates product — zero price | `POST /api/seller/products` with `pricing.regularPrice: 0` | 400 `PRICE_REQUIRED` |
| P3 | Seller creates product — salePrice >= regularPrice | `POST /api/seller/products` with `salePrice: 100, regularPrice: 50` | 400 `INVALID_PRICE` |
| P4 | Seller creates valid product | `POST /api/seller/products` with all valid fields | 201, `listingStatus: "pending_approval"` |
| P5 | New product NOT visible to public | `GET /api/products/:productId` after P4 | 404 (not published yet) |
| P6 | Admin approves product | `PATCH /api/products/:id/listing-status { action: "approve" }` | 200, `listingStatus: "published"` |
| P7 | Product visible after approval | `GET /api/products/:productId` after P6 | 200 with product data |
| P8 | Admin rejects product without reason | `PATCH /api/products/:id/listing-status { action: "reject" }` | 400 `REASON_REQUIRED` |
| P9 | Admin rejects with reason | `PATCH /api/products/:id/listing-status { action: "reject", reason: "Bad images" }` | 200, `listingStatus: "rejected"` |
| P10 | Rejected product not visible to public | `GET /api/products/:productId` after P9 | 404 |
| P11 | Seller re-edits rejected product | `PUT /api/seller/products/:productId` with fixes | 200, `listingStatus: "pending_approval"` |
| P12 | Admin can approve previously rejected product | `PATCH /api/products/:id/listing-status { action: "approve" }` on rejected | 200, `listingStatus: "published"` |
| P13 | Seller edits published product | `PUT /api/seller/products/:productId` | 200, `listingStatus: "pending_approval"`, product goes offline |
| P14 | Seller tries to delete published product | `DELETE /api/seller/products/:productId` (published) | 409 `CANNOT_DELETE_PUBLISHED` |
| P15 | Seller archives then deletes product | `PUT (...status: "archived")` then `DELETE` | 200 on both |
| P16 | Seller A tries to edit Seller B's product | `PUT /api/seller/products/:sellerBProductId` with seller A token | 403 `FORBIDDEN` |
| P17 | Admin approves platform product | `PATCH /api/products/:adminProductId/listing-status { action: "approve" }` | 400 `NOT_A_SELLER_PRODUCT` |
| P18 | Product `isDraft: true` creation | `POST /api/seller/products` with `isDraft: true` | 201, `listingStatus: "draft"` |

### 14.3 Order Routing Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| O1 | Order on published seller product | Place order on seller product | `order.sellerId` = seller's `_id` |
| O2 | Order on platform (admin) product | Place order on admin product | `order.sellerId = null`, `sellerFulfillmentStatus = "not_applicable"` |
| O3 | Seller commission captured | After O1, check `order.sellerCommissionPercentage` | Matches seller/category/default rate |
| O4 | Seller sees own order | `GET /api/seller/orders` | Order from O1 appears |
| O5 | Seller does NOT see platform order | `GET /api/seller/orders` | Order from O2 does NOT appear |
| O6 | Seller A does NOT see Seller B's order | `GET /api/seller/orders/:sellerBOrderId` with seller A token | 404 |

### 14.4 Fulfillment State Machine Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| F1 | Seller confirms pending order | `PATCH /api/seller/orders/:orderId/fulfillment { status: "confirmed" }` | 200, status = `"confirmed"` |
| F2 | Seller tries invalid skip | `PATCH ...fulfillment { status: "shipped" }` from `pending` | 409 `INVALID_STATUS_TRANSITION` |
| F3 | Seller packs confirmed order | `PATCH ...fulfillment { status: "packed" }` | 200, status = `"packed"` |
| F4 | Seller ships packed order | `PATCH ...fulfillment { status: "shipped" }` | 200, status = `"shipped"`, `sellerFulfilledAt` set |
| F5 | Seller tries to set delivered | `PATCH ...fulfillment { status: "delivered" }` | 409 `INVALID_STATUS_TRANSITION` |
| F6 | Admin marks order DELIVERED | `PUT /api/admin/installment-orders/:id/delivery-status { status: "DELIVERED" }` | 200 |
| F7 | Seller wallet credited after F6 | `GET /api/seller/profile` | `wallet.balance` increased |
| F8 | Seller earning = correct amount | After F6, check wallet transaction | Amount = `totalProductPrice × (1 - commissionRate/100)` |
| F9 | Calling delivered twice (idempotency) | `PUT ...delivery-status { status: "DELIVERED" }` again | 200, wallet balance unchanged |
| F10 | Push notification on confirm/pack/ship | Seller updates F1–F4 | Buyer receives push notification each time |

### 14.5 Public API Visibility Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| V1 | Search returns only published seller products | `GET /api/products/search?q=samsung` | Only published products in results |
| V2 | Category listing excludes pending products | `GET /api/products/category/:id` | No `pending_approval` products |
| V3 | Region endpoint excludes non-published | `GET /api/products/region/:region` | Only `listingStatus: "published"` |
| V4 | Variants of rejected product not accessible | `GET /api/products/:rejectedProductId/variants` | 404 |
| V5 | Admin product list shows all statuses | `GET /api/admin/products` (admin token) | Shows all `listingStatus` values |
| V6 | Admin sees pending_approval in product list | `GET /api/admin/products?listingStatus=pending_approval` | Returns seller pending products |

### 14.6 Commission Calculation Tests

| # | Test Case | Steps | Expected Result |
|---|---|---|---|
| C1 | Seller with no override — category rate used | Order seller product; category has `commissionRate: 18` | `sellerCommissionPercentage = 18` |
| C2 | Seller with explicit override | Set `sellerProfile.commissionRate: 12`, place order | `sellerCommissionPercentage = 12` |
| C3 | Category has no rate — platform default used | Category `commissionRate: 0`, seller no override | `sellerCommissionPercentage = 15` |
| C4 | Seller earning amount is correct | Order ₹74,999, commission 15% | Earning = ₹63,749.15 |
| C5 | Platform product earns no seller commission | Order on admin product (sellerId null) | No `seller_earning` WalletTransaction created |

---

## Appendix A — Seller Onboarding Checklist (Admin Panel)

1. Go to **Users → Find user** and locate the user's account
2. Edit the user and set `role = "seller"`
3. The user can now sign in and access their seller dashboard
4. Ask the seller to go to **Profile → Store Settings** and fill in `storeName`
5. (Optional) Set `sellerProfile.commissionRate` if the seller has a negotiated rate
6. (Optional) After KYC verification, set `sellerProfile.isVerified = true` to show the verified badge

## Appendix B — Quick Reference: Who Can Do What

| Action | App User | Seller | Admin |
|---|---|---|---|
| View published products | ✅ | ✅ | ✅ |
| View pending/rejected products | ❌ | Own only | ✅ All |
| Create product listing | ❌ | ✅ (→ pending_approval) | ✅ (→ published) |
| Approve/reject product | ❌ | ❌ | ✅ |
| View own orders | ✅ | ✅ (seller scope) | ✅ All |
| Update fulfillment status | ❌ | ✅ (pending→confirmed→packed→shipped) | ✅ |
| Mark order as DELIVERED | ❌ | ❌ | ✅ |
| View seller wallet earnings | ❌ | ✅ (own) | ✅ All |
| Withdraw earnings | ❌ | ✅ | ✅ |
| Set commission rate | ❌ | ❌ | ✅ |
| Promote user to seller | ❌ | ❌ | ✅ |
