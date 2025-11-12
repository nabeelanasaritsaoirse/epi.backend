# 📊 Database Structure & Collections Guide

## Database Overview

### **Database Name:** `epi_backend`
- **Location:** MongoDB at `127.0.0.1:27017` (Local) or via `MONGO_URI` env variable
- **Connection:** `mongodb://127.0.0.1:27017/epi_backend`

---

## Collections (Tables)

MongoDB uses **collections** instead of SQL tables. Below is the complete structure:

### 1. **categories** Collection
**Purpose:** Store product categories and subcategories

**Structure:**
```javascript
{
  _id: ObjectId("..."),                    // Auto-generated MongoDB ID
  categoryId: "CAT000001001",              // Custom category ID (unique)
  name: "Electronics",                     // Category name
  slug: "electronics",                     // URL-friendly slug
  description: "All electronic products",
  image: {
    url: "https://example.com/image.jpg",
    altText: "Electronics"
  },
  parentCategoryId: null,                  // null for main categories, ObjectId for subcategories
  subCategories: [                         // Array of subcategory IDs
    {
      _id: ObjectId("..."),
      categoryId: "CAT000001002",
      name: "Mobile Phones",
      slug: "mobile-phones"
    }
  ],
  displayOrder: 1,
  isActive: true,
  meta: {
    title: "Electronics Store",
    description: "Browse electronics",
    keywords: ["electronics", "gadgets"]
  },
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

**Key Fields:**
- `categoryId`: Unique custom ID (e.g., CAT000001001)
- `parentCategoryId`: Links to parent category (hierarchical)
- `subCategories`: Array of nested subcategories
- `slug`: URL-friendly name for SEO

---

### 2. **products** Collection
**Purpose:** Store all products with variants and pricing

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  productId: "PROD123456001",              // Custom product ID
  name: "iPhone 14",
  brand: "Apple",
  sku: "SKU-001",
  description: {
    short: "Latest Apple smartphone",
    long: "High-performance smartphone with advanced features"
  },
  category: {
    mainCategoryId: ObjectId("..."),       // Reference to main category
    mainCategoryName: "Electronics",
    subCategoryId: ObjectId("..."),        // Reference to subcategory
    subCategoryName: "Mobile Phones"
  },
  pricing: {
    regularPrice: 999.99,
    salePrice: 899.99,
    costPrice: 500.00,
    finalPrice: 899.99
  },
  availability: {
    stockQuantity: 50,
    lowStockLevel: 10,
    isAvailable: true
  },
  hasVariants: true,
  variants: [
    {
      _id: ObjectId("..."),
      variantId: "VAR123456",
      sku: "PROD123456001-1-3456",
      attributes: {
        color: "Black",
        size: "256GB",
        material: "Aluminum"
      },
      price: 999.99,
      salePrice: 899.99,
      stock: 20,
      isActive: true,
      description: {
        short: "Black iPhone 14 256GB",
        long: "Black color variant with 256GB storage"
      },
      paymentPlan: {
        enabled: true,
        minDownPayment: 100,
        maxDownPayment: 500,
        minInstallmentDays: 30,
        maxInstallmentDays: 365,
        interestRate: 0
      },
      images: [
        {
          url: "https://example.com/iphone-black-1.jpg",
          isPrimary: true,
          altText: "Black iPhone 14"
        }
      ]
    },
    {
      variantId: "VAR123457",
      attributes: { color: "Gold", size: "256GB" },
      price: 1049.99,
      stock: 15,
      // ... more variant data
    }
  ],
  paymentPlan: {
    enabled: true,
    minDownPayment: 100,
    maxDownPayment: 500,
    minInstallmentDays: 30,
    maxInstallmentDays: 365,
    interestRate: 0
  },
  status: "published",                     // draft, published, archived
  region: "global",
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

**Key Fields:**
- `productId`: Unique product identifier
- `category`: Reference to category (hierarchical)
- `hasVariants`: Boolean indicating if product has variants
- `variants`: Array of variant objects (color, size, price variations)
- `paymentPlan`: Installment/EMI configuration
- `status`: Publication status (draft/published/archived)

---

### 3. **users** Collection
**Purpose:** Store user accounts and profiles

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  name: "John Doe",
  email: "john@example.com",
  phoneNumber: "+1234567890",
  profilePicture: "https://...",
  firebaseUid: "firebase_uid_123",
  isAdmin: false,
  addresses: [
    {
      name: "Home",
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA",
      isPrimary: true
    }
  ],
  wallet: {
    balance: 500.00,
    totalEarned: 1000.00,
    totalSpent: 500.00
  },
  referralInfo: {
    referralCode: "JOHN2024",
    referredBy: ObjectId("..."),           // Reference to referring user
    totalReferrals: 5,
    commissionEarned: 250.00
  },
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 4. **orders** Collection
**Purpose:** Store customer orders

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  orderId: "ORD123456789",
  userId: ObjectId("..."),                 // Reference to user
  products: [
    {
      productId: ObjectId("..."),
      variantId: "VAR123456",
      quantity: 2,
      price: 899.99,
      total: 1799.98
    }
  ],
  totalAmount: 1799.98,
  status: "confirmed",                     // pending, confirmed, shipped, delivered
  paymentMethod: "razorpay",
  paymentId: "pay_123456",
  shippingAddress: {...},
  createdAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 5. **carts** Collection
**Purpose:** Store user shopping carts

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),                 // Reference to user
  items: [
    {
      productId: ObjectId("..."),
      variantId: "VAR123456",
      quantity: 2,
      price: 899.99,
      addedAt: ISODate("2024-01-15T10:30:00Z")
    }
  ],
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 6. **wishlists** Collection
**Purpose:** Store user wishlists

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  products: [
    {
      productId: ObjectId("..."),
      variantId: "VAR123456",
      addedAt: ISODate("2024-01-15T10:30:00Z")
    }
  ],
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 7. **payments** Collection
**Purpose:** Store payment transactions

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  paymentId: "pay_123456",
  orderId: ObjectId("..."),
  userId: ObjectId("..."),
  amount: 1799.98,
  currency: "USD",
  method: "razorpay",                      // razorpay, stripe, etc.
  status: "completed",                     // pending, completed, failed, refunded
  razorpayId: "pay_razorpay_123",
  createdAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 8. **transactions** Collection
**Purpose:** Store wallet transactions

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  type: "credit",                          // credit, debit, refund
  amount: 100.00,
  reason: "referral_commission",
  orderId: ObjectId("..."),
  createdAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 9. **plans** Collection
**Purpose:** Store subscription or payment plans

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  planId: "PLAN001",
  name: "Monthly Subscription",
  duration: 30,
  price: 99.99,
  features: ["Feature 1", "Feature 2"],
  isActive: true,
  createdAt: ISODate("2024-01-15T10:30:00Z")
}
```

