# Featured Lists API - Admin Documentation

## Overview

The **Featured Lists** system allows administrators to create and manage custom product collections (e.g., "Best Selling", "Trending", "New Arrivals") that will be displayed to users. This system provides full flexibility to create unlimited lists with custom names and manage products within them.

## Key Features

- ✅ **Unlimited Custom Lists**: Create as many lists as needed with any name
- ✅ **Dynamic Product Management**: Add, remove, and reorder products easily
- ✅ **Automatic Order Normalization**: Product orders are automatically fixed (e.g., 1, 5, 10 → 1, 2, 3)
- ✅ **Auto-Sync**: Product data automatically updates when products are modified
- ✅ **Region-Based Filtering**: Lists automatically show only products available in user's region
- ✅ **Performance Optimized**: Cached product data ensures fast API responses

---

## API Endpoints

### Base URL
```
Production: https://api.epielio.com/api/featured-lists
Development: http://localhost:5000/api/featured-lists
```

---

## Public APIs (No Authentication Required)

These endpoints are used by the frontend application to display lists to end users.

### 1. Get All Active Lists

**Endpoint:** `GET /api/featured-lists`

**Description:** Retrieves all active featured lists with their products. Products are automatically filtered based on the user's region.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | Number | No | 10 | Maximum products to return per list |
| `region` | String | No | Auto-detected | Manually specify region for filtering |

**Example Request:**
```bash
GET https://api.epielio.com/api/featured-lists?limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "listId": "550e8400-e29b-41d4-a716-446655440000",
      "listName": "Best Selling",
      "slug": "best-selling",
      "description": "Our top-selling products this month",
      "displayOrder": 1,
      "products": [
        {
          "productId": "PROD-001",
          "productMongoId": "507f1f77bcf86cd799439011",
          "order": 1,
          "productName": "Premium Smartphone",
          "brand": "Samsung",
          "productImage": "https://cdn.epielio.com/products/phone.jpg",
          "price": 49999,
          "finalPrice": 44999,
          "lastSynced": "2025-12-22T10:30:00.000Z"
        }
      ],
      "totalProducts": 5
    }
  ],
  "region": "india"
}
```

---

### 2. Get Single List by Slug

**Endpoint:** `GET /api/featured-lists/:slug`

**Description:** Retrieves a specific featured list with paginated products.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | String | Yes | URL-friendly list identifier (e.g., "best-selling") |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number for pagination |
| `limit` | Number | No | 20 | Products per page |
| `region` | String | No | Auto-detected | Manually specify region |

**Example Request:**
```bash
GET https://api.epielio.com/api/featured-lists/best-selling?page=1&limit=10
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "listName": "Best Selling",
    "slug": "best-selling",
    "description": "Our top-selling products",
    "products": [
      {
        "productId": "PROD-001",
        "productMongoId": "507f1f77bcf86cd799439011",
        "order": 1,
        "productName": "Premium Smartphone",
        "brand": "Samsung",
        "productImage": "https://cdn.epielio.com/products/phone.jpg",
        "price": 49999,
        "finalPrice": 44999
      }
    ]
  },
  "pagination": {
    "current": 1,
    "pages": 3,
    "total": 25
  },
  "region": "india"
}
```

---

## Admin APIs (Authentication Required)

All admin endpoints require authentication. Include the admin JWT token in the Authorization header:

```
Authorization: Bearer <admin_token>
```

---

### 3. Create New Featured List

**Endpoint:** `POST /api/featured-lists/admin/lists`

**Description:** Creates a new featured list.

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `listName` | String | Yes | Display name of the list |
| `slug` | String | Yes | URL-friendly identifier (must be unique, lowercase) |
| `description` | String | No | Brief description of the list |
| `isActive` | Boolean | No | Whether list is visible to users (default: true) |
| `displayOrder` | Number | No | Order in which lists appear (default: 0) |

