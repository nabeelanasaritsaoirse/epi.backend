# Category Management API Documentation

## Overview
This document describes all API endpoints for managing product categories and subcategories. Categories are organized hierarchically with support for main categories and subcategories.

---

## Base URL
```
http://localhost:3000/api/categories
```

---

## Public Endpoints (No Authentication Required)

### 1. Get All Main Categories with Subcategories (For Dropdown)
**Endpoint:** `GET /api/categories/dropdown/all`

**Description:** Fetch all active main categories with their subcategories. Perfect for admin product creation form dropdown.

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "categoryId": "CAT123456001",
      "name": "Electronics",
      "slug": "electronics",
      "image": {
        "url": "https://example.com/electronics.jpg",
        "altText": "Electronics Category"
      },
      "subCategories": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "categoryId": "CAT123456002",
          "name": "Mobile Phones",
          "slug": "mobile-phones"
        },
        {
          "_id": "507f1f77bcf86cd799439013",
          "categoryId": "CAT123456003",
          "name": "Laptops",
          "slug": "laptops"
        }
      ]
    }
  ]
}
```

---

### 2. Get All Categories with Filters
**Endpoint:** `GET /api/categories`

**Description:** Get categories with optional filtering by parent category or active status.

**Query Parameters:**
- `parentCategoryId` (optional): Filter by parent category ID or 'null' for main categories
- `isActive` (optional): 'true', 'false', or 'all' (default: 'true')

**Example:**
```
GET /api/categories?parentCategoryId=507f1f77bcf86cd799439011&isActive=true
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "categoryId": "CAT123456002",
      "name": "Mobile Phones",
      "slug": "mobile-phones",
      "description": "All mobile phone categories",
      "parentCategoryId": "507f1f77bcf86cd799439011",
      "displayOrder": 1,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### 3. Get Category by ID
**Endpoint:** `GET /api/categories/:categoryId`