---

### 10. **referrals** Collection
**Purpose:** Track referral relationships

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  referrerId: ObjectId("..."),             // User who referred
  refereeId: ObjectId("..."),              // User who was referred
  status: "active",                        // active, expired, completed
  commissionAmount: 50.00,
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  expiresAt: ISODate("2024-04-15T10:30:00Z")
}
```

---

### 11. **dailycommissions** Collection
**Purpose:** Track daily commission calculations

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  date: ISODate("2024-01-15T00:00:00Z"),
  totalCommission: 250.00,
  transactionCount: 5,
  details: [...]
}
```

---

### 12. **commissionwithdrawals** Collection
**Purpose:** Track commission withdrawal requests

**Structure:**
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  amount: 500.00,
  bankAccount: {
    accountHolder: "John Doe",
    accountNumber: "****1234",
    bankName: "Bank Name"
  },
  status: "pending",                       // pending, approved, rejected, completed
  requestedAt: ISODate("2024-01-15T10:30:00Z"),
  processedAt: ISODate("2024-01-16T10:30:00Z")
}
```

---

## Database Relationships (Diagram)

```
┌─────────────────┐
│   categories    │
│  (Main & Sub)   │
└────────┬────────┘
         │
         │ mainCategoryId
         │ subCategoryId
         ▼