**Example Request:**
```bash
POST https://api.epielio.com/api/featured-lists/admin/lists
Authorization: Bearer <token>
Content-Type: application/json

{
  "listName": "Summer Collection",
  "slug": "summer-collection",
  "description": "Hot products for the summer season",
  "isActive": true,
  "displayOrder": 5
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Featured list created successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "listName": "Summer Collection",
    "slug": "summer-collection",
    "description": "Hot products for the summer season",
    "products": [],
    "isActive": true,
    "displayOrder": 5,
    "createdBy": "64f8a1b2c3d4e5f6a7b8c9d0",
    "createdByEmail": "admin@epielio.com",
    "createdAt": "2025-12-22T10:30:00.000Z"
  }
}
```

---

### 4. Get All Lists (Admin View)

**Endpoint:** `GET /api/featured-lists/admin/lists`

**Description:** Retrieves all featured lists including inactive ones. Used for admin panel list management.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 20 | Lists per page |
| `isActive` | Boolean | No | All | Filter by active status (true/false) |
| `search` | String | No | - | Search by list name or slug |

**Example Request:**
```bash
GET https://api.epielio.com/api/featured-lists/admin/lists?page=1&limit=10&isActive=true&search=summer
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "listId": "550e8400-e29b-41d4-a716-446655440000",
      "listName": "Summer Collection",
      "slug": "summer-collection",
      "description": "Hot products for the summer season",
      "products": [...],
      "isActive": true,
      "displayOrder": 5,
      "createdAt": "2025-12-22T10:30:00.000Z",
      "updatedAt": "2025-12-22T11:45:00.000Z"
    }
  ],
  "pagination": {
    "current": 1,
    "pages": 2,
    "total": 15
  }
}
```

---

### 5. Get Single List (Admin View)

**Endpoint:** `GET /api/featured-lists/admin/lists/:listId`

**Description:** Retrieves detailed information about a specific list. Accepts either `listId` or `slug` as parameter.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | String | Yes | List ID or slug |

**Example Request:**
```bash
GET https://api.epielio.com/api/featured-lists/admin/lists/summer-collection
```

---

### 6. Update List Details

**Endpoint:** `PUT /api/featured-lists/admin/lists/:listId`

**Description:** Updates list information (name, slug, description, status, display order).

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
All fields are optional. Only include fields you want to update.

| Field | Type | Description |
|-------|------|-------------|
| `listName` | String | New display name |
| `slug` | String | New slug (must be unique) |
| `description` | String | New description |
| `isActive` | Boolean | Activate or deactivate list |
| `displayOrder` | Number | Change display order |

**Example Request:**
```bash
PUT https://api.epielio.com/api/featured-lists/admin/lists/summer-collection
Authorization: Bearer <token>
Content-Type: application/json

{
  "listName": "Summer Special 2025",
  "description": "Updated collection for summer",
  "displayOrder": 1
}
```

---

### 7. Delete List

**Endpoint:** `DELETE /api/featured-lists/admin/lists/:listId`

**Description:** Soft-deletes a featured list. The list is marked as deleted but not permanently removed from the database.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Example Request:**
```bash
DELETE https://api.epielio.com/api/featured-lists/admin/lists/summer-collection
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "message": "List deleted successfully"
}
```

---

### 8. Add Product to List

**Endpoint:** `POST /api/featured-lists/admin/lists/:listId/products`

**Description:** Adds a product to the featured list. The system automatically fetches and caches product details.

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | String | Yes | Product ID to add |
| `order` | Number | No | Display order (auto-assigned if not provided) |

**Example Request:**
```bash
POST https://api.epielio.com/api/featured-lists/admin/lists/summer-collection/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "PROD-001",
  "order": 5
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Product added to list successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "listName": "Summer Collection",
    "products": [
      {
        "productId": "PROD-001",
        "order": 1,
        "productName": "Premium Smartphone",
        "productImage": "https://cdn.epielio.com/products/phone.jpg",
        "price": 49999,
        "finalPrice": 44999,
        "lastSynced": "2025-12-22T10:30:00.000Z"
      }
    ]
  }
}
```

**Note:** Orders are automatically normalized. For example, if you add products with orders [1, 5, 10], they will be automatically adjusted to [1, 2, 3].

