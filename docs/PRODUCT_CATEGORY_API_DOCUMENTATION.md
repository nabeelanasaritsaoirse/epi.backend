# EPI Platform — Product & Category API Documentation

**Audience:** App / Mobile Team · Admin Panel Frontend Team · QA Team
**Version:** 2.1 — Seller-mgmt admin endpoints; variant matrix merge; category/product field fixes; specifications format flexibility
**Base URL:** `https://api.epi.com` (replace with your environment URL)
**Last Updated:** 2026-03-03

---

## Table of Contents

1. [Authentication Reference](#1-authentication-reference)
2. [Access Level Legend](#2-access-level-legend)
3. [Category APIs — Public](#3-category-apis--public)
4. [Category APIs — Admin](#4-category-apis--admin)
5. [Product APIs — Public (App Team)](#5-product-apis--public-app-team)
6. [Product APIs — Admin Panel](#6-product-apis--admin-panel)
7. [Variant System](#7-variant-system)
8. [Regional System](#8-regional-system)
9. [Seller System (Summary)](#9-seller-system-summary)
10. [Data Models Reference](#10-data-models-reference)
11. [Error Codes Reference](#11-error-codes-reference)
12. [QA Test Scenarios](#12-qa-test-scenarios)
13. [Quick Reference by Team](#13-quick-reference-by-team)

---

## 1. Authentication Reference

All protected endpoints require a JWT Bearer token in the request header:

```
Authorization: Bearer <jwt_token>
```

| Role | How to Get Token | Notes |
|---|---|---|
| **App User / Buyer** | Firebase sign-in (mobile) | Firebase ID Token exchanged for EPI JWT |
| **Seller** | Firebase sign-in (same as buyer) | Admin must first set `role: "seller"` on the account |
| **Admin / Super Admin** | `POST /api/admin-auth/login` with email + password | Password-based — NOT Firebase |
| **Sales Team** | `POST /api/admin-auth/login` with email + password | Same as admin login |

> **Important for App Team:** Sellers use the same Firebase login as regular users. The role is stored on the server and the same JWT is returned. There is no separate seller login page.

---

## 2. Access Level Legend

| Symbol | Meaning |
|---|---|
| 🌐 Public | No token required |
| 🔑 Any Auth | Valid JWT required (any role) |
| 🛒 Buyer | Regular user token |
| 🏪 Seller | Seller account token |
| 🔧 Admin | Admin or Super Admin token |
| 👑 Super Admin | Super Admin only |

---

## 3. Category APIs — Public

**Base path:** `/api/categories`

---

### 3.1 Get All Categories

```http
GET /api/categories
```

**Auth:** 🌐 Public (optional auth)

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page (max 100) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "CAT001",
      "name": "Electronics",
      "slug": "electronics",
      "description": "All electronic products",
      "mainImage": { "url": "https://cdn.epi.com/cat-electronics.jpg", "altText": "Electronics" },
      "isFeatured": true,
      "showInMenu": true,
      "displayOrder": 1,
      "productCount": 42,
      "commissionRate": 15,
      "level": 0,
      "subCategories": ["CAT002", "CAT003"],
      "attributeSchema": [
        {
          "name": "Color",
          "type": "color_swatch",
          "options": ["Black", "Silver", "Gold"],
          "isFilterable": true,
          "isRequired": false
        }
      ]
    }
  ]
}
```

---

### 3.2 Get Category by ID

```http
GET /api/categories/:categoryId
```

**Auth:** 🌐 Public

---

### 3.3 Get Category with Subcategories

```http
GET /api/categories/:categoryId/with-subcategories
```

**Auth:** 🌐 Public
**Use Case:** Build category navigation tree, breadcrumb navigation.

Returns the full category object with the `subCategories` array **populated** (each subcategory is a full object, not just an ID).

---

### 3.4 Get Featured Categories

```http
GET /api/categories/featured
```

**Auth:** 🌐 Public
**Use Case:** App home screen — featured category carousel.

Returns only categories where `isFeatured: true`, sorted by `displayOrder`.

---

### 3.5 Get Categories for Dropdown

```http
GET /api/categories/dropdown/all
```

**Auth:** 🌐 Public (optional auth)
**Use Case:** Admin panel — product creation form category picker; app category filter.

Returns a flat list of main categories with their subcategories, optimized for dropdown menus.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "CAT001",
      "name": "Electronics",
      "subCategories": [
        { "categoryId": "CAT002", "name": "Smartphones" },
        { "categoryId": "CAT003", "name": "Laptops" }
      ]
    }
  ]
}
```

---

### 3.6 Search Categories

```http
GET /api/categories/search/:query
```

**Auth:** 🌐 Public

**Example:**
```
GET /api/categories/search/smart
```

---

### 3.7 Get Category Stats

```http
GET /api/categories/stats
```

**Auth:** 🌐 Public
**Returns:** Total categories count, featured count, average products per category.

---

## 4. Category APIs — Admin

**Base path:** `/api/categories`
**Auth required:** All endpoints require `Authorization: Bearer <admin_token>`

---

### 4.1 Get All Categories (Admin View)

```http
GET /api/categories/admin/all
```

**Auth:** 🔧 Admin
**Returns:** All categories including soft-deleted ones, with delete status indicators.

---

### 4.2 Create Category

```http
POST /api/categories
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "name": "Smartphones",
  "description": "Mobile phones and accessories",
  "parentCategoryId": "64abc123...",
  "commissionRate": 12,
  "isFeatured": false,
  "showInMenu": true,
  "displayOrder": 2,
  "isRestricted": false,
  "attributeSchema": [
    {
      "name": "RAM",
      "type": "text",
      "options": ["4GB", "6GB", "8GB", "12GB"],
      "isRequired": false,
      "isFilterable": true,
      "unit": "GB"
    },
    {
      "name": "Color",
      "type": "color_swatch",
      "options": ["Black", "Silver", "Gold"],
      "isRequired": true,
      "isFilterable": true
    }
  ]
}
```

**Key fields explained:**

| Field | Required | Description |
|---|---|---|
| `name` | YES | Category display name |
| `parentCategoryId` | NO | Omit for top-level main category |
| `commissionRate` | NO | Platform commission % for products here (0–100). Default: 0. If 0/null, platform fallback of 15% applies to seller orders |
| `isRestricted` | NO | If `true`, only verified sellers can list products here |
| `showInMenu` | NO | Whether this category appears in the navigation menu |
| `isFeatured` | NO | Show this category in featured sections |
| `attributeSchema` | NO | Defines variant attributes for products in this category. **Critical for variant generation** |

> **Note (v2.1 fix):** `showInMenu`, `commissionRate`, `isRestricted`, `isFeatured`, and `attributeSchema` are now correctly saved on **category creation** (they were previously only applied on update). Recreating categories is no longer needed.

> **`attributeSchema` is the most important field for the variant system.** It defines which attributes (Color, Size, RAM, etc.) can be used when creating product variants in this category. Adding attributes here enables the "Generate Variant Matrix" button in the admin product editor.

---

### 4.3 Update Category

```http
PUT /api/categories/:categoryId
```

**Auth:** 🔧 Admin
**Body:** Any subset of the fields from Create Category.

---

### 4.4 Update Category SEO / Meta

```http
PUT /api/categories/:categoryId/meta
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "metaTitle": "Buy Smartphones Online | Best Prices",
  "metaDescription": "Shop the latest smartphones from top brands...",
  "keywords": ["smartphones", "mobile phones", "android"]
}
```

---

### 4.5 Toggle Featured Status

```http
PUT /api/categories/:categoryId/toggle-featured
```

**Auth:** 🔧 Admin
**Effect:** Toggles `isFeatured` between `true` and `false`.

---

### 4.6 Delete / Restore Category

```http
DELETE /api/categories/:categoryId          # Soft delete (recoverable)
PUT    /api/categories/:categoryId/restore  # Restore soft-deleted
DELETE /api/categories/:categoryId/hard     # Permanent deletion (irreversible)
```

**Auth:** 🔧 Admin (hard delete may require Super Admin depending on your RBAC config)

---

### 4.7 Category Image Management

```http
PUT /api/categories/:categoryId/category-images
```

**Auth:** 🔧 Admin
**Content-Type:** `multipart/form-data`
**Use Case:** Upload/replace the main category image.

---

### 4.8 Category Banner Images

```http
POST   /api/categories/:categoryId/banner-images           # Upload banners
PUT    /api/categories/:categoryId/banner-images/reorder   # Reorder banners
DELETE /api/categories/:categoryId/banner-images/:bannerImageId  # Delete one banner
```

**Auth:** 🔧 Admin
**Use Case:** Admin panel banner image carousel per category (promotions, sale banners).

**Upload body:** `multipart/form-data` with field name `banners`.

---

### 4.9 Bulk Reorder Categories

```http
PUT /api/categories/bulk/reorder
```

**Auth:** 🔧 Admin
**Use Case:** Admin panel drag-and-drop category reordering.

**Request body:**
```json
{
  "categories": [
    { "categoryId": "CAT001", "displayOrder": 1 },
    { "categoryId": "CAT003", "displayOrder": 2 },
    { "categoryId": "CAT002", "displayOrder": 3 }
  ]
}
```

---

### 4.10 Sync Product Counts

```http
POST /api/categories/sync-product-counts
```

**Auth:** 🔧 Admin
**Use Case:** Force-recalculate `productCount` for all categories. Run this if counts get out of sync.

---

### 4.11 Export Categories

```http
GET /api/categories/export?format=excel
GET /api/categories/export?format=csv
```

**Auth:** 🔧 Admin
**Downloads** a spreadsheet of all categories with their details.

---

## 5. Product APIs — Public (App Team)

**Base path:** `/api/products`

> **Visibility Rule:** ALL public product endpoints only return products with `listingStatus: "published"`. Pending approval, rejected, draft, and archived products are **never** returned to public users — regardless of auth state.

---

### 5.1 Get All Products

```http
GET /api/products
```

**Auth:** 🌐 Public

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10, max: 100) |
| `search` | string | Search in name and description |
| `category` | string | Filter by category ID (includes subcategories recursively) |
| `brand` | string | Filter by brand name |
| `minPrice` | number | Minimum final price |
| `maxPrice` | number | Maximum final price |
| `region` | string | Region code (e.g., `IN`, `US`, `global`) |
| `hasVariants` | boolean | `true` = only products with variants |
| `simpleOnly` | boolean | `true` = only products without variants |
| `attr[Color]` | string | Variant attribute filter (e.g., `?attr[Color]=Red&attr[Size]=L`) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "PROD123456",
      "name": "Samsung Galaxy S24",
      "brand": "Samsung",
      "pricing": {
        "regularPrice": 79999,
        "salePrice": 74999,
        "finalPrice": 74999,
        "currency": "INR"
      },
      "availability": {
        "isAvailable": true,
        "stockQuantity": 25,
        "stockStatus": "in_stock"
      },
      "images": [{ "url": "https://cdn.epi.com/s24-front.jpg", "altText": "Galaxy S24" }],
      "hasVariants": false,
      "listingStatus": "published",
      "sellerId": "64abc...",
      "sellerInfo": {
        "storeName": "Ramesh Electronics",
        "rating": 4.3,
        "isVerified": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "pages": 15
  }
}
```

---

### 5.2 Get Single Product

```http
GET /api/products/:productId
```

**Auth:** 🌐 Public
**`:productId`** accepts either the custom string ID (e.g., `PROD123456`) or the MongoDB `_id`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "productId": "PROD123456",
    "name": "Samsung Galaxy S24",
    "description": {
      "short": "Latest Samsung flagship with AI features",
      "long": "Full detailed description...",
      "features": ["108MP camera", "5000mAh battery"],
      "specifications": [
        { "key": "RAM", "value": "8", "unit": "GB" },
        { "key": "Storage", "value": "256", "unit": "GB" }
      ]
    },
    "brand": "Samsung",
    "pricing": {
      "regularPrice": 79999,
      "salePrice": 74999,
      "finalPrice": 74999,
      "currency": "INR"
    },
    "availability": {
      "isAvailable": true,
      "stockQuantity": 25,
      "stockStatus": "in_stock"
    },
    "images": [
      { "url": "https://cdn.epi.com/s24-front.jpg", "altText": "Front view", "isPrimary": true }
    ],
    "hasVariants": true,
    "defaultVariantId": "VAR001",
    "condition": "new",
    "taxInfo": { "hsnCode": "851712", "gstRate": 18 },
    "warranty": { "period": 12, "warrantyUnit": "months", "returnPolicy": 7 },
    "listingStatus": "published",
    "sellerId": "64abc...",
    "sellerInfo": {
      "storeName": "Ramesh Electronics",
      "rating": 4.3,
      "isVerified": true
    },
    "reviewStats": {
      "averageRating": 4.2,
      "totalReviews": 89,
      "ratingDistribution": { "5": 45, "4": 22, "3": 12, "2": 6, "1": 4 }
    }
  },
  "priceRange": {
    "min": 74999,
    "max": 89999,
    "currency": "INR"
  }
}
```

> **`priceRange`** is returned when `hasVariants: true`. Use this to display **"From ₹74,999"** on product cards.

**Note:** Returns `404` if product is deleted, or has any `listingStatus` other than `"published"`.

---

### 5.3 Search Products

```http
GET /api/products/search
```

**Auth:** 🌐 Public

**Query Parameters:** Same as `GET /api/products`, plus:

| Param | Type | Description |
|---|---|---|
| `q` or `query` | string | Search term |

**Example:**
```
GET /api/products/search?q=wireless+headphones&minPrice=500&maxPrice=5000&brand=Sony
```

---

### 5.4 Get Products by Category Name/Slug

```http
GET /api/products/category/:category
```

**Auth:** 🌐 Public

**`:category`** is the category ID (string). This endpoint **recursively includes all subcategories** — fetching Electronics also returns Smartphones, Laptops, etc.

**Only `listingStatus: "published"` products are returned.**

---

### 5.5 Get Products by Category MongoDB ID

```http
GET /api/products/categoryId/:categoryId
```

**Auth:** 🌐 Public

**`:categoryId`** is the MongoDB ObjectId of the category.

**Query Parameters:**

| Param | Type | Default |
|---|---|---|
| `page` | number | 1 |
| `limit` | number | 10 |

**Only `listingStatus: "published"` products are returned.**

---

### 5.6 Get Product Variants

```http
GET /api/products/:productId/variants
```

**Auth:** 🌐 Public
**Use Case:** Variant picker screen — show color/size options with individual prices.

**Returns 404** if the product is deleted or `listingStatus !== "published"`.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "productId": "PROD123456",
    "productName": "Premium T-Shirt",
    "priceRange": { "min": 299, "max": 349, "currency": "INR" },
    "totalVariants": 6,
    "activeVariants": 5,
    "variants": [
      {
        "variantId": "VAR001",
        "sku": "PROD123-V1-VAR001",
        "attributeKey": "Color:Red|Size:S",
        "attributes": [
          { "name": "Color", "value": "Red" },
          { "name": "Size", "value": "S" }
        ],
        "price": 299,
        "salePrice": null,
        "stock": 50,
        "images": [{ "url": "https://cdn.epi.com/red-tshirt.jpg" }],
        "isActive": true
      }
    ]
  }
}
```

**Flutter Implementation Guide:**
1. Fetch variants when user opens product detail screen
2. Group variants by attribute axes (Color, Size) — render as button groups or swatches
3. When user selects a combination, find the matching variant by `attributeKey`
4. Display that variant's `price` / `salePrice` and `images`
5. On "Add to Cart" — pass `{ productId, variantId, quantity }` to the order endpoint

---

### 5.7 Get Single Variant

```http
GET /api/products/:productId/variants/:variantId
```

**Auth:** 🌐 Public
**Use Case:** Deep-link to a specific product+variant combination (e.g., from a shared link).

**Returns 404** if product is deleted or not published.

---

### 5.8 Get Product Reviews

```http
GET /api/products/:productId/reviews
```

**Auth:** 🌐 Public

**Query Parameters:**

| Param | Type | Options / Description |
|---|---|---|
| `page` | number | Page number |
| `limit` | number | Reviews per page |
| `sort` | string | `mostHelpful`, `newest`, `oldest`, `highest`, `lowest` |
| `rating` | string | `5` or `5,4` — filter by star count |
| `verified` | string | `true` — only verified purchases |
| `hasImages` | string | `true` — only reviews with photos |
| `search` | string | Search in review text |

---

### 5.9 Get Product Plans (Installments)

```http
GET /api/products/:productId/plans
```

**Auth:** 🌐 Public
**Use Case:** Show EMI/installment plan options on the product detail page.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Quick Plan",
      "days": 30,
      "perDayAmount": 2500,
      "totalAmount": 75000,
      "isRecommended": true,
      "description": "Pay ₹2,500/day for 30 days"
    },
    {
      "name": "Standard Plan",
      "days": 90,
      "perDayAmount": 900,
      "totalAmount": 81000,
      "isRecommended": false
    }
  ]
}
```

---

### 5.10 Get Product Stats

```http
GET /api/products/stats
```

**Auth:** 🌐 Public
**Returns:** Total product count, category distribution, price range summary.

---

### 5.11 Get Low Stock Products

```http
GET /api/products/low-stock
```

**Auth:** 🌐 Public
**Use Case:** "Almost Gone!" section in the app — products with stock below their `lowStockLevel`.

**Only `listingStatus: "published"` products are returned.**

---

### 5.12 Featured Product Lists

```http
GET /api/products/featured/all
GET /api/products/featured/popular
GET /api/products/featured/best-sellers
GET /api/products/featured/trending
```

**Auth:** 🌐 Public
**Use Case:** Home screen sections.

| Endpoint | Home Screen Section |
|---|---|
| `/featured/all` | All featured products combined |
| `/featured/popular` | "Popular Products" section |
| `/featured/best-sellers` | "Best Sellers" section |
| `/featured/trending` | "Trending Now" section |

---

### 5.13 Products by Region

```http
GET /api/products/region/:region
```

**Auth:** 🌐 Public
**`:region`** — ISO 3166-1 alpha-2 country code or region name (e.g., `IN`, `US`, `global`).

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `search` | string | Search in name |
| `category` | string | Filter by category |
| `brand` | string | Filter by brand |
| `minPrice` | number | Min regional price |
| `maxPrice` | number | Max regional price |

**Only `listingStatus: "published"` products are returned.**

---

### 5.14 Get Single Product by Region

```http
GET /api/products/:productId/region/:region
```

**Auth:** 🌐 Public
**Returns** the product with region-specific pricing and availability details applied.

---

### 5.15 Get Region Stats

```http
GET /api/products/region/:region/stats
```

**Auth:** 🌐 Public
**Returns:** Product count, price range, and availability stats for the given region.

---

## 6. Product APIs — Admin Panel

**Base path:** `/api/products`
**Auth required:** All endpoints require `Authorization: Bearer <admin_token>`

---

### 6.1 Get All Products (Admin View)

```http
GET /api/products/admin/all
```

**Auth:** 🔧 Admin
**Returns:** ALL products including deleted, pending approval, rejected — no `listingStatus` filter applied.

**Additional filters available (beyond public):**

| Param | Type | Description |
|---|---|---|
| `listingStatus` | string | `draft`, `pending_approval`, `published`, `rejected`, `archived` |
| `isDeleted` | boolean | `true` to see soft-deleted products |
| `sellerId` | string | Filter by specific seller |

---

### 6.2 Create Product (Admin)

```http
POST /api/products
```

**Auth:** 🔧 Admin

**Admin-created products go live immediately** with `listingStatus: "published"` — no approval queue.

**Request body (minimum required):**
```json
{
  "name": "Sony WH-1000XM5",
  "description": {
    "short": "Industry-leading noise cancelling headphones",
    "long": "Detailed description..."
  },
  "brand": "Sony",
  "category": {
    "mainCategoryId": "64abc123...",
    "mainCategoryName": "Electronics",
    "subCategoryId": "64def456...",
    "subCategoryName": "Headphones"
  },
  "pricing": {
    "regularPrice": 29990,
    "salePrice": 24990,
    "currency": "INR"
  },
  "availability": {
    "stockQuantity": 50,
    "lowStockLevel": 5,
    "stockStatus": "in_stock"
  },
  "images": [
    { "url": "https://cdn.epi.com/sony-wh1000xm5.jpg", "altText": "Sony headphones", "isPrimary": true }
  ],
  "status": "published"
}
```

**Optional fields:**
```json
{
  "sku": "SONY-WH1000XM5-BLK",
  "tags": ["noise-cancelling", "wireless", "premium"],
  "condition": "new",
  "taxInfo": { "hsnCode": "8518", "gstRate": 18 },
  "warranty": { "period": 12, "warrantyUnit": "months", "returnPolicy": 7 },
  "dimensions": { "weight": 250, "weightUnit": "g" },
  "seo": {
    "metaTitle": "Buy Sony WH-1000XM5 — Best Price",
    "metaDescription": "Shop Sony noise-cancelling headphones...",
    "keywords": ["sony", "headphones", "wireless"]
  },
  "plans": [
    {
      "name": "30-Day Plan",
      "days": 30,
      "perDayAmount": 1000,
      "totalAmount": 30000,
      "isRecommended": true
    }
  ],
  "hasVariants": false,
  "isFeatured": false,
  "isPopular": false
}
```

**Specifications format (v2.1):** `description.specifications` accepts **two formats** — either is fine:

```json
// Object array (preferred):
"specifications": [{ "key": "RAM", "value": "8", "unit": "GB" }, { "key": "Storage", "value": "256", "unit": "GB" }]

// String array (legacy-compatible):
"specifications": ["RAM: 8 GB", "Storage: 256 GB"]
```

The backend normalises string entries to `{ key, value, unit }` automatically.

**Fields automatically set by server (never send from frontend):**
- `createdByEmail` — from admin's JWT
- `listingStatus` — always `"published"` for admin-created products
- `productId` — auto-generated if not provided

---

### 6.3 Update Product (Admin)

```http
PUT /api/products/:productId
```

**Auth:** 🔧 Admin

**Supports partial updates** — only send the fields you want to change.

**Updatable fields:**
`name`, `description`, `brand`, `pricing`, `availability`, `images`, `category`, `tags`, `condition`, `taxInfo`, `seo`, `plans`, `status`, `slug`, `defaultVariantId`, `listingStatus`, `isFeatured`, `isPopular`, `isBestSeller`, `isTrending`, `warranty`, `dimensions`, `hasVariants`, `sellerId`, `sellerInfo`

> **Note (v2.1):** `sellerId` and `sellerInfo` are now updatable via this endpoint, allowing admin to reassign a product to a different seller or update the denormalized seller display info.

> **Note on `listingStatus`:** Admin can update `listingStatus` directly via this endpoint. For the formal seller approval flow (with push notification to seller), use `PATCH /api/products/:productId/listing-status` instead.

---

### 6.4 Soft Delete / Restore / Hard Delete

```http
DELETE /api/products/:productId           # Soft delete (sets isDeleted: true, recoverable)
PUT    /api/products/:productId/restore   # Restore a soft-deleted product
DELETE /api/products/:productId/hard      # Permanent deletion — IRREVERSIBLE
```

**Auth:** 🔧 Admin

---

### 6.5 Approve or Reject Seller Product Listing

```http
PATCH /api/products/:productId/listing-status
```

**Auth:** 🔧 Admin
**Use Case:** Admin panel listing review screen — approve or reject products submitted by sellers.

**Request body — Approve:**
```json
{
  "action": "approve"
}
```

**Request body — Reject:**
```json
{
  "action": "reject",
  "reason": "Product images are blurry. Please upload high-quality photos (minimum 800×800px)."
}
```

**Response 200 — Approve:**
```json
{
  "success": true,
  "message": "Product approved and is now published",
  "data": {
    "productId": "PROD123456",
    "listingStatus": "published",
    "listingReviewedBy": "64adminid...",
    "listingReviewedAt": "2026-02-28T10:30:00.000Z"
  }
}
```

**Response 200 — Reject:**
```json
{
  "success": true,
  "message": "Product rejected",
  "data": {
    "productId": "PROD123456",
    "listingStatus": "rejected",
    "listingRejectionReason": "Product images are blurry...",
    "listingReviewedAt": "2026-02-28T10:30:00.000Z"
  }
}
```

**Valid state transitions:**

| Current Status | Action | New Status |
|---|---|---|
| `pending_approval` | `approve` | `published` |
| `pending_approval` | `reject` | `rejected` |
| `rejected` | `approve` | `published` (re-approve after seller edits) |
| `published` | `reject` | `rejected` (pull a live listing) |

**Behaviour:**
- A **push notification** is automatically sent to the seller's device on both approve and reject.
- This endpoint only works on **seller products** (`sellerId` is set). Admin platform products cannot go through this flow.

**Error — no reason given for rejection:**
```json
{ "success": false, "message": "Rejection reason is required", "code": "REASON_REQUIRED" }
```

**Error — platform product:**
```json
{ "success": false, "message": "This product is not a seller listing", "code": "NOT_A_SELLER_PRODUCT" }
```

---

### 6.6 Update Product Images

```http
PUT /api/products/:productId/images
```

**Auth:** 🔧 Admin
**Content-Type:** `multipart/form-data`
**Form field name:** `images` (supports multiple files)

---

### 6.7 Delete Individual Image

```http
DELETE /api/products/:productId/images/:imageIndex
```

**Auth:** 🔧 Admin
**`:imageIndex`** — zero-based index of the image in the `images` array.

---

### 6.8 Reorder Product Images

```http
PUT /api/products/:productId/images/reorder
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "order": [2, 0, 1]
}
```

---

### 6.9 Update Product SEO

```http
PUT /api/products/:productId/seo
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "metaTitle": "Buy Sony WH-1000XM5 | Best Price in India",
  "metaDescription": "Shop Sony WH-1000XM5 noise-cancelling headphones at EPI...",
  "keywords": ["sony headphones", "wireless headphones", "noise cancelling"]
}
```

---

### 6.10 Update Product Plans

```http
PUT /api/products/:productId/plans
```

**Auth:** 🔧 Admin
**Replaces the entire plans array** for the product.

**Request body:**
```json
{
  "plans": [
    {
      "name": "Quick Plan",
      "days": 30,
      "perDayAmount": 1000,
      "totalAmount": 30000,
      "isRecommended": true
    },
    {
      "name": "Extended Plan",
      "days": 90,
      "perDayAmount": 350,
      "totalAmount": 31500,
      "isRecommended": false
    }
  ]
}
```

---

### 6.11 Mark as Featured / Popular / Trending / Best Seller

```http
POST   /api/products/:productId/mark-popular
POST   /api/products/:productId/mark-bestseller
POST   /api/products/:productId/mark-trending

DELETE /api/products/:productId/remove-popular
DELETE /api/products/:productId/remove-bestseller
DELETE /api/products/:productId/remove-trending
```

**Auth:** 🔧 Admin

---

### 6.12 Bulk Mark Products

```http
POST /api/products/bulk/mark-products
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "productIds": ["PROD001", "PROD002", "PROD003"],
  "action": "mark-popular"
}
```

---

### 6.13 Export Products

```http
GET /api/products/export?format=excel
GET /api/products/export?format=csv
```

**Auth:** 🔧 Admin
**Downloads** a spreadsheet of all products with their details.

---

### 6.14 Sync Exchange Rates (Regional Pricing)

```http
POST /api/products/sync-exchange-rates
```

**Auth:** 🔧 Admin
**Use Case:** Force-refresh currency exchange rates and recalculate all non-overridden regional prices.

---

## 7. Variant System

Variants represent different purchasable combinations of a product (e.g., Color × Size). Each variant has its own **price**, **stock quantity**, and **images**.

---

### 7.1 How Variants Work

```
Product: "Premium T-Shirt"  (hasVariants: true)
  Category attributeSchema: [Color: [Red, Blue], Size: [S, M, L]]
  → 6 variant combinations auto-generated

  VAR001: Color=Red  + Size=S | ₹299 | stock: 50 | images: [red-front.jpg]
  VAR002: Color=Red  + Size=M | ₹299 | stock: 40 | images: [red-front.jpg]
  VAR003: Color=Red  + Size=L | ₹299 | stock: 20 | images: [red-front.jpg]
  VAR004: Color=Blue + Size=S | ₹349 | stock: 0  | isActive: false (out of stock)
  VAR005: Color=Blue + Size=M | ₹349 | stock: 15 | images: [blue-front.jpg]
  VAR006: Color=Blue + Size=L | ₹349 | stock: 8  | images: [blue-front.jpg]

Product card displays: "From ₹299"
User selects Color=Red → show Red images, prices
User selects Color=Red + Size=M → price ₹299, "Add to Cart" → sends variantId = "VAR002"
```

---

### 7.2 Admin Workflow — Creating Variants

**Step 1 — Preview the matrix (no data saved yet)**
```http
POST /api/products/:productId/generate-variant-matrix
```

Returns skeleton variants from the category's `attributeSchema`. Preview only — nothing is saved.

**Step 2 — Upload images per variant** (in admin panel, for color variants)
```http
PUT /api/products/:productId/variants/:variantId/images
```

**Step 3 — Apply the matrix with prices filled in**
```http
POST /api/products/:productId/apply-variant-matrix
```

**Request body:**
```json
{
  "variants": [
    {
      "variantId": null,
      "attributes": [
        { "name": "Color", "value": "Red" },
        { "name": "Size", "value": "S" }
      ],
      "price": 299,
      "salePrice": null,
      "stock": 50,
      "isActive": true
    },
    {
      "variantId": null,
      "attributes": [
        { "name": "Color", "value": "Blue" },
        { "name": "Size", "value": "M" }
      ],
      "price": 349,
      "salePrice": 299,
      "stock": 15,
      "isActive": true
    }
  ]
}
```

**Rules:**
- `variantId: null` → creates a new variant (system generates ID)
- `variantId: "VAR001"` → updates an existing variant (preserves its images)
- `price` is required and must be ≥ 0
- `salePrice` must be strictly less than `price` if provided

> **Merge behaviour (v2.1):** `apply-variant-matrix` now **merges** with the existing variants array — it does NOT replace it entirely.
> - Variants matched by `variantId` → price, salePrice, stock, isActive updated; **images are preserved**
> - Variants with `variantId: null` → added as new entries
> - Variants **not included** in the payload → **remain unchanged** (use `DELETE /variants/:variantId` to explicitly remove them)

---

### 7.3 Update a Single Variant

```http
PATCH /api/products/:productId/variants/:variantId
```

**Auth:** 🔧 Admin
**Use Case:** Quick price or stock adjustment without rebuilding the full matrix.

**Request body (partial — only send fields to update):**
```json
{
  "price": 349,
  "salePrice": 299,
  "stock": 35,
  "isActive": true
}
```

To remove a sale price / discount:
```json
{ "salePrice": null }
```

---

### 7.4 Delete a Variant

```http
DELETE /api/products/:productId/variants/:variantId
```

**Auth:** 🔧 Admin
**Effect:** Removes the variant and its S3 images. If this was the last variant, `product.hasVariants` is set to `false`.

---

### 7.5 Variant Image Management

```http
PUT    /api/products/:productId/variants/:variantId/images              # Upload images
PUT    /api/products/:productId/variants/:variantId/images/reorder      # Reorder images
DELETE /api/products/:productId/variants/:variantId/images/:imageIndex  # Delete one image
```

**Auth:** 🔧 Admin
**Content-Type for upload:** `multipart/form-data`

---

## 8. Regional System

Products support region-specific pricing, availability, and SEO. This allows different prices for India vs. USA vs. UAE without duplicating products.

---

### 8.1 Add Regional Pricing

```http
POST /api/products/:productId/regional-pricing
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "region": "US",
  "regularPrice": 299,
  "salePrice": 249,
  "currency": "USD",
  "isManualOverride": true
}
```

`isManualOverride: true` prevents this price from being overwritten when exchange rates are synced. Set to `false` to let the system auto-calculate from INR.

---

### 8.2 Add Regional Availability

```http
POST /api/products/:productId/regional-availability
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "region": "IN",
  "isAvailable": true,
  "stockQuantity": 100,
  "shippingDays": 3
}
```

---

### 8.3 Add Regional SEO

```http
POST /api/products/:productId/regional-seo
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "region": "IN",
  "metaTitle": "Buy Samsung Galaxy S24 in India",
  "metaDescription": "Get the best price on Samsung Galaxy S24 in India...",
  "keywords": ["samsung s24 india", "samsung price india"]
}
```

---

### 8.4 Sync Regional Data

```http
POST /api/products/:productId/sync-regional
```

**Auth:** 🔧 Admin
**Effect:** Recalculates all non-overridden regional prices for this product based on current exchange rates.

---

### 8.5 Bulk Update Regional Pricing

```http
POST /api/products/bulk/regional-pricing
```

**Auth:** 🔧 Admin
**Use Case:** Update prices for multiple products in a region at once.

---

### 8.6 Add Related Products

```http
POST /api/products/:productId/related-products
```

**Auth:** 🔧 Admin

**Request body:**
```json
{
  "relatedProductIds": ["PROD001", "PROD002", "PROD003"]
}
```

---

## 9. Seller System (Summary)

> This section is a summary. For the complete seller API documentation, see [`SELLER_SYSTEM_API_DOCUMENTATION.md`](./SELLER_SYSTEM_API_DOCUMENTATION.md).

**Base path:** `/api/seller`
**Auth:** Seller JWT required on all endpoints.

### 9.1 Seller Endpoints Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/seller/profile` | Get seller profile + stats |
| PUT | `/api/seller/profile` | Update store name, description, GST/PAN |
| GET | `/api/seller/dashboard` | KPI summary (products, orders, revenue) |
| GET | `/api/seller/products` | List own products (filterable by `listingStatus`) |
| POST | `/api/seller/products` | Create product (goes to `pending_approval`) |
| PUT | `/api/seller/products/:productId` | Update own product |
| DELETE | `/api/seller/products/:productId` | Delete own product (cannot delete published) |
| GET | `/api/seller/orders` | List orders for own products |
| GET | `/api/seller/orders/:orderId` | Order detail (own only) |
| PATCH | `/api/seller/orders/:orderId/fulfillment` | Update fulfillment status |

### 9.2 Seller Product Lifecycle

```
POST /api/seller/products
    ↓ listingStatus: "pending_approval"

Admin reviews → PATCH /api/products/:id/listing-status { action: "approve" }
    ↓ listingStatus: "published"  → product is NOW visible to buyers

Seller edits published product → PUT /api/seller/products/:id
    ↓ listingStatus auto-resets to "pending_approval" → product goes OFFLINE until re-approved
```

### 9.3 Seller Fulfillment Flow

```
Order placed → sellerFulfillmentStatus: "pending"
Seller confirms → "confirmed" → buyer notified
Seller packs → "packed" → buyer notified
Seller ships → "shipped" → buyer notified + sellerFulfilledAt set
Admin delivers → "delivered" → seller wallet credited automatically
```

**Commission formula:** `sellerEarning = orderTotal × (1 - platformCommissionRate%)`

Commission is resolved at order time using this priority:
1. Seller's `sellerProfile.commissionRate` (if set as override)
2. Category's `commissionRate`
3. Platform default: **15%**

---

## 10. Data Models Reference

### 10.1 Product Object

| Field | Type | Description |
|---|---|---|
| `productId` | string | Unique human-readable ID (e.g., `PROD123456`) |
| `name` | string | Product name |
| `description.short` | string | Brief description (10–500 chars, shown on cards) |
| `description.long` | string | Full HTML/markdown description (detail page) |
| `description.features` | string[] | Bullet-point feature list |
| `description.specifications` | array | `[{ key, value, unit }]` — tech specs |
| `brand` | string | Brand name |
| `sku` | string | Stock keeping unit (unique) |
| `slug` | string | URL-friendly name (auto-generated from `name`) |
| `condition` | string | `new` / `refurbished` / `used` / `pre-owned` |
| `pricing.regularPrice` | number | MRP / original price (INR) |
| `pricing.salePrice` | number | Discounted price (optional, must be < regularPrice) |
| `pricing.finalPrice` | number | Effective price (`salePrice` if set, else `regularPrice`) |
| `pricing.currency` | string | Always `"INR"` for base price |
| `availability.stockQuantity` | number | Current stock count |
| `availability.lowStockLevel` | number | Alert threshold (default 10) |
| `availability.stockStatus` | string | `in_stock` / `low_stock` / `out_of_stock` / `pre_order` |
| `availability.isAvailable` | boolean | Whether product can be ordered |
| `images` | array | `[{ url, altText, isPrimary }]` |
| `hasVariants` | boolean | `true` if product has multiple variants |
| `defaultVariantId` | string | Variant shown first on product card |
| `variants` | array | Array of variant objects (see below) |
| `category.mainCategoryId` | ObjectId | Primary category |
| `category.mainCategoryName` | string | Denormalized category name |
| `category.subCategoryId` | ObjectId | Subcategory (optional) |
| `category.subCategoryName` | string | Denormalized subcategory name |
| `taxInfo.hsnCode` | string | 6-8 digit HSN code (GST compliance) |
| `taxInfo.gstRate` | number | `0`, `5`, `12`, `18`, or `28` |
| `warranty.period` | number | Warranty duration |
| `warranty.warrantyUnit` | string | `days` / `months` / `years` |
| `warranty.returnPolicy` | number | Return window in days |
| `plans` | array | Installment plans (see Section 5.9) |
| `tags` | string[] | Search and filter tags |
| `sellerId` | ObjectId | Seller owner. `null` = platform product |
| `sellerInfo.storeName` | string | Seller store name (denormalized) |
| `sellerInfo.rating` | number | Seller aggregate rating (0–5) |
| `sellerInfo.isVerified` | boolean | Seller verification badge |
| `listingStatus` | string | `draft` / `pending_approval` / `published` / `rejected` / `archived` |
| `listingRejectionReason` | string | Admin's rejection message (if status = rejected) |
| `status` | string | Product's own state: `draft` / `published` / `archived` |
| `isFeatured` | boolean | Featured flag |
| `isPopular` | boolean | Popular flag |
| `isBestSeller` | boolean | Best seller flag |
| `isTrending` | boolean | Trending flag |
| `reviewStats.averageRating` | number | Aggregated review rating (0–5) |
| `reviewStats.totalReviews` | number | Total review count |
| `isDeleted` | boolean | Soft-delete flag |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

---

### 10.2 Variant Object

| Field | Type | Description |
|---|---|---|
| `variantId` | string | Unique ID (e.g., `VAR001`) |
| `sku` | string | Variant-specific SKU |
| `attributeKey` | string | Sorted combination string (e.g., `Color:Red\|Size:L`) |
| `attributes` | array | `[{ name: "Color", value: "Red" }]` |
| `price` | number | Variant price (INR) |
| `salePrice` | number | Variant sale price (null if no discount) |
| `stock` | number | Variant stock quantity |
| `images` | array | Variant-specific images `[{ url, altText }]` |
| `isActive` | boolean | `false` = variant not available (e.g., out of stock) |

---

### 10.3 Category Object

| Field | Type | Description |
|---|---|---|
| `categoryId` | string | Unique human-readable ID |
| `name` | string | Category display name |
| `slug` | string | URL-friendly name |
| `parentCategoryId` | ObjectId | Parent category. `null` = top-level |
| `subCategories` | ObjectId[] | Child category IDs |
| `level` | number | Hierarchy depth: `0` = main, `1` = sub |
| `commissionRate` | number | Platform commission % for this category (0–100) |
| `isRestricted` | boolean | If `true`, only verified sellers can list here |
| `attributeSchema` | array | Variant attribute definitions (see below) |
| `isFeatured` | boolean | Show in featured sections |
| `showInMenu` | boolean | Show in navigation menu |
| `displayOrder` | number | Sort order |
| `productCount` | number | Auto-maintained count of active published products |
| `mainImage` | object | `{ url, altText }` |
| `bannerImages` | array | Array of banner image objects |
| `seo` | object | `{ metaTitle, metaDescription, keywords }` |

**`attributeSchema` entry:**
```json
{
  "name": "Color",
  "type": "color_swatch",
  "options": ["Red", "Blue", "Black"],
  "isRequired": false,
  "isFilterable": true,
  "unit": null
}
```

| `type` value | UI element |
|---|---|
| `text` | Dropdown / chip buttons |
| `color_swatch` | Color circle swatches |
| `number` | Numeric input |
| `boolean` | Toggle (Yes/No) |

---

### 10.4 Listing Status Flow Diagram

```
Admin creates product:
  listingStatus = "published"  ──────────────────▶  visible to buyers

Seller creates product:
  listingStatus = "pending_approval"
         │
         ├─[Admin approves]──▶  "published"  ──[Admin rejects]──▶  "rejected"
         │                           │                                   │
         └─[Admin rejects]──▶  "rejected"  ◀──[Seller edits]────────────┘

  "draft" (isDraft: true)  ──[Seller submits]──▶  "pending_approval"

  Seller archives: set status = "archived"  →  hidden from buyers, not deleted
  Seller deletes:  only allowed if listingStatus ≠ "published"
```

---

## 11. Error Codes Reference

### Standard Error Response Format

```json
{
  "success": false,
  "message": "Human-readable explanation of the error",
  "code": "ERROR_CODE",
  "errors": [
    { "field": "pricing.salePrice", "message": "Sale price must be less than regular price" }
  ]
}
```

`errors` array is only present for `VALIDATION_ERROR`.

### Error Code Table

| HTTP | Code | When it occurs | Fix |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Schema validation failed | Check `errors[]` for field details |
| 400 | `INVALID_PRICE` | `salePrice >= regularPrice` | Ensure `salePrice < regularPrice` |
| 400 | `PRICE_REQUIRED` | No price field or price ≤ 0 | Add `pricing.regularPrice > 0` |
| 400 | `VARIANTS_REQUIRED` | `hasVariants: true` but no variants array | Include `variants` array |
| 400 | `VARIANT_PRICE_REQUIRED` | A variant missing `price` field | Add `price` to each variant |
| 400 | `VARIANT_SALE_PRICE_INVALID` | Variant `salePrice >= price` | Fix variant sale price |
| 400 | `DUPLICATE_VARIANT` | Two variants with same attribute combo | Remove the duplicate variant |
| 400 | `INVALID_ACTION` | Listing status action not `approve` or `reject` | Fix the `action` field value |
| 400 | `REASON_REQUIRED` | Rejection without providing a reason | Add the `reason` field |
| 400 | `NOT_A_SELLER_PRODUCT` | Approving a platform product (no `sellerId`) | Only seller products need approval |
| 400 | `INCOMPLETE_SELLER_PROFILE` | Seller has no `storeName` | Set `storeName` in seller profile first |
| 400 | `NO_FIELDS` | Update body is empty | Include at least one updatable field |
| 400 | `CAST_ERROR` | Invalid MongoDB ObjectId format | Check the ID format |
| 401 | `NO_TOKEN` | Missing `Authorization` header | Add `Bearer <token>` header |
| 401 | `TOKEN_EXPIRED` | JWT has expired | Re-login to get a fresh token |
| 403 | `ADMIN_REQUIRED` | Endpoint requires admin role | Use an admin account |
| 403 | `SELLER_REQUIRED` | Endpoint requires seller role | Use a seller account |
| 403 | `FORBIDDEN` | Seller accessing another seller's resource | Use your own resources only |
| 404 | `PRODUCT_NOT_FOUND` | Product doesn't exist, is deleted, or not published | Verify the product ID |
| 404 | `ORDER_NOT_FOUND` | Order not found or belongs to another seller | Verify the order ID |
| 409 | `DUPLICATE_KEY` | Duplicate `productId`, `sku`, or `slug` | Use a unique value |
| 409 | `INVALID_STATUS_TRANSITION` | Invalid listing or fulfillment state change | Follow the state machine |
| 409 | `CANNOT_DELETE_PUBLISHED` | Deleting a published product | Archive it first, then delete |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Report to backend team with request details |

---

## 12. QA Test Scenarios

### 12.1 Product Visibility (Critical)

| # | Test | Input | Expected Result |
|---|---|---|---|
| V1 | Public list — only published products | `GET /api/products` (no auth) | Only `listingStatus: "published"` products |
| V2 | Search — only published products | `GET /api/products/search?q=samsung` | No `pending_approval` / `rejected` products |
| V3 | Category — only published products | `GET /api/products/category/:id` | No seller pending products |
| V4 | Category by ID — only published | `GET /api/products/categoryId/:categoryId` | Only published |
| V5 | Region — only published products | `GET /api/products/region/IN` | Only published |
| V6 | Single product — pending | `GET /api/products/:id` for `pending_approval` product | 404 Not Found |
| V7 | Single product — rejected | `GET /api/products/:id` for `rejected` product | 404 Not Found |
| V8 | Variants of non-published product | `GET /api/products/:id/variants` for pending product | 404 Not Found |
| V9 | Admin list — all statuses | `GET /api/products/admin/all` with admin token | All `listingStatus` values present |
| V10 | Admin list — filter by pending | `GET /api/products/admin/all?listingStatus=pending_approval` | Only pending products |
| V11 | Soft-deleted product — public | `GET /api/products/:id` for deleted product | 404 Not Found |
| V12 | Soft-deleted product — admin | `GET /api/products/admin/all?isDeleted=true` with admin token | Deleted products visible |

---

### 12.2 Seller Product Lifecycle

| # | Test | Steps | Expected Result |
|---|---|---|---|
| P1 | Seller creates product — no storeName | `POST /api/seller/products` (profile incomplete) | 400 `INCOMPLETE_SELLER_PROFILE` |
| P2 | Seller creates product — price = 0 | `POST /api/seller/products` with `regularPrice: 0` | 400 `PRICE_REQUIRED` |
| P3 | Seller creates product — salePrice >= regularPrice | `salePrice: 100, regularPrice: 50` | 400 `INVALID_PRICE` |
| P4 | Seller creates valid product | Valid body with `regularPrice > 0` | 201, `listingStatus: "pending_approval"` |
| P5 | New product NOT visible publicly | `GET /api/products/:id` after P4 | 404 (not published) |
| P6 | Admin approves product | `PATCH /api/products/:id/listing-status { action: "approve" }` | 200, `listingStatus: "published"`, push sent to seller |
| P7 | Product visible after approval | `GET /api/products/:id` after P6 | 200 with product data |
| P8 | Admin rejects without reason | `{ action: "reject" }` — no reason | 400 `REASON_REQUIRED` |
| P9 | Admin rejects with reason | `{ action: "reject", reason: "Bad images" }` | 200, `listingStatus: "rejected"`, push sent |
| P10 | Rejected product not visible | `GET /api/products/:id` after P9 | 404 |
| P11 | Seller re-edits rejected product | `PUT /api/seller/products/:id` with fixes | 200, `listingStatus: "pending_approval"` |
| P12 | Admin approves previously rejected | `PATCH listing-status { action: "approve" }` on rejected | 200, `listingStatus: "published"` |
| P13 | Seller edits published product | `PUT /api/seller/products/:id` | 200, `listingStatus: "pending_approval"`, product OFFLINE |
| P14 | Delete published product | `DELETE /api/seller/products/:id` (published) | 409 `CANNOT_DELETE_PUBLISHED` |
| P15 | Archive then delete product | `PUT (...status: "archived")` → `DELETE` | 200 on both |
| P16 | Seller A edits Seller B's product | `PUT /api/seller/products/:sellerBProductId` with seller A token | 403 `FORBIDDEN` |
| P17 | Admin approves platform product | `PATCH listing-status { action: "approve" }` on admin product | 400 `NOT_A_SELLER_PRODUCT` |
| P18 | Draft product — save without submit | `POST /api/seller/products { isDraft: true }` | 201, `listingStatus: "draft"` |

---

### 12.3 Variant System

| # | Test | Input | Expected Result |
|---|---|---|---|
| R1 | Generate matrix preview | `POST /generate-variant-matrix` | Returns matrix, nothing saved to DB |
| R2 | Apply matrix — duplicate attribute combo | Two entries with same Color+Size | 400 `DUPLICATE_VARIANT` |
| R3 | Apply matrix — variant salePrice >= price | `salePrice: 300, price: 299` | 400 `VARIANT_SALE_PRICE_INVALID` |
| R4 | Update variant — remove sale price | `PATCH /variants/:id { salePrice: null }` | 200, discount removed |
| R5 | Update variant — negative price | `{ price: -10 }` | 400 Validation error |
| R6 | Delete last variant | `DELETE /variants/:variantId` | `hasVariants: false` on product |
| R7 | Product with variants — priceRange in response | `GET /products/:id` where `hasVariants: true` | Response includes `priceRange: { min, max, currency }` |
| R8 | Get variants of rejected product | `GET /products/:id/variants` for rejected product | 404 |

---

### 12.4 Order Routing & Fulfillment

| # | Test | Steps | Expected Result |
|---|---|---|---|
| O1 | Order on seller product | Place order on published seller product | `order.sellerId` = seller `_id`, `sellerFulfillmentStatus: "pending"` |
| O2 | Order on platform product | Place order on admin product (`sellerId: null`) | `sellerFulfillmentStatus: "not_applicable"` |
| O3 | Seller sees own orders | `GET /api/seller/orders` | Orders from O1 visible |
| O4 | Seller does NOT see platform orders | `GET /api/seller/orders` | Order from O2 absent |
| O5 | Cross-seller order access | `GET /api/seller/orders/:sellerBOrderId` with seller A token | 404 |
| O6 | Fulfillment — valid confirm | `PATCH /fulfillment { status: "confirmed" }` from `pending` | 200, buyer notified |
| O7 | Fulfillment — invalid skip | `{ status: "shipped" }` from `pending` | 409 `INVALID_STATUS_TRANSITION` |
| O8 | Fulfillment — seller sets delivered | `{ status: "delivered" }` | 409 (admin only) |
| O9 | Admin marks DELIVERED | `PUT /admin/orders/:id/delivery-status { status: "DELIVERED" }` | 200 |
| O10 | Seller wallet credited after delivery | `GET /api/seller/profile` after O9 | `wallet.balance` increased |
| O11 | Earning amount correct | Commission 15%, order ₹74,999 | Earning = ₹74,999 × 0.85 = ₹63,749.15 |
| O12 | Idempotency — mark delivered twice | O9 endpoint called again on same order | 200, wallet balance unchanged |
| O13 | Commission captured at order time | Order placed, commission resolved | `order.sellerCommissionPercentage` = correct rate |

---

### 12.5 Category APIs

| # | Test | Input | Expected Result |
|---|---|---|---|
| C1 | Get all categories | `GET /api/categories` | 200, list of categories |
| C2 | Category with subcategories | `GET /api/categories/:id/with-subcategories` | Full `subCategories` array populated |
| C3 | Featured categories | `GET /api/categories/featured` | Only `isFeatured: true` categories |
| C4 | Search categories | `GET /api/categories/search/smart` | Categories matching "smart" |
| C5 | Create category without name | `POST /api/categories {}` | 400 Validation error |
| C6 | Create category with `commissionRate: 18` | Admin creates Electronics with 18% | Seller order uses 18% commission |
| C7 | Toggle featured | `PUT /api/categories/:id/toggle-featured` | `isFeatured` flips |
| C8 | Soft delete category | `DELETE /api/categories/:id` | Category hidden, not removed |
| C9 | Restore deleted category | `PUT /api/categories/:id/restore` | Category visible again |
| C10 | Export categories CSV | `GET /api/categories/export?format=csv` | File download |

---

### 12.6 Authentication & Authorization

| # | Test | Input | Expected Result |
|---|---|---|---|
| A1 | Seller calls admin create product | `POST /api/products` with seller token | 403 `ADMIN_REQUIRED` |
| A2 | Admin calls seller orders | `GET /api/seller/orders` with admin token | 403 `SELLER_REQUIRED` |
| A3 | Unauthenticated delete | `DELETE /api/products/:id` — no token | 401 `NO_TOKEN` |
| A4 | Expired token | Any protected endpoint | 401 `TOKEN_EXPIRED` |
| A5 | User (not seller) at seller endpoint | `GET /api/seller/dashboard` with user token | 403 `SELLER_REQUIRED` |

---

### 12.7 Input Validation

| # | Test | Input | Expected Result |
|---|---|---|---|
| I1 | Product — salePrice >= regularPrice | `salePrice: 5000, regularPrice: 4999` | 400 `INVALID_PRICE` |
| I2 | Product — no pricing | `POST /api/seller/products` with no pricing | 400 `PRICE_REQUIRED` |
| I3 | Product — limit DoS | `GET /api/products?limit=99999` | Max 100 results returned |
| I4 | Reject without reason | `PATCH listing-status { action: "reject" }` | 400 `REASON_REQUIRED` |
| I5 | Invalid `listingStatus` filter | `GET /api/seller/products?listingStatus=invalid` | 400 `INVALID_FILTER` |
| I6 | Invalid `fulfillmentStatus` filter | `GET /api/seller/orders?fulfillmentStatus=xyz` | 400 `INVALID_FILTER` |

---

## 13. Quick Reference by Team

### App / Mobile Team — Screens to Endpoint Map

| Screen | HTTP | Endpoint |
|---|---|---|
| Home — Category carousel | GET | `/api/categories/featured` |
| Home — Featured products | GET | `/api/products/featured/all` |
| Home — Popular | GET | `/api/products/featured/popular` |
| Home — Best Sellers | GET | `/api/products/featured/best-sellers` |
| Home — Trending | GET | `/api/products/featured/trending` |
| Category screen | GET | `/api/products/category/:categoryId` |
| Search screen | GET | `/api/products/search?q=...` |
| Product detail | GET | `/api/products/:productId` |
| Variant picker | GET | `/api/products/:productId/variants` |
| Reviews tab | GET | `/api/products/:productId/reviews` |
| Installment plans | GET | `/api/products/:productId/plans` |
| Category dropdown (form) | GET | `/api/categories/dropdown/all` |
| Region-specific listing | GET | `/api/products/region/:region` |
| Seller store page | GET | `/api/products?sellerId=...` |

---

### Admin Panel — Product Management Flow

| Task | Method | Endpoint |
|---|---|---|
| View all products | GET | `/api/products/admin/all` |
| View pending seller listings | GET | `/api/products/admin/all?listingStatus=pending_approval` |
| Create new platform product | POST | `/api/products` |
| Edit product | PUT | `/api/products/:productId` |
| Approve seller listing | PATCH | `/api/products/:productId/listing-status { action: "approve" }` |
| Reject seller listing | PATCH | `/api/products/:productId/listing-status { action: "reject", reason: "..." }` |
| Delete product | DELETE | `/api/products/:productId` |
| Restore deleted product | PUT | `/api/products/:productId/restore` |
| Generate variant matrix | POST | `/api/products/:productId/generate-variant-matrix` |
| Apply variant matrix | POST | `/api/products/:productId/apply-variant-matrix` |
| Update single variant | PATCH | `/api/products/:productId/variants/:variantId` |
| Mark as featured | POST | `/api/products/:productId/mark-popular` |
| Export products | GET | `/api/products/export?format=excel` |
| Sync exchange rates | POST | `/api/products/sync-exchange-rates` |

---

### Admin Panel — Category Management Flow

| Task | Method | Endpoint |
|---|---|---|
| View all categories | GET | `/api/categories/admin/all` |
| Create category | POST | `/api/categories` |
| Edit category | PUT | `/api/categories/:categoryId` |
| Update SEO | PUT | `/api/categories/:categoryId/meta` |
| Toggle featured | PUT | `/api/categories/:categoryId/toggle-featured` |
| Upload banner images | POST | `/api/categories/:categoryId/banner-images` |
| Reorder categories | PUT | `/api/categories/bulk/reorder` |
| Delete category | DELETE | `/api/categories/:categoryId` |
| Restore category | PUT | `/api/categories/:categoryId/restore` |
| Export categories | GET | `/api/categories/export?format=excel` |
| Sync product counts | POST | `/api/categories/sync-product-counts` |

---

### Admin Panel — Seller Management Flow

| Task | Method | Endpoint |
|---|---|---|
| Promote user to seller | PUT | `/api/admin/users/:userId { role: "seller" }` |
| Set seller store name | PUT | `/api/admin/users/:userId { sellerProfile.storeName: "..." }` |
| Set commission override | PUT | `/api/admin/users/:userId { sellerProfile.commissionRate: 12 }` |
| Verify seller | PUT | `/api/admin/users/:userId { sellerProfile.isVerified: true }` |
| View pending approvals | GET | `/api/products/admin/all?listingStatus=pending_approval` |
| Approve product | PATCH | `/api/products/:id/listing-status { action: "approve" }` |
| Reject product | PATCH | `/api/products/:id/listing-status { action: "reject", reason: "..." }` |
| View seller orders | GET | `/api/admin/installment-orders?sellerId=...` |
| Mark order delivered | PUT | `/api/admin/installment-orders/:id/delivery-status { status: "DELIVERED" }` |
| **All sellers overview (v2.1)** | GET | `/api/admin-mgmt/sellers` — product counts + revenue per seller |
| **Seller detail (v2.1)** | GET | `/api/admin-mgmt/sellers/:sellerId` — full product & order breakdown |
| **Seller's products (v2.1)** | GET | `/api/admin-mgmt/sellers/:sellerId/products?listingStatus=pending_approval` |

---

*Documentation version: 2.1 — Seller-mgmt admin endpoints; variant matrix merge; category/product field fixes; specifications format flexibility*
*Last Updated: 2026-03-03*
*For seller system full API details: see [`SELLER_SYSTEM_API_DOCUMENTATION.md`](./SELLER_SYSTEM_API_DOCUMENTATION.md)*