**Description:** Fetch a single category with its parent and subcategories populated.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "categoryId": "CAT123456001",
    "name": "Electronics",
    "slug": "electronics",
    "description": "Electronic products and gadgets",
    "image": {
      "url": "https://example.com/electronics.jpg",
      "altText": "Electronics"
    },
    "parentCategoryId": null,
    "subCategories": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "categoryId": "CAT123456002",
        "name": "Mobile Phones",
        "slug": "mobile-phones"
      }
    ],
    "isActive": true,
    "displayOrder": 1,
    "meta": {
      "title": "Electronics Store",
      "description": "Buy electronics online",
      "keywords": ["electronics", "gadgets"]
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Get Category with Subcategories
**Endpoint:** `GET /api/categories/:categoryId/with-subcategories`

**Description:** Fetch a category with all its nested subcategories.

**Response:** Same as endpoint #3 with complete subcategory tree.

---

### 5. Search Categories
**Endpoint:** `GET /api/categories/search/:query`

**Description:** Search categories by name, description, or slug.

**Example:**
```
GET /api/categories/search/mobile
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "categoryId": "CAT123456002",
      "name": "Mobile Phones",
      "slug": "mobile-phones",
      "description": "All types of mobile phones"
    }
  ]
}
```

---

## Admin Endpoints (Requires Admin Authentication)

### Authentication
All admin endpoints require:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- User must have admin role

---

### 1. Create Category
**Endpoint:** `POST /api/categories`

**Description:** Create a new main category or subcategory.

**Request Body:**
```json
{
  "name": "Electronics",
  "description": "All electronic products",
  "parentCategoryId": null,
  "image": {
    "url": "https://example.com/electronics.jpg",
    "altText": "Electronics Category"
  },
  "displayOrder": 1,
  "meta": {
    "title": "Electronics Store",
    "description": "Browse our electronics collection",
    "keywords": ["electronics", "gadgets", "devices"]
  }
}
```

**Required Fields:**
- `name` (string): Category name

**Optional Fields:**
- `description` (string)
- `parentCategoryId` (ObjectId): Leave null for main categories
- `image` (object): Contains `url` and `altText`
- `displayOrder` (number): Display order in list (default: 0)
- `meta` (object): SEO metadata

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "categoryId": "CAT123456001",
    "name": "Electronics",
    "slug": "electronics",
    "description": "All electronic products",
    "parentCategoryId": null,
    "subCategories": [],
    "isActive": true,
    "displayOrder": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2. Create Subcategory
**Endpoint:** `POST /api/categories`

**Description:** Create a subcategory under a main category.

**Request Body:**
```json
{
  "name": "Mobile Phones",
  "description": "All types of mobile phones",
  "parentCategoryId": "507f1f77bcf86cd799439011",
  "image": {
    "url": "https://example.com/mobile.jpg",
    "altText": "Mobile Phones"
  },
  "displayOrder": 1
}
```

**Response:** Same as Create Category response.

---

### 3. Update Category
**Endpoint:** `PUT /api/categories/:categoryId`

**Description:** Update category details, move to different parent, or change status.

**Request Body:**
```json
{
  "name": "Electronics & Gadgets",
  "description": "Updated description",
  "parentCategoryId": null,
  "image": {
    "url": "https://example.com/electronics-new.jpg"
  },
  "displayOrder": 2,
  "isActive": true,
  "meta": {
    "title": "Electronics & Gadgets Store",
    "keywords": ["electronics", "gadgets"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "categoryId": "CAT123456001",
    "name": "Electronics & Gadgets",
    "slug": "electronics-gadgets",
    "description": "Updated description",
    "displayOrder": 2,
    "isActive": true,
    "updatedAt": "2024-01-15T11:30:00Z"
  }
}
```

---

### 4. Delete Category
**Endpoint:** `DELETE /api/categories/:categoryId`

**Description:** Delete a category. Subcategories must be deleted first unless using force delete.

**Query Parameters:**
- `force` (optional): Set to 'true' to delete category and all subcategories

**Examples:**
```
DELETE /api/categories/507f1f77bcf86cd799439011

DELETE /api/categories/507f1f77bcf86cd799439011?force=true
```

**Response - Success:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Response - Has Subcategories (without force):**
```json
{
  "success": false,
  "message": "Category has 3 subcategories. Delete subcategories first or use force=true",
  "subcategoriesCount": 3
}
```

---

### 5. Bulk Reorder Categories
**Endpoint:** `PUT /api/categories/bulk/reorder`

**Description:** Update display order for multiple categories at once.

**Request Body:**
```json
{
  "categories": [
    {
      "id": "507f1f77bcf86cd799439011",
      "displayOrder": 1
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "displayOrder": 2
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "displayOrder": 3
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Categories reordered successfully"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Category name is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Category not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error message details"
}
```

---

## Usage in Product Creation

### Step 1: Fetch Categories for Dropdown
```javascript
// Get main categories with subcategories
const response = await fetch('/api/categories/dropdown/all');
const data = await response.json();

// data.data contains array of main categories with subCategories arrays
```

### Step 2: When Creating Product
```javascript
const productData = {
  name: "iPhone 14",
  category: {
    mainCategoryId: "507f1f77bcf86cd799439011",  // From dropdown
    mainCategoryName: "Electronics",
    subCategoryId: "507f1f77bcf86cd799439012",    // From dropdown
    subCategoryName: "Mobile Phones"
  },
  // ... other product fields
};

const response = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(productData)
});
```

---

## Example cURL Commands

### Create Main Category
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "All electronic products",
    "displayOrder": 1
  }'
```

### Create Subcategory
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Mobile Phones",
    "parentCategoryId": "507f1f77bcf86cd799439011",
    "displayOrder": 1
  }'
```

### Get Categories for Dropdown
```bash
curl http://localhost:3000/api/categories/dropdown/all
```

### Update Category
```bash
curl -X PUT http://localhost:3000/api/categories/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Electronics & Gadgets",
    "displayOrder": 2
  }'
```

### Delete Category
```bash
curl -X DELETE http://localhost:3000/api/categories/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Delete Category with Force (including subcategories)
```bash
curl -X DELETE "http://localhost:3000/api/categories/507f1f77bcf86cd799439011?force=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Database Schema

### Category Model
```javascript
{
  _id: ObjectId,
  categoryId: String (unique),
  name: String (required, unique),
  description: String,
  slug: String (unique, auto-generated),
  image: {
    url: String,
    altText: String
  },
  parentCategoryId: ObjectId (ref: Category) or null,
  subCategories: [ObjectId] (ref: Category),
  isActive: Boolean (default: true),
  displayOrder: Number (default: 0),
  meta: {
    title: String,
    description: String,
    keywords: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Notes
- Categories are auto-slugified from the name
- Category IDs are auto-generated in format: CAT[timestamp][random]
- Subcategories are automatically added to parent's subCategories array
- Inactive categories won't appear in dropdown for product creation
- Use `displayOrder` to control category order in lists
- Deleting a parent category requires deleting subcategories first (unless using force delete)