---

### 9. Remove Product from List

**Endpoint:** `DELETE /api/featured-lists/admin/lists/:listId/products/:productId`

**Description:** Removes a product from the featured list.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | String | Yes | List ID or slug |
| `productId` | String | Yes | Product ID to remove |

**Example Request:**
```bash
DELETE https://api.epielio.com/api/featured-lists/admin/lists/summer-collection/products/PROD-001
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "message": "Product removed from list successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "listName": "Summer Collection",
    "products": []
  }
}
```

---

### 10. Reorder Products

**Endpoint:** `PUT /api/featured-lists/admin/lists/:listId/reorder`

**Description:** Changes the display order of products in the list. This is typically used when implementing drag-and-drop functionality.

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `products` | Array | Yes | Array of objects with productId and new order |

**Example Request:**
```bash
PUT https://api.epielio.com/api/featured-lists/admin/lists/summer-collection/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "products": [
    { "productId": "PROD-003", "order": 1 },
    { "productId": "PROD-001", "order": 10 },
    { "productId": "PROD-002", "order": 5 }
  ]
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Products reordered successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "listName": "Summer Collection",
    "products": [
      {
        "productId": "PROD-003",
        "order": 1,
        "productName": "Product 3"
      },
      {
        "productId": "PROD-002",
        "order": 2,
        "productName": "Product 2"
      },
      {
        "productId": "PROD-001",
        "order": 3,
        "productName": "Product 1"
      }
    ]
  }
}
```

**Note:** The orders will be automatically normalized to sequential numbers (1, 2, 3, ...).

---

### 11. Sync Single Product Data

**Endpoint:** `POST /api/featured-lists/admin/lists/:listId/products/:productId/sync`

**Description:** Manually refreshes cached data for a specific product in the list. Useful if you notice product data is outdated.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Example Request:**
```bash
POST https://api.epielio.com/api/featured-lists/admin/lists/summer-collection/products/PROD-001/sync
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "message": "Product synced successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "products": [...]
  }
}
```

---

### 12. Sync All Products in List

**Endpoint:** `POST /api/featured-lists/admin/lists/:listId/sync-all`

**Description:** Manually refreshes cached data for all products in the list.

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Example Request:**
```bash
POST https://api.epielio.com/api/featured-lists/admin/lists/summer-collection/sync-all
Authorization: Bearer <token>
```

**Example Response:**
```json
{
  "success": true,
  "message": "All products synced successfully",
  "data": {
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "products": [...]
  }
}
```

---

## Admin Panel Implementation Guide

### Recommended Workflow

#### 1. **Creating a New Featured List**

```javascript
// Step 1: Create the list
const createList = async () => {
  const response = await fetch('https://api.epielio.com/api/featured-lists/admin/lists', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      listName: 'Weekend Deals',
      slug: 'weekend-deals',
      description: 'Special offers for the weekend',
      isActive: true,
      displayOrder: 1
    })
  });

  const data = await response.json();
  return data.data.listId;
};
```

#### 2. **Adding Products to List**

```javascript
// Step 2: Admin searches for products using existing product search API
// Then adds selected products to the list

const addProduct = async (listId, productId, order) => {
  const response = await fetch(
    `https://api.epielio.com/api/featured-lists/admin/lists/${listId}/products`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: productId,
        order: order  // Optional - will auto-assign if not provided
      })
    }
  );

  return await response.json();
};
```

#### 3. **Implementing Drag-and-Drop Reordering**

```javascript
// Step 3: When admin drags products to reorder them