┌─────────────────┐
│    products     │
│  (+ variants)   │
└────────┬────────┘
         │
    ┌────┴────┬─────────────┐
    │          │             │
    ▼          ▼             ▼
┌────────┐ ┌────────┐ ┌──────────┐
│ carts  │ │ orders │ │wishlists │
└────┬───┘ └────┬───┘ └──────────┘
     │           │
     │      ┌────┴─────┐
     │      ▼          ▼
     │  ┌────────┐ ┌──────────┐
     └─▶│ users  │◀┘ payments │
        └────┬───┘ └──────────┘
             │
        ┌────┴─────┬──────────────┬──────────────┐
        ▼          ▼              ▼              ▼
   ┌────────┐ ┌────────┐  ┌──────────┐  ┌──────────────┐
   │wallet  │ │referral│  │transactions│  │commissions  │
   └────────┘ └────────┘  └──────────┘  └──────────────┘
```

---

## How to Access via MongoDB GUI

### **Using MongoDB Compass** (Desktop GUI)
1. Download: https://www.mongodb.com/products/tools/compass
2. Connection String: `mongodb://127.0.0.1:27017`
3. Database: `epi_backend`
4. Browse collections

### **Using MongoDB Atlas** (Cloud)
1. Create cluster
2. Add connection string to `.env`:
   ```
   MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/epi_backend
   ```

### **Using CLI** (Terminal)
```bash
# Connect to MongoDB
mongosh mongodb://127.0.0.1:27017/epi_backend

# List all databases
show databases

# Switch to epi_backend
use epi_backend

# List all collections
show collections

# View documents in a collection
db.categories.find()
db.products.find()
db.users.find()

# Count documents
db.products.countDocuments()

# Search for specific document
db.products.findOne({ name: "iPhone 14" })

# Clear a collection
db.categories.deleteMany({})
```

---

## Summary

| Collection | Purpose | Documents | Indexes |
|---|---|---|---|
| **categories** | Product categories (hierarchical) | ~100 | categoryId, name, slug |
| **products** | All products with variants | ~1000 | productId, name, category |
| **users** | User accounts & profiles | ~10000 | email, firebaseUid |
| **orders** | Customer orders | ~5000 | orderId, userId |
| **carts** | Shopping carts | ~500 | userId |
| **wishlists** | User wishlists | ~1000 | userId |
| **payments** | Payment transactions | ~5000 | paymentId, userId |
| **transactions** | Wallet transactions | ~20000 | userId, type |
| **plans** | Subscription plans | ~50 | planId |
| **referrals** | Referral relationships | ~5000 | referrerId, refereeId |
| **dailycommissions** | Daily commission records | ~30000 | userId, date |
| **commissionwithdrawals** | Withdrawal requests | ~2000 | userId, status |

---

## Connection Configuration

**File:** `config/database.js`

```javascript
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epi_backend';
```

**Environment Variable (`.env`):**
```
# Local MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/epi_backend

# OR MongoDB Atlas (Cloud)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/epi_backend
```

---

## Data Flow Example

### Creating a Product with Variants:
1. **Admin creates category** → Stored in `categories` collection
2. **Admin creates product** → Stored in `products` collection with category reference
3. **Each variant** → Stored in `products.variants` array (nested document)
4. **User adds to cart** → Reference stored in `carts` collection
5. **User places order** → New document in `orders` collection
6. **Payment processed** → Record in `payments` + `transactions` collections

---

## Quick Reference Queries

```javascript
// Get all categories with subcategories
db.categories.find({ parentCategoryId: null })

// Get all products in a category
db.products.find({ "category.mainCategoryId": ObjectId("...") })

// Get all variants of a product
db.products.findOne({ productId: "PROD123" }).variants

// Get user's cart items
db.carts.findOne({ userId: ObjectId("...") }).items

// Get completed orders for a user
db.orders.find({ userId: ObjectId("..."), status: "delivered" })

// Get all low-stock products
db.products.find({ "availability.stockQuantity": { $lt: 10 } })
```

---

**Generated:** November 12, 2025  
**Status:** Complete Database Structure ✅