const handleDragEnd = async (listId, reorderedProducts) => {
  // reorderedProducts is array after drag-drop
  const productsWithOrder = reorderedProducts.map((product, index) => ({
    productId: product.productId,
    order: index + 1
  }));

  const response = await fetch(
    `https://api.epielio.com/api/featured-lists/admin/lists/${listId}/reorder`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        products: productsWithOrder
      })
    }
  );

  return await response.json();
};
```

#### 4. **Displaying Lists in Admin Panel**

```javascript
// Fetch all lists for admin management
const fetchAdminLists = async (page = 1, search = '') => {
  const response = await fetch(
    `https://api.epielio.com/api/featured-lists/admin/lists?page=${page}&limit=20&search=${search}`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );

  return await response.json();
};
```

---

## Automatic Features

### 1. **Auto-Sync on Product Changes**

The system automatically updates cached product data when:
- Product name is changed
- Product price is updated
- Product images are modified
- Product is deleted (removed from all lists)

**No manual action required** - this happens automatically in the background.

### 2. **Order Normalization**

Orders are automatically normalized to sequential numbers:
- Input: [1, 5, 10, 15] → Output: [1, 2, 3, 4]
- Input: [10, 20, 30] → Output: [1, 2, 3]

This ensures consistent ordering regardless of how admins input order numbers.

### 3. **Region-Based Filtering**

When users fetch lists via public APIs:
- System detects user's region automatically
- Only shows products available in that region
- Checks regional stock availability
- Filters out products with 0 stock in user's region

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Not admin user |
| 404 | Not Found - List or product doesn't exist |
| 500 | Internal Server Error - Server-side issue |

### Example Error Responses

**Duplicate Slug:**
```json
{
  "success": false,
  "message": "A list with this slug already exists"
}
```

**Product Not Found:**
```json
{
  "success": false,
  "message": "Product not found"
}
```

**Product Already in List:**
```json
{
  "success": false,
  "message": "Product already exists in this list"
}
```

---

## Best Practices

### 1. **List Naming Conventions**
- Use clear, descriptive names (e.g., "Best Selling" not "BS")
- Keep slugs lowercase and hyphenated (e.g., "best-selling")
- Avoid special characters in slugs

### 2. **Product Ordering**
- Start from 1 for the first product
- Use any numbers for subsequent products - system will normalize
- Consider using multiples of 10 (10, 20, 30) for easier reordering

### 3. **List Management**
- Regularly review and update lists
- Remove out-of-stock products periodically
- Use `displayOrder` to control list appearance on homepage
- Set `isActive: false` for seasonal lists when not in season

### 4. **Performance Optimization**
- Use pagination when displaying lists with many products
- Consider limiting products per list to 20-30 for best performance
- Use the sync endpoints only when necessary (auto-sync handles most cases)

---

## Frontend Integration Example

### Homepage Featured Lists Display

```javascript
import React, { useEffect, useState } from 'react';

const FeaturedLists = () => {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedLists();
  }, []);

  const fetchFeaturedLists = async () => {
    try {
      const response = await fetch(
        'https://api.epielio.com/api/featured-lists?limit=5'
      );
      const data = await response.json();

      if (data.success) {
        setLists(data.data);
      }
    } catch (error) {
      console.error('Error fetching featured lists:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {lists.map(list => (
        <section key={list.listId}>
          <h2>{list.listName}</h2>
          <p>{list.description}</p>

          <div className="product-grid">
            {list.products.map(product => (
              <ProductCard
                key={product.productId}
                productId={product.productId}
                name={product.productName}
                image={product.productImage}
                price={product.price}
                finalPrice={product.finalPrice}
              />
            ))}
          </div>

          <a href={`/collections/${list.slug}`}>View All</a>
        </section>
      ))}
    </div>
  );
};
```

---

## Testing Checklist

Before deploying to production, test these scenarios:

- [ ] Create a new list
- [ ] Add products to list
- [ ] Reorder products using different order numbers
- [ ] Remove products from list
- [ ] Update list details (name, slug, description)
- [ ] Deactivate and reactivate list
- [ ] Delete list
- [ ] Verify products appear correctly in public API
- [ ] Test region-based filtering
- [ ] Update a product and verify auto-sync works
- [ ] Delete a product and verify it's removed from lists
- [ ] Test pagination on lists with many products
- [ ] Verify order normalization works correctly

---

## Support & Questions

For technical issues or questions about this API, please contact:

**Development Team:**
- Email: dev@epielio.com
- Slack: #api-support

**Documentation Version:** 1.0
**Last Updated:** December 22, 2025
